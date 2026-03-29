import { parseCsvStrings } from "../utils";

function SellerPanels({
  actions,
  baseWriteBlockReason,
  batchListValidation,
  isPositiveNumber,
  listName,
  listPrice,
  runAction,
  setBatchNames,
  setBatchPrices,
  setListName,
  setListPrice,
  writeActionsBlocked,
  batchNames,
  batchPrices,
}) {
  return (
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
            runAction("listItem", () => actions.listItem(listName, listPrice), {
              needsWallet: true,
            })
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
  );
}

export default SellerPanels;
