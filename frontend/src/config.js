import deployedAddresses from "./deployedAddresses.json";

export const CHAIN_CONFIG = {
  1337: {
    chainIdHex: "0x539", // 1337
    chainName: "Hardhat Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [],
    faucetUrl: null,
  },
  2442: {
    chainIdHex: "0x98a", // 2442
    chainName: "Polygon zkEVM Cardona",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.cardona.zkevm-rpc.com"],
    blockExplorerUrls: ["https://explorer.zkevm-testnet.com"],
    faucetUrl: "https://www.alchemy.com/faucets/ethereum-sepolia",
  },
};

export const PREFERRED_CHAIN_ID = 1337;

export function getAddressForChain(chainId) {
  if (chainId == null) {
    return "";
  }
  return deployedAddresses[String(chainId)] || "";
}

export function supportedChainOptions() {
  return Object.entries(CHAIN_CONFIG)
    .map(([id, cfg]) => ({ id: Number(id), name: cfg.chainName }))
    .sort((a, b) => a.id - b.id);
}
