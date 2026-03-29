function AccountCorner({
  account,
  availableAccounts,
  hasMetaMask,
  isConnecting,
  isRequestingAccountAccess,
  requestAccountAccess,
  selectAccount,
  shortAddress,
}) {
  return (
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
  );
}

export default AccountCorner;
