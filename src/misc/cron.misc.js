const cron = require('node-cron');
const axios = require('axios');
const logger = require('../config/logger');
const { symbolRateService, miscService, expiryDateService, optionChainService } = require('../services');
const { symbolTypes } = require('../config/optionScript');

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

const isCurrentTimeMatch = (hour, minute) => {
  const now = new Date();
  logger.info(`Current Time :: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);
  return now.getHours() === hour && now.getMinutes() === minute;
};

/**
 * Starts All Cron Tasks
 */
const startCronTasks = () => {
  cron.schedule('*/15 * * * *', () => {
    logger.info('running a task every 15 minute');
    herokuKeepAliveCall();
  });

  cron.schedule('*/10 * * * * *', async () => {
    logger.info('----------------------------------');
    logger.info('running a task every 10 seconds');
    const nseOptionChainNiftyData = await miscService.getOptionChainData(symbolTypes.NIFTY);
    logger.info(`nseOptionChainNiftyData :${nseOptionChainNiftyData}`);
    if (nseOptionChainNiftyData) {
      symbolRateService.updateSymbolCurrentPrice(symbolTypes.NIFTY, true, nseOptionChainNiftyData);
      expiryDateService.updateExpiryDatesForSymbol(symbolTypes.NIFTY, nseOptionChainNiftyData);
      const filteredOptionChainNiftyData = optionChainService.getFilterdOptionChainData(
        nseOptionChainNiftyData.filtered.data
      );
      logger.info(filteredOptionChainNiftyData[0].strikePrice);
      // if (isCurrentTimeMatch(9, 20)) {
        optionChainService.updatePreStartForTodayScript(filteredOptionChainNiftyData, symbolTypes.NIFTY);
      // }
    }

    // const optionChainBankNiftyData = await miscService.getOptionChainData(symbolTypes.BANKNIFTY);
    // logger.info(`optionChainNiftyData :${optionChainBankNiftyData}`);
    // if (optionChainBankNiftyData) {
    //   symbolRateService.updateSymbolCurrentPrice(symbolTypes.BANKNIFTY, true, optionChainBankNiftyData);
    //   expiryDateService.updateExpiryDatesForSymbol(symbolTypes.BANKNIFTY, optionChainBankNiftyData);
    // }
  });

  cron.schedule('46 3 * * * ', () => {
    logger.info('running a task every 9:16 AM IST');
    // getCurrentDateTime();
  });

  cron.schedule('47 3 * * * ', () => {
    logger.info('running a task every 9:17 AM IST');
    // getCurrentDateTime();
  });

  cron.schedule('48 3 * * * ', () => {
    logger.info('running a task every 9:18 AM IST');
    // getCurrentDateTime();
  });

  cron.schedule('50 3 * * * ', () => {
    logger.info('running a task every 9:20 AM IST');
    // getCurrentDateTime();
  });
};

module.exports = {
  startCronTasks,
};
