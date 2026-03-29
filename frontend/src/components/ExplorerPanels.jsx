import { parseCsvBigInts } from "../utils";

function ExplorerPanels({
  account,
  actions,
  batchReadValidation,
  canRunReads,
  isNonNegativeInteger,
  lookupItemId,
  lookupItemIds,
  readActionsBlocked,
  runAction,
  setLookupItemId,
  setLookupItemIds,
  shortAddress,
}) {
  return (
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
          disabled={readActionsBlocked || !isNonNegativeInteger(lookupItemId)}
          title={
            (!canRunReads
              ? "Set supported network and valid contract address first."
              : "") ||
            (!isNonNegativeInteger(lookupItemId)
              ? "Listing ID must be a non-negative integer."
              : "")
          }
          onClick={() =>
            runAction("items", () => actions.getItem(BigInt(lookupItemId)))
          }
        >
          View Details
        </button>
      </article>

      <article className="panel">
        <h3>Check Wallet Earnings</h3>
        <p className="subtle">
          Uses selected account: {account ? shortAddress(account) : "N/A"}
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
            runAction("userBalance", () => actions.getUserBalance(account))
          }
        >
          Check Balance
        </button>
      </article>

      <article className="panel">
        <h3>Total Listings</h3>
        <p className="subtle">See how many listings exist in the market.</p>
        <button
          disabled={readActionsBlocked}
          title={
            !canRunReads
              ? "Set supported network and valid contract address first."
              : ""
          }
          onClick={() => runAction("itemCount", () => actions.getItemCount())}
        >
          Show Count
        </button>
      </article>

      <article className="panel">
        <h3>Batch Limit</h3>
        <p className="subtle">Maximum number of items per batch transaction.</p>
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
          Uses selected account: {account ? shortAddress(account) : "N/A"}
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
            runAction("getUserItems", () => actions.getUserItems(account))
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
  );
}

export default ExplorerPanels;
