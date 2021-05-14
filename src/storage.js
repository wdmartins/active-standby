'use strict';

const logger = require('./logger').logger('STORAGE');

const Redis = require('ioredis');
const redisClient = new Redis({ maxRetriesPerRequest: null });
const ACTIVE_KEY = 'active';

async function storeActive(id) {
    logger.info(`Storing ${id} as active`);
    await redisClient.set(ACTIVE_KEY, id);
}

async function retrieveActive() {
    const id = await redisClient.get(ACTIVE_KEY);
    logger.info(`Stored active: ${id}`);
    return id;
}

module.exports = {
    retrieveActive,
    storeActive
};
