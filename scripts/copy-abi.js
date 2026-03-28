#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// Read the compiled artifact
const artifactPath = join(
  projectRoot,
  "artifacts/contracts/ScalableMarketplace.sol/ScalableMarketplace.json",
);

const frontendAbiPath = join(projectRoot, "frontend/src/abi.json");

try {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  mkdirSync(dirname(frontendAbiPath), { recursive: true });
  writeFileSync(frontendAbiPath, JSON.stringify(abi, null, 2));

  console.log("ABI successfully copied to frontend/src/abi.json");
} catch (error) {
  console.error("Error copying ABI:", error.message);
  process.exit(1);
}
