const cron = require('node-cron');
const axios = require('axios');
const logger = require('../config/logger');

/**
 * Generate token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
const startCronTasks = () => {
  cron.schedule('*/10 * * * * *', () => {
    logger.info('running a task every 10 seconds');
    const now = new Date();
    logger.info(`Current Time :: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);
  });

  cron.schedule('15 9 * * * ', () => {
    logger.info('running a task every 9:15 am');
  });
};

module.exports = {
  startCronTasks,
};
