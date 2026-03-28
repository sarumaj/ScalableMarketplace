import hardhat from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { ethers } = hardhat;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BENCHMARK_OUTPUT_PATH = process.env.BENCH_OUTPUT
  ? path.resolve(process.env.BENCH_OUTPUT)
  : path.resolve(__dirname, "../benchmark_results.json");

const now = () => process.hrtime.bigint();
const elapsedMs = (start) => Number(process.hrtime.bigint() - start) / 1e6;

const toNumber = (value) => Number(value);

async function measure(label, action) {
  const start = now();
  const tx = await action();
  const receipt = await tx.wait();
  const durationMs = elapsedMs(start);

  return {
    label,
    gasUsed: receipt.gasUsed.toString(),
    durationMs: durationMs.toFixed(2),
    txHash: receipt.hash,
  };
}

function readExistingBenchmarkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: 1,
      generatedBy: "scripts/benchmark.js",
      runs: {},
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed.runs || typeof parsed.runs !== "object") {
      parsed.runs = {};
    }
    return parsed;
  } catch {
    return {
      schemaVersion: 1,
      generatedBy: "scripts/benchmark.js",
      runs: {},
    };
  }
}

function indexResultsByLabel(results) {
  return Object.fromEntries(results.map((entry) => [entry.label, entry]));
}

function writeBenchmarkRun({ network, batchSize, results, contractAddress }) {
  const benchFile = readExistingBenchmarkFile(BENCHMARK_OUTPUT_PATH);
  const resultsByLabel = indexResultsByLabel(results);
  const networkKey = `${
    network.name || "unknown"
  }:${network.chainId.toString()}`;

  if (!benchFile.runs[networkKey]) {
    benchFile.runs[networkKey] = {
      networkName: network.name,
      chainId: network.chainId.toString(),
      byBatchSize: {},
    };
  }

  benchFile.runs[networkKey].byBatchSize[String(batchSize)] = {
    timestamp: new Date().toISOString(),
    contractAddress,
    batchSize,
    results,
    metrics: {
      listItem: Number(resultsByLabel.listItem?.gasUsed || 0),
      batchListItems: Number(resultsByLabel.batchListItems?.gasUsed || 0),
      buyItem: Number(resultsByLabel.buyItem?.gasUsed || 0),
      batchBuyItems: Number(resultsByLabel.batchBuyItems?.gasUsed || 0),
      withdraw: Number(resultsByLabel.withdraw?.gasUsed || 0),
    },
  };

  benchFile.updatedAt = new Date().toISOString();

  fs.writeFileSync(
    BENCHMARK_OUTPUT_PATH,
    JSON.stringify(benchFile, null, 2) + "\n",
    "utf8",
  );
  return BENCHMARK_OUTPUT_PATH;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(
    "Network:",
    network.name,
    "(chainId",
    network.chainId.toString() + ")",
  );

  const signers = await ethers.getSigners();
  if (signers.length < 2) {
    throw new Error(
      "At least two funded accounts are required.",
    );
  }

  const seller = signers[0];
  const buyer = signers[1];

  const batchSize = Number(process.env.BENCH_BATCH_SIZE || 3);
  const priceWei = ethers.parseEther("0.01");

  const ScalableMarketplace = await ethers.getContractFactory(
    "ScalableMarketplace",
  );

  let marketplace;
  const existingAddress = process.env.CONTRACT_ADDRESS;

  if (existingAddress) {
    marketplace = ScalableMarketplace.attach(existingAddress);
    console.log("Using existing contract:", existingAddress);
  } else {
    console.log("Deploying new contract for benchmarks...");
    marketplace = await ScalableMarketplace.deploy();
    await marketplace.waitForDeployment();
    console.log("Contract deployed:", await marketplace.getAddress());
  }

  const sellerContract = marketplace.connect(seller);
  const buyerContract = marketplace.connect(buyer);

  const results = [];

  // listItem
  const nextItemId = toNumber(await sellerContract.itemCount());
  results.push(
    await measure("listItem", () =>
      sellerContract.listItem("Bench Item", priceWei),
    ),
  );

  // batchListItems
  const batchStartId = toNumber(await sellerContract.itemCount());
  const batchNames = Array.from(
    { length: batchSize },
    (_, i) => `Batch Item ${i + 1}`,
  );
  const batchPrices = Array.from({ length: batchSize }, () => priceWei);
  results.push(
    await measure("batchListItems", () =>
      sellerContract.batchListItems(batchNames, batchPrices),
    ),
  );

  // buyItem (buyer buys single item)
  results.push(
    await measure("buyItem", () =>
      buyerContract.buyItem(nextItemId, { value: priceWei }),
    ),
  );

  // batchBuyItems (buyer buys items from latest batch)
  const batchItemIds = Array.from(
    { length: batchSize },
    (_, i) => batchStartId + i,
  );
  const totalPrice = priceWei * BigInt(batchSize);
  results.push(
    await measure("batchBuyItems", () =>
      buyerContract.batchBuyItems(batchItemIds, { value: totalPrice }),
    ),
  );

  // withdraw (seller withdraws proceeds)
  results.push(await measure("withdraw", () => sellerContract.withdraw()));

  console.log("\nBenchmark results:");
  console.table(results);

  const outputPath = writeBenchmarkRun({
    network,
    batchSize,
    results,
    contractAddress: await marketplace.getAddress(),
  });
  console.log(`\nSaved benchmark data: ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
