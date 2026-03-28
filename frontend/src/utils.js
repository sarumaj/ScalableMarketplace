export function shortAddress(address) {
  if (!address) {
    return "";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function parseCsvStrings(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseCsvBigInts(value) {
  return parseCsvStrings(value).map((entry) => BigInt(entry));
}

export function parsePriceCsv(value, parseEthToWei) {
  return parseCsvStrings(value).map((entry) => parseEthToWei(entry));
}

export function serializeResult(data) {
  return JSON.stringify(
    data,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
}

export function humanizeError(error) {
  if (!error) {
    return "Unknown error";
  }

  const msg =
    error.shortMessage ||
    error.reason ||
    error.info?.error?.message ||
    error.message ||
    String(error);

  return msg.replace(/^execution reverted: /i, "").trim();
}
