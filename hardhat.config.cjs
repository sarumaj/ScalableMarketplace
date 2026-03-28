require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

function getAccounts(singleKeyName, multiKeyName) {
  const multi = (process.env[multiKeyName] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (multi.length > 0) {
    return multi;
  }

  const single = process.env[singleKeyName];
  return single ? [single] : [];
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    // Deprecated/inconsistent testnet support. Keep for demonstration only.
    polygonZkEVMTestnet: {
      url:
        process.env.POLYGON_ZKEVM_TESTNET_RPC_URL ||
        "https://rpc.cardona.zkevm-rpc.com",
      accounts: getAccounts(
        "POLYGON_ZKEVM_TESTNET_PRIVATE_KEY",
        "POLYGON_ZKEVM_TESTNET_PRIVATE_KEYS",
      ),
      chainId: Number(process.env.POLYGON_ZKEVM_TESTNET_CHAIN_ID || 2442),
    },
  },
};
