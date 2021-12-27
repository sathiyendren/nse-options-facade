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
  logger.info(` #### Current Time :: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()} ####`);
  return now.getHours() === hour && now.getMinutes() === minute;
};

const getCurrentDateTime = () => {
  const now = new Date();
  logger.info(`Current Time :: ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`);
};

/**
 * Starts All Cron Tasks
 */
const startCronTasks = () => {
  cron.schedule('*/15 * * * *', () => {
    logger.info('running a task every 15 minute');
    herokuKeepAliveCall();
  });

  cron.schedule('*/5 * * * * *', async () => {
    logger.info('----------------------------------');
    getCurrentDateTime();
    logger.info('running a task every 10 seconds');
    const nseOptionChainNiftyData = await miscService.getOptionChainData(symbolTypes.NIFTY);
    // logger.info(`nseOptionChainNiftyData :${nseOptionChainNiftyData}`);
    if (nseOptionChainNiftyData) {
      symbolRateService.updateSymbolCurrentPrice(symbolTypes.NIFTY, true, nseOptionChainNiftyData);
      expiryDateService.updateExpiryDatesForSymbol(symbolTypes.NIFTY, nseOptionChainNiftyData);
      const filteredOptionChainNiftyData = optionChainService.getFilterdOptionChainData(
        nseOptionChainNiftyData.filtered.data
      );
      if (isCurrentTimeMatch(9, 20)) {
        optionChainService.runPreStartForTodayScript(filteredOptionChainNiftyData, symbolTypes.NIFTY);
      }
      optionChainService.runBuyForTodayScript(filteredOptionChainNiftyData, symbolTypes.NIFTY);
      optionChainService.runSellForTodayScript(filteredOptionChainNiftyData, symbolTypes.NIFTY);
      if (isCurrentTimeMatch(3, 20)) {
        optionChainService.runSellAllForTodayScript(filteredOptionChainNiftyData, symbolTypes.NIFTY);
      }
    }

    const nseOptionChainBankNiftyData = await miscService.getOptionChainData(symbolTypes.BANKNIFTY);
    // logger.info(`nseOptionChainBankNiftyData :${nseOptionChainBankNiftyData}`);
    if (nseOptionChainBankNiftyData) {
      symbolRateService.updateSymbolCurrentPrice(symbolTypes.BANKNIFTY, true, nseOptionChainBankNiftyData);
      expiryDateService.updateExpiryDatesForSymbol(symbolTypes.BANKNIFTY, nseOptionChainBankNiftyData);
      const filteredOptionChainBankNiftyData = optionChainService.getFilterdOptionChainData(
        nseOptionChainBankNiftyData.filtered.data
      );
      if (isCurrentTimeMatch(9, 20)) {
        optionChainService.runPreStartForTodayScript(filteredOptionChainBankNiftyData, symbolTypes.BANKNIFTY);
      }
      optionChainService.runBuyForTodayScript(filteredOptionChainBankNiftyData, symbolTypes.BANKNIFTY);
      optionChainService.runSellForTodayScript(filteredOptionChainBankNiftyData, symbolTypes.BANKNIFTY);
      if (isCurrentTimeMatch(3, 20)) {
        optionChainService.runSellAllForTodayScript(filteredOptionChainBankNiftyData, symbolTypes.BANKNIFTY);
      }
    }
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
