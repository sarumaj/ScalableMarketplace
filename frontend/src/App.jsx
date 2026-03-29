import { useEffect, useMemo, useState } from "react";
import { isAddress } from "ethers";
import {
  getAddressForChain,
  supportedChainOptions,
  PREFERRED_CHAIN_ID,
} from "./config";
import { useWeb3 } from "./hooks/useWeb3";
import { useMarketplace } from "./hooks/useMarketplace";
import AccountCorner from "./components/AccountCorner";
import WorkspaceHeader from "./components/WorkspaceHeader";
import TabStrip from "./components/TabStrip";
import SessionPanel from "./components/SessionPanel";
import SellerPanels from "./components/SellerPanels";
import BuyerPanels from "./components/BuyerPanels";
import ExplorerPanels from "./components/ExplorerPanels";
import {
  humanizeError,
  parseCsvBigInts,
  parseCsvStrings,
  serializeResult,
  shortAddress,
} from "./utils";

function App() {
  const {
    hasMetaMask,
    provider,
    signer,
    account,
    availableAccounts,
    chainId,
    chainName,
    currentChainConfig,
    isConnecting,
    isRequestingAccountAccess,
    error: walletError,
    connectWallet,
    requestAccountAccess,
    selectAccount,
    switchNetwork,
  } = useWeb3();

  const [contractAddress, setContractAddress] = useState("");
  const [preferredChainId, setPreferredChainId] = useState(PREFERRED_CHAIN_ID);
  const [output, setOutput] = useState("Ready.");

  const [listName, setListName] = useState("Keyboard");
  const [listPrice, setListPrice] = useState("0.001");

  const [batchNames, setBatchNames] = useState("Mouse, Headset, USB Hub");
  const [batchPrices, setBatchPrices] = useState("0.001, 0.002, 0.0015");

  const [buyItemId, setBuyItemId] = useState("0");
  const [batchBuyIds, setBatchBuyIds] = useState("0,1");

  const [lookupItemId, setLookupItemId] = useState("0");
  const [lookupItemIds, setLookupItemIds] = useState("0,1,2");
  const [activeTab, setActiveTab] = useState("session");

  const supportedChains = useMemo(() => supportedChainOptions(), []);

  useEffect(() => {
    const detectedAddress = getAddressForChain(chainId);
    if (detectedAddress) {
      setContractAddress(detectedAddress);
      return;
    }

    const preferredAddress = getAddressForChain(PREFERRED_CHAIN_ID);
    if (preferredAddress) {
      setContractAddress(preferredAddress);
    }
  }, [chainId]);

  const { isBusy, lastError, actions } = useMarketplace({
    provider,
    signer,
    contractAddress,
  });

  const statusTone = useMemo(() => {
    if (!hasMetaMask) {
      return "warn";
    }
    if (!account) {
      return "idle";
    }
    if (!currentChainConfig) {
      return "warn";
    }
    if (!contractAddress) {
      return "warn";
    }
    return "ok";
  }, [hasMetaMask, account, currentChainConfig, contractAddress]);

  const setResult = (label, value) => {
    setOutput(`${label}\n\n${serializeResult(value)}`);
  };

  const runAction = async (label, fn, options = {}) => {
    try {
      if (options.needsWallet) {
        setOutput(`${label}\n\nStep 1/2: Waiting for wallet confirmation...`);
      } else {
        setOutput(`${label}\n\nRunning query...`);
      }

      const result = await fn();

      if (options.needsWallet) {
        setOutput(
          `${label}\n\nStep 2/2: Transaction confirmed on-chain.\n\n${serializeResult(
            result,
          )}`,
        );
      } else {
        setResult(label, result);
      }
    } catch (error) {
      setOutput(`${label} failed\n\n${humanizeError(error)}`);
    }
  };

  const connectLabel = isConnecting ? "Connecting..." : "Connect MetaMask";

  const hasValidContractAddress = useMemo(
    () => Boolean(contractAddress) && isAddress(contractAddress),
    [contractAddress],
  );

  const baseWriteBlockReason = useMemo(() => {
    if (!hasMetaMask) {
      return "Install MetaMask first.";
    }
    if (!account) {
      return "Connect wallet first.";
    }
    if (!currentChainConfig) {
      return "Switch to a supported network.";
    }
    if (!contractAddress) {
      return "Set marketplace address first.";
    }
    if (!hasValidContractAddress) {
      return "Marketplace address is not valid.";
    }
    return "";
  }, [
    account,
    contractAddress,
    currentChainConfig,
    hasMetaMask,
    hasValidContractAddress,
  ]);

  const canRunReads = Boolean(currentChainConfig && hasValidContractAddress);

  const isPositiveNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  };

  const isNonNegativeInteger = (value) => /^[0-9]+$/.test(String(value).trim());

  const batchListValidation = useMemo(() => {
    const names = parseCsvStrings(batchNames);
    const prices = parseCsvStrings(batchPrices);

    if (!names.length) {
      return "Add at least one product name.";
    }
    if (names.length !== prices.length) {
      return "Names and prices count must match.";
    }
    if (prices.some((price) => !isPositiveNumber(price))) {
      return "All batch prices must be greater than 0.";
    }
    return "";
  }, [batchNames, batchPrices]);

  const batchBuyValidation = useMemo(() => {
    try {
      const ids = parseCsvBigInts(batchBuyIds);
      if (!ids.length) {
        return "Add at least one listing id.";
      }
      if (ids.some((id) => id < 0n)) {
        return "Listing ids cannot be negative.";
      }
      return "";
    } catch {
      return "Listing ids must be comma-separated integers.";
    }
  }, [batchBuyIds]);

  const batchReadValidation = useMemo(() => {
    try {
      const ids = parseCsvBigInts(lookupItemIds);
      if (!ids.length) {
        return "Add at least one listing id.";
      }
      if (ids.some((id) => id < 0n)) {
        return "Listing ids cannot be negative.";
      }
      return "";
    } catch {
      return "Listing ids must be comma-separated integers.";
    }
  }, [lookupItemIds]);

  const writeActionsBlocked = Boolean(baseWriteBlockReason || isBusy);
  const readActionsBlocked = Boolean(!canRunReads || isBusy);

  const statusChips = useMemo(
    () => [
      {
        key: "wallet",
        label: hasMetaMask
          ? account
            ? "Wallet Connected"
            : "Wallet Not Connected"
          : "MetaMask Missing",
        tone: hasMetaMask ? (account ? "ok" : "warn") : "danger",
      },
      {
        key: "network",
        label: currentChainConfig ? "Network Supported" : "Wrong Network",
        tone: currentChainConfig ? "ok" : "warn",
      },
      {
        key: "contract",
        label: hasValidContractAddress
          ? "Contract Address Valid"
          : "Contract Address Invalid",
        tone: hasValidContractAddress ? "ok" : "warn",
      },
      {
        key: "busy",
        label: isBusy ? "Action Pending" : "Ready",
        tone: isBusy ? "warn" : "ok",
      },
    ],
    [account, currentChainConfig, hasMetaMask, hasValidContractAddress, isBusy],
  );

  return (
    <div className="app-shell">
      <div className="bg-grid" />

      <section className="hero-row">
        <header className="hero">
          <p className="eyebrow">Marketplace Demo</p>
          <h1>Local Marketplace</h1>
          <p className="hero-copy">
            List products, buy items, and manage payouts in one place.
          </p>
        </header>

        <AccountCorner
          account={account}
          availableAccounts={availableAccounts}
          hasMetaMask={hasMetaMask}
          isConnecting={isConnecting}
          isRequestingAccountAccess={isRequestingAccountAccess}
          requestAccountAccess={requestAccountAccess}
          selectAccount={selectAccount}
          shortAddress={shortAddress}
        />
      </section>

      <WorkspaceHeader activeTab={activeTab} statusChips={statusChips} />

      <TabStrip
        activeTab={activeTab}
        isBusy={isBusy}
        setActiveTab={setActiveTab}
      />

      {activeTab === "session" && (
        <SessionPanel
          account={account}
          chainId={chainId}
          chainName={chainName}
          connectLabel={connectLabel}
          connectWallet={connectWallet}
          contractAddress={contractAddress}
          hasMetaMask={hasMetaMask}
          isConnecting={isConnecting}
          isRequestingAccountAccess={isRequestingAccountAccess}
          lastError={lastError}
          preferredChainId={preferredChainId}
          requestAccountAccess={requestAccountAccess}
          setContractAddress={setContractAddress}
          setPreferredChainId={setPreferredChainId}
          shortAddress={shortAddress}
          statusTone={statusTone}
          supportedChains={supportedChains}
          switchNetwork={switchNetwork}
          walletError={walletError}
        />
      )}

      {activeTab !== "session" && (
        <section className="actions-grid compact-grid">
          {activeTab === "seller" && (
            <SellerPanels
              actions={actions}
              baseWriteBlockReason={baseWriteBlockReason}
              batchListValidation={batchListValidation}
              batchNames={batchNames}
              batchPrices={batchPrices}
              isPositiveNumber={isPositiveNumber}
              listName={listName}
              listPrice={listPrice}
              runAction={runAction}
              setBatchNames={setBatchNames}
              setBatchPrices={setBatchPrices}
              setListName={setListName}
              setListPrice={setListPrice}
              writeActionsBlocked={writeActionsBlocked}
            />
          )}

          {activeTab === "buyer" && (
            <BuyerPanels
              actions={actions}
              baseWriteBlockReason={baseWriteBlockReason}
              batchBuyIds={batchBuyIds}
              batchBuyValidation={batchBuyValidation}
              buyItemId={buyItemId}
              isNonNegativeInteger={isNonNegativeInteger}
              runAction={runAction}
              setBatchBuyIds={setBatchBuyIds}
              setBuyItemId={setBuyItemId}
              writeActionsBlocked={writeActionsBlocked}
            />
          )}

          {activeTab === "explorer" && (
            <ExplorerPanels
              account={account}
              actions={actions}
              batchReadValidation={batchReadValidation}
              canRunReads={canRunReads}
              isNonNegativeInteger={isNonNegativeInteger}
              lookupItemId={lookupItemId}
              lookupItemIds={lookupItemIds}
              readActionsBlocked={readActionsBlocked}
              runAction={runAction}
              setLookupItemId={setLookupItemId}
              setLookupItemIds={setLookupItemIds}
              shortAddress={shortAddress}
            />
          )}
        </section>
      )}

      <section className="panel output-panel">
        <h2>Activity Log</h2>
        <pre>{output}</pre>
      </section>
    </div>
  );
}

export default App;
