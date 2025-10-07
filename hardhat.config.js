require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 1000000000000, 
      gas: 1000000000000, 
      gasPrice: 20000000000, 
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20,
        accountsBalance: "1000000000000000000000000"
      }
    }
  }
};

