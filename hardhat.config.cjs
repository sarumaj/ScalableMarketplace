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
  // MOCHA_JUNIT names a file: the results as JUnit-style XML there instead of the
  // usual output, from Mocha's own xunit reporter (CI's test report reads it).
  mocha: process.env.MOCHA_JUNIT
    ? { reporter: "xunit", reporterOptions: { output: process.env.MOCHA_JUNIT } }
    : {},
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
