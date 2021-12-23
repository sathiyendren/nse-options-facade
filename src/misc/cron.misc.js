const cron = require('node-cron');
const axios = require('axios');
const logger = require('../config/logger');
const { symbolRateService } = require('../services');

const checkHealth = () =>
  new Promise((resolve) => {
    axios
      .get('https://nse-options-facade.herokuapp.com/v1/misc/ping')
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(true);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve(true);
      });
  });

const herokuKeepAliveCall = async () => {
  try {
    const isSuccess = await checkHealth();
    logger.info(`health check :: ${isSuccess}`);
  } catch (error) {
    logger.info('Error Heroku KeepAlive Call');
  }
};

const getCurrentDateTime = () => {
  const now = new Date();
  // logger.info(`Current Time :: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);
  logger.info(`Current DateTime :: ${now}`);
};

/**
 * Starts All Cron Tasks
 */
const startCronTasks = () => {
  cron.schedule('*/15 * * * *', () => {
    logger.info('running a task every 15 minute');
    herokuKeepAliveCall();
  });

  cron.schedule('*/10 * * * * *', () => {
    logger.info('running a task every 10 seconds');
    getCurrentDateTime();
    symbolRateService.updateNiftyAndBankNifyCurrentPrice(true);
  });

  cron.schedule('46 2 * * * ', () => {
    logger.info('running a task every 9:16 AM IST');
    getCurrentDateTime();
    symbolRateService.updateNiftyAndBankNifyCurrentPrice(false);
  });

  cron.schedule('47 2 * * * ', () => {
    logger.info('running a task every 9:17 AM IST');
    getCurrentDateTime();
    symbolRateService.updateNiftyAndBankNifyCurrentPrice(false);
  });

  cron.schedule('48 2 * * * ', () => {
    logger.info('running a task every 9:18 AM IST');
    getCurrentDateTime();
    symbolRateService.updateNiftyAndBankNifyCurrentPrice(false);
  });

  cron.schedule('50 2 * * * ', () => {
    logger.info('running a task every 9:20 AM IST');
    getCurrentDateTime();
  });
};

module.exports = {
  startCronTasks,
};
