'use strict';

const logger = require('./logger').logger('SERVER');
const express = require('express');
const storage = require('./storage');

let server;
const APP_STATES = {
    IDLE: 'Idle',
    RUNNING: 'Running',
    PAUSED: 'Paused'
};

const hostname = process.env.HOSTNAME;
const host = process.env.MY_POD_IP || process.env.LOCAL_IP || '127.0.0.1';
const port = 8082;

/**
 * Builds the response to the received command.
 *
 * @param {string} command - The received command.
 * @param {string} result - The execution result.
 * @param {string} previousState - The state before executing the command.
 * @param {*} currentState - The state after executing the command.
 * @returns {object} - The response object.
 */
function buildResponse(command, result, previousState, currentState) {
    return {
        hostname,
        result,
        command,
        previousState,
        currentState
    };
}
/**
 * Initializes the http server on the given port.
 */
async function init() {
    logger.info(`Initializing server on http://${host}:${port}`);

    const app = express();

    const initialState = await storage.retrieveState();
    if (!initialState) {
        await storage.storeState(APP_STATES.IDLE);
    }

    app.get('/', (req, res) => {
        res.send(`Hello World from ${hostname}</br>Available commands: \\state, \\start, \\pause and \\stop`);
    });

    app.get('/state', async (req, res) => {
        const currentState = await storage.retrieveState();
        res.send(buildResponse('/state', 'OK', null, currentState));
    });

    app.get('/start', async (req, res) => {
        const previousState = await storage.retrieveState();
        if (previousState !== APP_STATES.IDLE && previousState !== APP_STATES.PAUSED) {
            res.status(400).send(buildResponse('/start', 'Invalid command', previousState, previousState));
        } else {
            const currentState = APP_STATES.RUNNING;
            await storage.storeState(currentState);
            res.send(buildResponse('/start', 'OK', previousState, currentState));
        }
    });

    app.get('/stop', async (req, res) => {
        const previousState = await storage.retrieveState();
        if (previousState === APP_STATES.STOP) {
            res.status(400).send(buildResponse('/stop', 'Invalid command', previousState, previousState));
        } else {
            const currentState = APP_STATES.IDLE;
            await storage.storeState(currentState);
            res.send(buildResponse('/stop', 'OK', previousState, currentState));
        }
    });

    app.get('/pause', async (req, res) => {
        const previousState = await storage.retrieveState();
        if (previousState === APP_STATES.PAUSED || previousState === APP_STATES.IDLE) {
            res.status(400).send(buildResponse('/pause', 'Invalid command', previousState, previousState));
        } else {
            const currentState = APP_STATES.PAUSED;
            await storage.storeState(currentState);
            res.send(buildResponse('/pause', 'OK', previousState, currentState));
        }
    });

    server = app.listen(port, host);
}

process.on('uncaughtException', () => { server?.close(); });
process.on('SIGTERM', () => { server?.close(); });

module.exports.init = init;
