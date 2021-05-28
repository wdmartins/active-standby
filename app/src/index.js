'use strict';

const logger = require('./logger').logger('MAIN');
const server = require('./server');
const argv = require('minimist')(process.argv.slice(2));

(async () => {
    logger.info('Starting application...');
    if (!argv.port) {
        logger.error('Missing parameter: --port');
        process.exit(1);
    }
    const heartbeat = require('./heartbeat');
    await heartbeat.init(argv.port);
    heartbeat.registerOnActive(server.init);
})();
