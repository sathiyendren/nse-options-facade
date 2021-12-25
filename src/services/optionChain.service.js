const { getOptionChainData, getTodayDate } = require('./misc.service');
const { getAllBlacklistedUsers } = require('./user.service');
const { getSettingByUserId } = require('./setting.service');
const { getOptionScriptByUserId } = require('./optionScript.service');
const {
  getTransactionsByUserTradeDatePreStart,
  getLastTransactionByUserTradeDateBuy,
  getLastTransactionByActiveUserTradeDateSell,
  createTransaction,
  updateTransactionById,
} = require('./transaction.service');
const logger = require('../config/logger');
const { tradingTypes } = require('../config/setting');
const { lotSizes, symbolTypes } = require('../config/optionScript');
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
            capital: 0,
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
      if (setting.tradingType !== tradingTypes.NORMAL) {
        resolve({ user, success: false });
        return;
      }
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
          resolve({ user, success: false });
        });
    });
  });

const runPreStartForTodayScript = async (filteredOptionChainData, symbol) => {
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

const addBuyCheckForAllUserScripts = (user, setting, optionScript, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    logger.info(getTodayDate());
    const tradeDate = getTodayDate();
    getLastTransactionByUserTradeDateBuy(
      tradeDate,
      user._id,
      optionScript.type,
      optionScript.strikePrice,
      optionScript.underlying
    ).then((lastTransactions) => {
      const lastTransaction = lastTransactions[0];
      if (lastTransaction && !lastTransaction.active) {
        logger.info('!!!Transaction = ');
        logger.info(lastTransaction);
        const optionChainDataArray = filteredOptionChainData.filter((ocData) => {
          return (
            optionScript.type === ocData.type &&
            optionScript.strikePrice === ocData.strikePrice &&
            optionScript.underlying === ocData.underlying
          );
        });
        if (optionChainDataArray.length > 0) {
          const optionChainData = optionChainDataArray[0];
          const currentPrice = optionChainData.lastPrice;
          logger.info(`currentPrice :: ${currentPrice}`);
          const lotSize = optionChainData.underlying === symbolTypes.NIFTY ? lotSizes.NIFTY : lotSizes.BANKNIFTY;
          logger.info(`lotSize :: ${lotSize}`);
          const quantity = Math.round(setting.capital / (lotSize * currentPrice)) * lotSize;
          logger.info(`quantity :: ${quantity}`);
          const capital = currentPrice * quantity;
          logger.info(`capital :: ${capital}`);
          const buyTransaction = {
            userId: user._id,
            strikePrice: optionScript.strikePrice,
            type: optionScript.type,
            expiryDate: optionScript.expiryDate,
            symbol: optionScript.underlying,
            tradeDate,
            capital,
            quantity,
            boughtPrice: currentPrice,
            highestPrice: currentPrice,
            soldPrice: 0,
            profit: 0,
            active: true,
            preStart: false,
            currentPrice,
          };
          const ltSoldPrice = lastTransaction.soldPrice;
          logger.info(`ltSoldPrice :: ${ltSoldPrice}`);
          const ltLotSizeSoldPrice = optionChainData.underlying === symbolTypes.NIFTY ? lotSizes.NIFTY : lotSizes.BANKNIFTY;
          logger.info(`ltLotSizeSoldPrice :: ${ltLotSizeSoldPrice}`);
          const ltQuantitySoldPrice = Math.round(setting.capital / (ltLotSizeSoldPrice * ltSoldPrice)) * ltLotSizeSoldPrice;
          logger.info(`ttt :: ${setting.capital / (ltLotSizeSoldPrice * ltSoldPrice)}`);
          logger.info(`ltQuantitySoldPrice :: ${ltQuantitySoldPrice}`);
          const capitalDifference = ltQuantitySoldPrice * (currentPrice - ltSoldPrice);
          logger.info(`capitalDifference :: ${capitalDifference}`);
          const firstBuyCusionCaptial = (setting.capital * setting.firstBuyConstant) / 100;
          logger.info(`firstBuyCusionCaptial :: ${firstBuyCusionCaptial}`);
          const isBuyCondition = lastTransaction.preStart
            ? capitalDifference > firstBuyCusionCaptial
            : currentPrice > ltSoldPrice;
          if (isBuyCondition) {
            logger.info(`BOUGHT SCRIPT!!!`);
            // implement ALGOMOJO api buy
            createTransaction(buyTransaction).then((transactionData) => {
              logger.info('buy Transaction');
              resolve({ transaction: transactionData, success: true });
            });
          }
        } else {
          logger.info('not buy Transaction');
          resolve({ transaction: null, success: true });
        }
      } else {
        logger.info('not buy transaction..');
      }
    });
  });

