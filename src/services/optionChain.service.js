const { getOptionChainData } = require('./misc.service');

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

module.exports = {
  queryOptionChain,
};
