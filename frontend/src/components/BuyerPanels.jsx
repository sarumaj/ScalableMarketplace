import { parseCsvBigInts } from "../utils";

function BuyerPanels({
  actions,
  baseWriteBlockReason,
  batchBuyIds,
  batchBuyValidation,
  buyItemId,
  isNonNegativeInteger,
  runAction,
  setBatchBuyIds,
  setBuyItemId,
  writeActionsBlocked,
}) {
  return (
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
          disabled={writeActionsBlocked || !isNonNegativeInteger(buyItemId)}
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
                const value = await actions.calculateItemPriceWei(itemId);
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
  );
}

export default BuyerPanels;