const initBuyForAllUserScripts = (user, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    getSettingByUserId(user._id).then(async (setting) => {
      const optionScripts = await getOptionScriptByUserId(user._id);
      const optionScriptsPromises = [];
      optionScripts.forEach((optionScript) => {
        optionScriptsPromises.push(
          addBuyCheckForAllUserScripts(user, setting, optionScript, filteredOptionChainData, symbol)
        );
      });
      Promise.all(optionScriptsPromises)
        .then((resArray) => {
          // do something with the responses
          logger.info('Buy Executed for All Option Script.');
          resolve({ user, success: true });
        })
        .catch((error) => {
          // handle error
          logger.info(error);
          resolve({ user, success: false });
        });
    });
  });

const runBuyForTodayScript = async (filteredOptionChainData, symbol) => {
  const nonBlacklistedUsers = await getAllBlacklistedUsers(false);
  const nonBlacklistedUserPromises = [];
  nonBlacklistedUsers.forEach((user) => {
    nonBlacklistedUserPromises.push(initBuyForAllUserScripts(user, filteredOptionChainData, symbol));
  });
  Promise.all(nonBlacklistedUserPromises)
    .then((resArray) => {
      // do something with the responses
      logger.info('Buy Check Executed for All users.');
    })
    .catch((error) => {
      // handle error
      logger.info(error);
    });
};

const addSellCheckForAllUserScripts = (user, setting, optionScript, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    logger.info(getTodayDate());
    const tradeDate = getTodayDate();
    getLastTransactionByActiveUserTradeDateSell(
      true,
      tradeDate,
      user._id,
      optionScript.type,
      optionScript.strikePrice,
      optionScript.underlying
    ).then((lastTransactions) => {
      const lastTransaction = lastTransactions[0];
      if (lastTransaction && lastTransaction.active) {
        logger.info('!!!Transaction = ');
        logger.info(lastTransaction);
        const optionChainDataArray = filteredOptionChainData.filter((ocData) => {
          return (
            optionScript.type === ocData.type &&
            optionScript.strikePrice === ocData.strikePrice &&
            optionScript.underlying === ocData.underlying
          );
        });
        if (optionChainDataArray.length > 0) {
          const optionChainData = optionChainDataArray[0];
          const currentPrice = optionChainData.lastPrice;
          const { boughtPrice } = lastTransaction;
          logger.info(`boughtPrice :: ${boughtPrice}`);
          const { highestPrice } = lastTransaction;
          logger.info(`highestPrice :: ${highestPrice}`);
          const capitalDifference = lastTransaction.quantity * (highestPrice - currentPrice);
          logger.info(`capitalDifference :: ${capitalDifference}`);
          const rebuyBuyCusionCaptial = (setting.capital * setting.reBuyConstant) / 100;
          logger.info(`reBuyCusionCaptial :: ${rebuyBuyCusionCaptial}`);
          const isSellCondition = capitalDifference > rebuyBuyCusionCaptial;

          if (isSellCondition) {
            logger.info(`SELL SCRIPT!!!`);
            // implement ALGOMOJO api Sell

            const sellTransaction = {
              userId: user._id,
              strikePrice: optionScript.strikePrice,
              type: optionScript.type,
              expiryDate: optionScript.expiryDate,
              symbol: optionScript.underlying,
              tradeDate,
              soldPrice: currentPrice,
              active: false,
              currentPrice,
            };

            updateTransactionById(lastTransaction._id, sellTransaction).then((transactionData) => {
              logger.info('sell Transaction');
              resolve({ transaction: transactionData, success: true });
            });
          } else {
            const sellTransaction = {
              userId: user._id,
              strikePrice: optionScript.strikePrice,
              type: optionScript.type,
              expiryDate: optionScript.expiryDate,
              symbol: optionScript.underlying,
              tradeDate,
              highestPrice: currentPrice > highestPrice ? currentPrice : highestPrice,
              active: true,
              currentPrice,
            };
            updateTransactionById(lastTransaction._id, sellTransaction).then((transactionData) => {
              logger.info('update Transaction');
              resolve({ transaction: transactionData, success: true });
            });
          }
        } else {
          logger.info('not sell Transaction');
          resolve({ transaction: null, success: true });
        }
      } else {
        logger.info('not sell transaction..');
      }
    });
  });

