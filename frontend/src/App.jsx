import { useEffect, useMemo, useState } from "react";
import { isAddress } from "ethers";
import {
  getAddressForChain,
  supportedChainOptions,
  PREFERRED_CHAIN_ID,
} from "./config";
import { useWeb3 } from "./hooks/useWeb3";
import { useMarketplace } from "./hooks/useMarketplace";
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

        <section className="panel global-account-corner">
          <label>
            Account
            <select
              value={account || ""}
              onChange={(event) => selectAccount(event.target.value)}
              disabled={!hasMetaMask || availableAccounts.length === 0}
            >
              {availableAccounts.length === 0 ? (
                <option value="">No accounts</option>
              ) : (
                availableAccounts.map((address) => (
                  <option key={address} value={address}>
                    {shortAddress(address)}
                  </option>
                ))
              )}
            </select>
          </label>

          <button
            disabled={!hasMetaMask || isRequestingAccountAccess || isConnecting}
            onClick={requestAccountAccess}
          >
            {isRequestingAccountAccess ? "Requesting..." : "Access"}
          </button>
        </section>
      </section>

      <section className="section-head">
        <h2>Workspace</h2>
        <p className="section-copy">
          {activeTab === "session" &&
            "Connect wallet, choose account, and set contract/network options."}
          {activeTab === "seller" &&
            "Create listings, publish inventory, and withdraw earnings."}
          {activeTab === "buyer" &&
            "Buy individual items or complete a batch checkout."}
          {activeTab === "explorer" &&
            "Inspect listings, balances, limits, and seller activity."}
        </p>
        <div className="status-chip-row">
          {statusChips.map((chip) => (
            <span key={chip.key} className={`status-chip ${chip.tone}`}>
              {chip.label}
            </span>
          ))}
        </div>
      </section>

      <section className="tab-strip panel">
        <button
          className={`tab-button ${activeTab === "session" ? "active" : ""}`}
          onClick={() => setActiveTab("session")}
          disabled={isBusy}
        >
          Session
        </button>
        <button
          className={`tab-button ${activeTab === "seller" ? "active" : ""}`}
          onClick={() => setActiveTab("seller")}
          disabled={isBusy}
        >
          Seller
        </button>
        <button
          className={`tab-button ${activeTab === "buyer" ? "active" : ""}`}
          onClick={() => setActiveTab("buyer")}
          disabled={isBusy}
        >
          Buyer
        </button>
        <button
          className={`tab-button ${activeTab === "explorer" ? "active" : ""}`}
          onClick={() => setActiveTab("explorer")}
          disabled={isBusy}
        >
          Explorer
        </button>
      </section>

      {activeTab === "session" && (
        <section className={`panel status-panel tone-${statusTone}`}>
          <div className="status-summary">
            <h2>Wallet and Session</h2>
            <p>
              Active account:{" "}
              {account ? shortAddress(account) : "Not connected"}
            </p>
            <p>Network: {chainId ? `${chainName} (${chainId})` : "Unknown"}</p>
          </div>

          <div className="status-actions">
            {!account ? (
              <button
                disabled={!hasMetaMask || isConnecting}
                onClick={connectWallet}
              >
                {connectLabel}
              </button>
            ) : (
              <button
                disabled={
                  !hasMetaMask || isRequestingAccountAccess || isConnecting
                }
                onClick={requestAccountAccess}
              >
                {isRequestingAccountAccess
                  ? "Requesting Access..."
                  : "Manage Access"}
              </button>
            )}

            <label className="address-input">
              Marketplace address
              <input
                value={contractAddress}
                onChange={(event) =>
                  setContractAddress(event.target.value.trim())
                }
                placeholder="0x..."
              />
            </label>

            <label>
              Target network
              <select
                value={preferredChainId}
                onChange={(event) =>
                  setPreferredChainId(Number(event.target.value))
                }
              >
                {supportedChainOptions().map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} ({chain.id})
                  </option>
                ))}
              </select>
            </label>

            <button
              disabled={!hasMetaMask}
              onClick={() => switchNetwork(preferredChainId)}
            >
              Switch Network
            </button>
          </div>

          {!hasMetaMask && (
            <p className="note">
              MetaMask is required. Install extension:
              https://metamask.io/download/
            </p>
          )}

          {(walletError || lastError) && (
            <p className="error-text">{walletError || lastError}</p>
          )}

          {account && (
            <p className="note">
              MetaMask only exposes accounts you explicitly grant to this app.
              Use "Manage Access" to add more accounts to the dropdown.
            </p>
          )}
        </section>
      )}

      {activeTab !== "session" && (
        <section className="actions-grid compact-grid">
          {activeTab === "seller" && (
            <>
              <article className="panel">
                <h3>Create Listing</h3>
                <label>
                  Product name
                  <input
                    value={listName}
                    onChange={(event) => setListName(event.target.value)}
                  />
                </label>
                <label>
                  Price (ETH)
                  <input
                    value={listPrice}
                    onChange={(event) => setListPrice(event.target.value)}
                  />
                </label>
                <button
                  disabled={
                    writeActionsBlocked ||
                    !listName.trim() ||
                    !isPositiveNumber(listPrice)
                  }
                  title={
                    baseWriteBlockReason ||
                    (!listName.trim() ? "Enter a product name." : "") ||
                    (!isPositiveNumber(listPrice)
                      ? "Price must be greater than 0."
                      : "")
                  }
                  onClick={() =>
                    runAction(
                      "listItem",
                      () => actions.listItem(listName, listPrice),
                      { needsWallet: true },
                    )
                  }
                >
                  Publish Listing
                </button>
              </article>

              <article className="panel">
                <h3>Bulk List Inventory</h3>
                <label>
                  Product names (comma separated)
                  <input
                    value={batchNames}
                    onChange={(event) => setBatchNames(event.target.value)}
                  />
                </label>
                <label>
                  Prices in ETH (comma separated)
                  <input
                    value={batchPrices}
                    onChange={(event) => setBatchPrices(event.target.value)}
                  />
                </label>
                <button
                  disabled={writeActionsBlocked || Boolean(batchListValidation)}
                  title={baseWriteBlockReason || batchListValidation}
                  onClick={() =>
                    runAction(
                      "batchListItems",
                      () =>
                        actions.batchListItems(
                          parseCsvStrings(batchNames),
                          parseCsvStrings(batchPrices),
                        ),
                      { needsWallet: true },
                    )
                  }
                >
                  Publish in Batch
                </button>
              </article>

              <article className="panel">
                <h3>Withdraw Earnings</h3>
                <p className="subtle">
                  Move your accumulated seller balance to your wallet.
                </p>
                <button
                  disabled={writeActionsBlocked}
                  title={baseWriteBlockReason}
                  onClick={() =>
                    runAction("withdraw", () => actions.withdraw(), {
                      needsWallet: true,
                    })
                  }
                >
                  Withdraw Now
                </button>
              </article>
            </>
          )}

          {activeTab === "buyer" && (
            <>
              <article className="panel">
                <h3>Buy Single Item</h3>
                <label>
                  Listing ID
                  <input
                    value={buyItemId}
                    onChange={(event) => setBuyItemId(event.target.value)}
                  />
                </label>
                <button
                  disabled={
                    writeActionsBlocked || !isNonNegativeInteger(buyItemId)
                  }
                  title={
                    baseWriteBlockReason ||
                    (!isNonNegativeInteger(buyItemId)
                      ? "Listing ID must be a non-negative integer."
                      : "")
                  }
                  onClick={() =>
                    runAction(
                      "buyItem",
                      async () => {
                        const itemId = BigInt(buyItemId);
                        const value = await actions.calculateItemPriceWei(
                          itemId,
                        );
                        return actions.buyItem(itemId, value);
                      },
                      { needsWallet: true },
                    )
                  }
                >
                  Buy at Exact Price
                </button>
              </article>

              <article className="panel">
                <h3>Batch Checkout</h3>
                <label>
                  Listing IDs (comma separated)
                  <input
                    value={batchBuyIds}
                    onChange={(event) => setBatchBuyIds(event.target.value)}
                  />
                </label>
                <button
                  disabled={writeActionsBlocked || Boolean(batchBuyValidation)}
                  title={baseWriteBlockReason || batchBuyValidation}
                  onClick={() =>
                    runAction(
                      "batchBuyItems",
                      async () => {
                        const ids = parseCsvBigInts(batchBuyIds);
                        const total = await actions.calculateBatchPriceWei(ids);
                        return actions.batchBuyItems(ids, total);
                      },
                      { needsWallet: true },
                    )
                  }
                >
                  Checkout Selected
                </button>
              </article>
            </>
          )}

          {activeTab === "explorer" && (
            <>
              <article className="panel">
                <h3>View Listing</h3>
                <label>
                  Listing ID
                  <input
                    value={lookupItemId}
                    onChange={(event) => setLookupItemId(event.target.value)}
                  />
                </label>
                <button
                  disabled={
                    readActionsBlocked || !isNonNegativeInteger(lookupItemId)
                  }
                  title={
                    (!canRunReads
                      ? "Set supported network and valid contract address first."
                      : "") ||
                    (!isNonNegativeInteger(lookupItemId)
                      ? "Listing ID must be a non-negative integer."
                      : "")
                  }
                  onClick={() =>
                    runAction("items", () =>
                      actions.getItem(BigInt(lookupItemId)),
                    )
                  }
                >
                  View Details
                </button>
              </article>

              <article className="panel">
                <h3>Check Wallet Earnings</h3>
                <p className="subtle">
                  Uses selected account:{" "}
                  {account ? shortAddress(account) : "N/A"}
                </p>
                <button
                  disabled={readActionsBlocked || !account}
                  title={
                    !account
                      ? "Select an account first."
                      : !canRunReads
                      ? "Set supported network and valid contract address first."
                      : ""
                  }
                  onClick={() =>
                    runAction("userBalance", () =>
                      actions.getUserBalance(account),
                    )
                  }
                >
                  Check Balance
                </button>
              </article>

              <article className="panel">
                <h3>Total Listings</h3>
                <p className="subtle">
                  See how many listings exist in the market.
                </p>
                <button
                  disabled={readActionsBlocked}
                  title={
                    !canRunReads
                      ? "Set supported network and valid contract address first."
                      : ""
                  }
                  onClick={() =>
                    runAction("itemCount", () => actions.getItemCount())
                  }
                >
                  Show Count
                </button>
              </article>

              <article className="panel">
                <h3>Batch Limit</h3>
                <p className="subtle">
                  Maximum number of items per batch transaction.
                </p>
                <button
                  disabled={readActionsBlocked}
                  title={
                    !canRunReads
                      ? "Set supported network and valid contract address first."
                      : ""
                  }
                  onClick={() =>
                    runAction("MAX_BATCH_SIZE", () => actions.getMaxBatchSize())
                  }
                >
                  Show Limit
                </button>
              </article>

              <article className="panel">
                <h3>Listings by Seller</h3>
                <p className="subtle">
                  Uses selected account:{" "}
                  {account ? shortAddress(account) : "N/A"}
                </p>
                <button
                  disabled={readActionsBlocked || !account}
                  title={
                    !account
                      ? "Select an account first."
                      : !canRunReads
                      ? "Set supported network and valid contract address first."
                      : ""
                  }
                  onClick={() =>
                    runAction("getUserItems", () =>
                      actions.getUserItems(account),
                    )
                  }
                >
                  Show Listings
                </button>
              </article>

              <article className="panel">
                <h3>Fetch Multiple Listings</h3>
                <label>
                  Listing IDs (comma separated)
                  <input
                    value={lookupItemIds}
                    onChange={(event) => setLookupItemIds(event.target.value)}
                  />
                </label>
                <button
                  disabled={readActionsBlocked || Boolean(batchReadValidation)}
                  title={
                    (!canRunReads
                      ? "Set supported network and valid contract address first."
                      : "") || batchReadValidation
                  }
                  onClick={() =>
                    runAction("batchGetItems", () =>
                      actions.batchGetItems(parseCsvBigInts(lookupItemIds)),
                    )
                  }
                >
                  Fetch Listings
                </button>
              </article>
            </>
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
