'use strict';

const logger = require('./logger').logger('STORAGE');

const Redis = require('ioredis');
const redisClient = new Redis({
    maxRetriesPerRequest: null,
    port: 6379,
    host: 'host.docker.internal'
});
const ACTIVE_KEY = 'active';

/**
 * Stores the active process id.
 *
 * @param {string} id - The id of the active process.
 */
async function storeActive(id) {
    logger.info(`Storing ${id} as active`);
    await redisClient.set(ACTIVE_KEY, id);
}

/**
 * Returns the stored active process id.
 *
 * @returns {string} - The id of the stored active procecss.
 */
async function retrieveActive() {
    const id = await redisClient.get(ACTIVE_KEY);
    logger.info(`Stored active: ${id}`);
    return id;
}

module.exports = {
    retrieveActive,
    storeActive
};