const initSellForAllUserScripts = (user, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    getSettingByUserId(user._id).then(async (setting) => {
      const optionScripts = await getOptionScriptByUserId(user._id);
      const optionScriptsPromises = [];
      optionScripts.forEach((optionScript) => {
        optionScriptsPromises.push(
          addSellCheckForAllUserScripts(user, setting, optionScript, filteredOptionChainData, symbol)
        );
      });
      Promise.all(optionScriptsPromises)
        .then((resArray) => {
          // do something with the responses
          logger.info('Sell Executed for All Option Script.');
          resolve({ user, success: true });
        })
        .catch((error) => {
          // handle error
          logger.info(error);
          resolve({ user, success: false });
        });
    });
  });

const runSellForTodayScript = async (filteredOptionChainData, symbol) => {
  const nonBlacklistedUsers = await getAllBlacklistedUsers(false);
  const nonBlacklistedUserPromises = [];
  nonBlacklistedUsers.forEach((user) => {
    nonBlacklistedUserPromises.push(initSellForAllUserScripts(user, filteredOptionChainData, symbol));
  });
  Promise.all(nonBlacklistedUserPromises)
    .then((resArray) => {
      // do something with the responses
      logger.info('Sell Check Executed for All users.');
    })
    .catch((error) => {
      // handle error
      logger.info(error);
    });
};

const addSellAllCheckForAllUserScripts = (user, setting, optionScript, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    logger.info(getTodayDate());
    const tradeDate = getTodayDate();
    getLastTransactionByActiveUserTradeDateSell(
      true,
      tradeDate,
      user._id,
      optionScript.type,
      optionScript.strikePrice,
      optionScript.underlying
    ).then((lastTransactions) => {
      const lastTransaction = lastTransactions[0];
      if (lastTransaction && lastTransaction.active) {
        logger.info('!!!Transaction = ');
        logger.info(lastTransaction);
        const optionChainDataArray = filteredOptionChainData.filter((ocData) => {
          return (
            optionScript.type === ocData.type &&
            optionScript.strikePrice === ocData.strikePrice &&
            optionScript.underlying === ocData.underlying
          );
        });
        if (optionChainDataArray.length > 0) {
          const optionChainData = optionChainDataArray[0];
          const currentPrice = optionChainData.lastPrice;
          logger.info(`SELL SCRIPT!!!`);
          // implement ALGOMOJO api Sell

          const sellTransaction = {
            userId: user._id,
            strikePrice: optionScript.strikePrice,
            type: optionScript.type,
            expiryDate: optionScript.expiryDate,
            symbol: optionScript.underlying,
            tradeDate,
            soldPrice: currentPrice,
            active: false,
            currentPrice,
          };

          updateTransactionById(lastTransaction._id, sellTransaction).then((transactionData) => {
            logger.info('sell Transaction');
            resolve({ transaction: transactionData, success: true });
          });
        } else {
          logger.info('not sell Transaction');
          resolve({ transaction: null, success: true });
        }
      } else {
        logger.info('not sell transaction..');
      }
    });
  });

const initSellAllForAllUserScripts = (user, filteredOptionChainData, symbol) =>
  new Promise((resolve) => {
    getSettingByUserId(user._id).then(async (setting) => {
      const optionScripts = await getOptionScriptByUserId(user._id);
      const optionScriptsPromises = [];
      optionScripts.forEach((optionScript) => {
        optionScriptsPromises.push(
          addSellAllCheckForAllUserScripts(user, setting, optionScript, filteredOptionChainData, symbol)
        );
      });
      Promise.all(optionScriptsPromises)
        .then((resArray) => {
          // do something with the responses
          logger.info('Sell Executed for All Option Script.');
          resolve({ user, success: true });
        })
        .catch((error) => {
          // handle error
          logger.info(error);
          resolve({ user, success: false });
        });
    });
  });

const runSellAllForTodayScript = async (filteredOptionChainData, symbol) => {
  const nonBlacklistedUsers = await getAllBlacklistedUsers(false);
  const nonBlacklistedUserPromises = [];
  nonBlacklistedUsers.forEach((user) => {
    nonBlacklistedUserPromises.push(initSellAllForAllUserScripts(user, filteredOptionChainData, symbol));
  });
  Promise.all(nonBlacklistedUserPromises)
    .then((resArray) => {
      // do something with the responses
      logger.info('Sell Check Executed for All users.');
    })
    .catch((error) => {
      // handle error
      logger.info(error);
    });
};

module.exports = {
  queryOptionChain,
  getFilterdOptionChainData,
  runPreStartForTodayScript,
  runBuyForTodayScript,
  runSellForTodayScript,
};
