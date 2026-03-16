require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/eE5l6xAi0_SHcPF33aXpy",
      accounts: ["b7e0f7247f65d0a0cb6f3b7bdaaf77e05daf840acf6cf3b49aff0ef65da4c8d9"]
    }
  }
};