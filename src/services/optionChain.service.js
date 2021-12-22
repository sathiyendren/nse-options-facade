const httpStatus = require('http-status');
const https = require('https');
const axios = require('axios');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const getOptionChainData = (symbol) =>
  new Promise((resolve) => {
    const optionChainURL = `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`;
    logger.info(optionChainURL);
    axios({
      withCredentials: true,
      url: optionChainURL,
    })
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(responseData.records.data);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve(null);
      });
  });

/**
 * Get OptionScript by id
 * @param {ObjectId} id
 * @returns {Promise<OptionScript>}
 */
const queryOptionChain = async (filter) => {
  const data = await getOptionChainData(filter.symbol);
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

module.exports = {
  queryOptionChain,
};
