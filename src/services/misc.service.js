const axios = require('axios');
const logger = require('../config/logger');
const { optionURLs } = require('../config/optionChain');

const getOptionChainData = (symbol) =>
  new Promise((resolve) => {
    const optionChainURL = `${optionURLs.OPTIONCHAIN}${symbol}`;
    logger.info(optionChainURL);
    axios({
      withCredentials: true,
      url: optionChainURL,
    })
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(responseData);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve(null);
      });
  });

module.exports = {
  getOptionChainData,
};
