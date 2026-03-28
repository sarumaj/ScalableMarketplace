import { Contract, parseEther, formatEther } from "ethers";
import { useCallback, useMemo, useState } from "react";
import abi from "../abi.json";
import { humanizeError } from "../utils";

export function useMarketplace({ provider, signer, contractAddress }) {
  const [isBusy, setIsBusy] = useState(false);
  const [lastError, setLastError] = useState("");

  const ensureContractDeployed = useCallback(
    async (runnerProvider) => {
      if (!runnerProvider || !contractAddress) {
        return;
      }

      const [network, code] = await Promise.all([
        runnerProvider.getNetwork(),
        runnerProvider.getCode(contractAddress),
      ]);

      if (!code || code === "0x") {
        throw new Error(
          `No contract found at ${contractAddress} on chain ${Number(
            network.chainId,
          )}. Switch network or update contract address.`,
        );
      }
    },
    [contractAddress],
  );

  const readContract = useMemo(() => {
    if (!provider || !contractAddress) {
      return null;
    }
    return new Contract(contractAddress, abi, provider);
  }, [provider, contractAddress]);

  const writeContract = useMemo(() => {
    if (!signer || !contractAddress) {
      return null;
    }
    return new Contract(contractAddress, abi, signer);
  }, [signer, contractAddress]);

  const runTx = useCallback(
    async (factory) => {
      if (!writeContract) {
        throw new Error(
          "Connect wallet and provide a valid contract address first.",
        );
      }

      setIsBusy(true);
      setLastError("");

      try {
        await ensureContractDeployed(writeContract.runner.provider);
        const tx = await factory(writeContract);
        const receipt = await tx.wait();
        return {
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          status: receipt.status,
        };
      } catch (error) {
        const pretty = humanizeError(error);
        setLastError(pretty);
        throw new Error(pretty);
      } finally {
        setIsBusy(false);
      }
    },
    [writeContract],
  );

  const runRead = useCallback(
    async (factory) => {
      if (!readContract) {
        throw new Error("Provide a valid contract address first.");
      }

      setLastError("");

      try {
        await ensureContractDeployed(readContract.runner.provider);
        return await factory(readContract);
      } catch (error) {
        const pretty = humanizeError(error);
        setLastError(pretty);
        throw new Error(pretty);
      }
    },
    [ensureContractDeployed, readContract],
  );

  const actions = useMemo(
    () => ({
      parseEthToWei: (eth) => parseEther(eth),
      formatWeiToEth: (wei) => formatEther(wei),

      listItem: async (name, priceEth) =>
        runTx((c) => c.listItem(name, parseEther(priceEth))),

      batchListItems: async (names, pricesEth) =>
        runTx((c) =>
          c.batchListItems(
            names,
            pricesEth.map((price) => parseEther(price)),
          ),
        ),

      buyItem: async (itemId, valueWei) =>
        runTx((c) => c.buyItem(itemId, { value: valueWei })),

      batchBuyItems: async (itemIds, totalValueWei) =>
        runTx((c) => c.batchBuyItems(itemIds, { value: totalValueWei })),

      withdraw: async () => runTx((c) => c.withdraw()),

      getItem: async (itemId) => runRead((c) => c.items(itemId)),

      getUserBalance: async (userAddress) =>
        runRead((c) => c.userBalance(userAddress)),

      getItemCount: async () => runRead((c) => c.itemCount()),

      getMaxBatchSize: async () => runRead((c) => c.MAX_BATCH_SIZE()),

      getUserItems: async (userAddress) =>
        runRead((c) => c.getUserItems(userAddress)),

      batchGetItems: async (itemIds) =>
        runRead((c) => c.batchGetItems(itemIds)),

      calculateItemPriceWei: async (itemId) => {
        const item = await runRead((c) => c.items(itemId));
        return item.price;
      },

      calculateBatchPriceWei: async (itemIds) => {
        const items = await runRead((c) => c.batchGetItems(itemIds));
        return items.reduce((sum, item) => sum + item.price, 0n);
      },
    }),
    [runRead, runTx],
  );

  return {
    isBusy,
    lastError,
    actions,
  };
}
