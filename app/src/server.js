'use strict';

const logger = require('./logger').logger('SERVER');
const express = require('express');

let state = 0;
let server;

const hostname = process.env.HOSTNAME;
const host = process.env.MY_POD_IP || process.env.LOCAL_IP || '127.0.0.1';
const port = 8082;

/**
 * Initializes the http server on the given port.
 */
function init() {
    logger.info(`Initializing server on http://${host}:${port}`);

    const app = express();

    app.get('/', (req, res) => {
        res.send(`Hello World from ${hostname}`);
    });

    app.get('/state', (req, res) => {
        res.send(`Current state: ${state++}`);
    });

    server = app.listen(port, host);
}

process.on('uncaughtException', () => { server?.close(); });
process.on('SIGTERM', () => { server?.close(); });

module.exports.init = init;
