'use strict';
const bunyan = require('bunyan');

module.exports.logger = function (name) {
    return bunyan.createLogger({
        name: name.padEnd(8, '.'),
        stream: process.stdout
    });
};
