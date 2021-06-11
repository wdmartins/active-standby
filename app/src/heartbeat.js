'use strict';

const logger = require('./logger').logger('HEARTBEAT');
const net = require('net');
const storage = require('./storage');

const k8sClient = require('./k8s');
const { POD_MODE } = k8sClient;

/////////////////////////////////////////////////////////////////////////////////
// Constants
/////////////////////////////////////////////////////////////////////////////////
const HEARTBEAT_INTERVAL = 250;
const CONNECT_TIMEOUT = 4000;
const RETRY_TIMEOUT = 1000;
const SOCKET_TIMEOUT = 1000;

const REASSIGN_TIMEOUT = 500; // Timeout before connecting to a new process after it has become active
const RESET_ACTIVE_TIMEOUT = 5000;

/////////////////////////////////////////////////////////////////////////////////
// Variables
/////////////////////////////////////////////////////////////////////////////////\
const sockets = new Set();

// Use a random timeout between 50 and 100 ms to avoid race conditions in case of multiple standby processes
const randomTimeout = 50 + Math.floor(50 * Math.random());

let server = null;
let isActive = false;
let localAddress = null;
let activeProcess = null;
let onActiveCallback = null;

let heartbeatInterval = null;
let nextRedisCheck = 0;

/////////////////////////////////////////////////////////////////////////////////
// Internal functions
/////////////////////////////////////////////////////////////////////////////////
/**
 * Asynchronous delay in ms.
 *
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise} No data.
 */
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * Start heartbeat interval.
 */
function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
        const now = Date.now();

        if (server) {
            // Send PING
            for (const socket of sockets) {
                try {
                    socket.write('OK');
                } catch (err) {}
            }

            if (nextRedisCheck < now) {
                // Make sure redis has this process as the active one
                storage.storeActive(localAddress).catch(() => {});
                nextRedisCheck = now + RESET_ACTIVE_TIMEOUT;
            }
        }

    }, HEARTBEAT_INTERVAL);

    heartbeatInterval.unref();
}


/**
 * Sets the current process as active.
 */
function setActive() {
    if (isActive) {
        return;
    }
    k8sClient.setMode(POD_MODE.ACTIVE);
    logger.info('This is the new active process');
    isActive = true;
    if (onActiveCallback) {
        onActiveCallback();
        onActiveCallback = null;
    }

    startHeartbeat();
}

/**
 * Take over the role as active process.
 */
async function takeOver() {
    logger.info('Take over as active process');
    await storage.storeActive(localAddress);
    // Wait a short time to detect race conditions in case more than one process attempted to take over
    await sleep(randomTimeout);
    activeProcess = await storage.retrieveActive();
    if (activeProcess === localAddress) {
        setActive();
    } else {
        logger.warn(`Possible race condition. Active process has been set to ${activeProcess}.`);
        await sleep(REASSIGN_TIMEOUT);
        connectToActiveProcess();
    }
}

/**
 * Starts the heartbeat server communication between the active/standby processes.
 *
 * @param {number} port - The listening port for heartbeat server.
 * @returns {Promise} Promise resolved when server is successfully started.
 */
function startServer(port) {
    return new Promise(resolve => {
        server = net.createServer(socket => {
            const socketInfo = `${socket.remoteAddress}:${socket.remotePort}`;
            logger.info(`New connection from ${socketInfo}`);
            socket.setEncoding('utf8');
            sockets.add(socket);

            // Register error handler to prevent uncaught exceptions
            socket.on('error', () => {});

            socket.on('close', () => {
                logger.info(`Socket from ${socketInfo} has closed`);
                sockets.delete(socket);
            });
        });

        const host = process.env.MY_POD_IP || process.env.LOCAL_IP || '127.0.0.1';
        localAddress = `${host}:${port}`;

        logger.info(`Start heartbeat server on ${localAddress}`);
        server.listen(port, host, () => {
            logger.info('Heartbeat server listening on', server.address());
            resolve();
        })
            .on('error', error => {
                logger.error('Failed to start heartbeat server.', error);
                // Proecss cannot continue in this case. Exit with an error.
                logger.shutdownAndExit(1);
            });
    });
}

/**
 * Check if a new process has taken over the role of active process.
 */
async function checkForNewServer() {
    await sleep(randomTimeout);
    const address = await storage.retrieveActive();
    if (address === activeProcess) {
        takeOver();
    } else {
        activeProcess = address;
        logger.warn(`There is a new active process: ${activeProcess}`);
        await sleep(REASSIGN_TIMEOUT);
        connectToActiveProcess();
    }
}

/**
 * Open heartbeat connection to active process.
 *
 * @param {boolean} [retry=false] - True if this is a reconnect attempt.
 */
async function connectToActiveProcess(retry = false) {
    activeProcess = await storage.retrieveActive();

    if (!activeProcess) {
        logger.info('Active process is not set');
        takeOver();
        return;
    } else if (activeProcess === localAddress) {
        setActive();
        return;
    }

    if (retry) {
        logger.info(`Retry connecting to active process: ${activeProcess}`);
    } else {
        logger.info(`Connect to active process: ${activeProcess}`);
    }
    const [host, port] = activeProcess.split(':');

    // @ts-ignore
    const socket = net.createConnection({ host, port });
    socket.setTimeout(retry ? RETRY_TIMEOUT : CONNECT_TIMEOUT);

    let isConnected = false;
    socket.on('connect', () => {
        socket.setTimeout(SOCKET_TIMEOUT);
        isConnected = true;
    });

    // Need to register event handler for data
    socket.on('data', () => {});

    socket.on('close', () => {
        if (!isConnected) {
            logger.error(`Failed connecting to active process at ${activeProcess}`);
            checkForNewServer();
        } else {
            logger.error(`Socket to ${activeProcess} has closed. Retry connection.`);
            connectToActiveProcess(true);
        }
    });

    socket.on('timeout', () => {
        if (isConnected) {
            logger.warn(`Timed out waiting for heartbeat message from ${activeProcess}`);
        } else {
            logger.warn(`Timed out waiting to connect to ${activeProcess}`);
        }
        socket.destroy();
    });

    // Register error handler to prevent process from crashing
    socket.on('error', () => {});
}

/**
 * Initialize the heartbeat mechanism for the multi processes communication.
 *
 * @param {number} [port] - The listening port for heartbeat server.
 */
async function init(port) {
    if (server || isActive) {
        throw new Error('Heartbeat module has already been initialized');
    }
    if (port && typeof port === 'number') {
        k8sClient.setMode(POD_MODE.STAND_BY);
        await startServer(port);
        await connectToActiveProcess();
    } else {
        // Standalone mode
        k8sClient.setMode(POD_MODE.ACTIVE);
        isActive = true;
        startHeartbeat();
    }
}

/**
 * Registers a callback for when this becomes the active process.
 *
 * @param {Function} callback - The callback handler.
 */
function registerOnActive(callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback must be a function');
    }
    if (isActive) {
        callback();
    } else {
        onActiveCallback = callback;
    }
}

/////////////////////////////////////////////////////////////////////////////////
// Public interfaces
/////////////////////////////////////////////////////////////////////////////////
module.exports = {
    init,
    registerOnActive
};
