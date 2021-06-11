'use strict';

const logger = require('./logger').logger('STORAGE');

const Redis = require('ioredis');
const redisClient = new Redis({
    maxRetriesPerRequest: null,
    port: 6379,
    host: 'host.docker.internal'
});
const ACTIVE_KEY = 'active';
const STATE_KEY = 'state';

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

/**
 * Stores the app state.
 *
 * @param {string} state - The new state of the app.
 */
async function storeState(state) {
    logger.info(`Storing app state: ${state}`);
    await redisClient.set(STATE_KEY, state);
}

/**
 * Returns the stored app state.
 *
 * @returns {string} - The state of the app.
 */
async function retrieveState() {
    const state = await redisClient.get(STATE_KEY);
    logger.info(`Stored app state: ${state}`);
    return state;
}

module.exports = {
    retrieveActive,
    retrieveState,
    storeActive,
    storeState
};
