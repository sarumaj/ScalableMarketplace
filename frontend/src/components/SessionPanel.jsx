function SessionPanel({
  account,
  chainId,
  chainName,
  connectLabel,
  connectWallet,
  contractAddress,
  hasMetaMask,
  isConnecting,
  isRequestingAccountAccess,
  lastError,
  preferredChainId,
  requestAccountAccess,
  setContractAddress,
  setPreferredChainId,
  shortAddress,
  statusTone,
  supportedChains,
  switchNetwork,
  walletError,
}) {
  return (
    <section className={`panel status-panel tone-${statusTone}`}>
      <div className="status-summary">
        <h2>Wallet and Session</h2>
        <p>
          Active account: {account ? shortAddress(account) : "Not connected"}
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
            disabled={!hasMetaMask || isRequestingAccountAccess || isConnecting}
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
            onChange={(event) => setContractAddress(event.target.value.trim())}
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
            {supportedChains.map((chain) => (
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
          MetaMask is required. Install extension: https://metamask.io/download/
        </p>
      )}

      {(walletError || lastError) && (
        <p className="error-text">{walletError || lastError}</p>
      )}

      {account && (
        <p className="note">
          MetaMask only exposes accounts you explicitly grant to this app. Use
          "Manage Access" to add more accounts to the dropdown.
        </p>
      )}
    </section>
  );
}

export default SessionPanel;
