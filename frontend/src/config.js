import deployedAddresses from "./deployedAddresses.json";

export const CHAIN_CONFIG = {
  1337: {
    chainIdHex: "0x539",
    chainName: "Hardhat Local",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [],
    faucetUrl: null,
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
