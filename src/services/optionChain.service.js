const { getOptionChainData, getTodayDate } = require('./misc.service');
const { getAllBlacklistedUsers } = require('./user.service');
const { getSettingByUserId } = require('./setting.service');
const { getOptionScriptByUserId } = require('./optionScript.service');
const { getTransactionsByUserTradeDatePreStart, createTransaction } = require('./transaction.service');
const logger = require('../config/logger');

/**
 * Get OptionScript by id
 * @param {ObjectId} id
 * @returns {Promise<OptionScript>}
 */
const queryOptionChain = async (filter) => {
  const opdata = await getOptionChainData(filter.symbol);
  const { data } = opdata.records;
  if (data) {
    const finalData = data.filter(function (item) {
      return item.expiryDate === filter.expiryDate;
    });
    const optionsChainData = [];
    finalData.forEach((iterationData) => {
      if (iterationData && 'PE' in iterationData) {
        const massageData = iterationData.PE;
        massageData.type = 'PE';
        optionsChainData.push(massageData);
      }
      if (iterationData && 'CE' in iterationData) {
        const massageData = iterationData.CE;
        massageData.type = 'CE';
        optionsChainData.push(massageData);
      }
    });

    return { data: optionsChainData };
  }
  return { data };
};

const getFilterdOptionChainData = (optionChainData) => {
  const filteredOptionChainData = [];
  optionChainData.forEach((iterationData) => {
    if (iterationData && 'PE' in iterationData) {
      const massageData = iterationData.PE;
      massageData.type = 'PE';
      filteredOptionChainData.push(massageData);
    }
    if (iterationData && 'CE' in iterationData) {
      const massageData = iterationData.CE;
      massageData.type = 'CE';
      filteredOptionChainData.push(massageData);
    }
  });
  return filteredOptionChainData;
};

const addPreStartForAllUserScripts = (user, setting, optionScript, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    logger.info(getTodayDate());
    const tradeDate = getTodayDate();
    getTransactionsByUserTradeDatePreStart(
      true,
      tradeDate,
      user._id,
      optionScript.type,
      optionScript.strikePrice,
      optionScript.underlying
    ).then((transaction) => {
      logger.info('transaction = ');
      logger.info(transaction);
      if (!transaction) {
        logger.info('transaction..');
        const optionChainDataArray = filteredOptionChainData.filter((ocData) => {
          return (
            optionScript.type === ocData.type &&
            optionScript.strikePrice === ocData.strikePrice &&
            optionScript.underlying === ocData.underlying
          );
        });
        if (optionChainDataArray.length > 0) {
          const optionChainData = optionChainDataArray[0];
          const preStratTransaction = {
            userId: user._id,
            strikePrice: optionScript.strikePrice,
            type: optionScript.type,
            expiryDate: optionScript.expiryDate,
            symbol: optionScript.underlying,
            tradeDate,
            capital: setting.capital,
            quantity: 0,
            boughtPrice: optionChainData.lastPrice,
            highestPrice: optionChainData.lastPrice,
            soldPrice: optionChainData.lastPrice,
            profit: 0,
            active: false,
            preStart: true,
            currentPrice: optionChainData.lastPrice,
          };
          createTransaction(preStratTransaction).then((transactionData) => {
            logger.info('createTransaction');
            resolve({ transaction: transactionData, success: true });
          });
        } else {
          logger.info('not createTransaction');
          resolve({ transaction: null, success: true });
        }
      } else {
        logger.info('not transaction..');
      }
    });
  });

const initPreStartForAllUserScripts = (user, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    getSettingByUserId(user._id).then(async (setting) => {
      const optionScripts = await getOptionScriptByUserId(user._id);
      const optionScriptsPromises = [];
      optionScripts.forEach((optionScript) => {
        optionScriptsPromises.push(
          addPreStartForAllUserScripts(user, setting, optionScript, filteredOptionChainData, symbol)
        );
      });
      Promise.all(optionScriptsPromises)
        .then((resArray) => {
          // do something with the responses
          logger.info('Prestart Executed for All Option Script.');
          resolve({ user, success: true });
        })
        .catch((error) => {
          // handle error
          logger.info(error);
        });
    });
  });

const updatePreStartForTodayScript = async (filteredOptionChainData, symbol) => {
  const nonBlacklistedUsers = await getAllBlacklistedUsers(false);
  const nonBlacklistedUserPromises = [];
  nonBlacklistedUsers.forEach((user) => {
    nonBlacklistedUserPromises.push(initPreStartForAllUserScripts(user, filteredOptionChainData, symbol));
  });
  Promise.all(nonBlacklistedUserPromises)
    .then((resArray) => {
      // do something with the responses
      logger.info('Prestart Executed for All users.');
    })
    .catch((error) => {
      // handle error
      logger.info(error);
    });
};

module.exports = {
  queryOptionChain,
  getFilterdOptionChainData,
  updatePreStartForTodayScript,
};
