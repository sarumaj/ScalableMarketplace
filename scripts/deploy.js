import hardhat from "hardhat";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const { ethers } = hardhat;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function updateFrontendDeploymentAddress(chainId, address) {
  const destination = join(projectRoot, "frontend/src/deployedAddresses.json");
  mkdirSync(dirname(destination), { recursive: true });

  let deployedAddresses = {};
  if (existsSync(destination)) {
    deployedAddresses = JSON.parse(readFileSync(destination, "utf8"));
  }

  deployedAddresses[String(chainId)] = address;
  writeFileSync(destination, `${JSON.stringify(deployedAddresses, null, 2)}\n`);
}

async function main() {
  console.log("Starting deployment...");

  // Copy ABI to frontend
  try {
    console.log("Copying ABI to frontend...");
    execSync("node scripts/copy-abi.js", { stdio: "inherit" });
  } catch (error) {
    console.warn("Warning: Could not copy ABI to frontend");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  console.log("\nDeploying ScalableMarketplace...");
  const ScalableMarketplace = await ethers.getContractFactory(
    "ScalableMarketplace",
  );
  const marketplace = await ScalableMarketplace.deploy();

  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("ScalableMarketplace deployed to:", address);
  console.log("Network chainId:", chainId);

  try {
    updateFrontendDeploymentAddress(chainId, address);
    console.log("Updated frontend/src/deployedAddresses.json");
  } catch (error) {
    console.warn(
      "Warning: Could not update deployedAddresses.json:",
      error.message,
    );
  }

  // Local chains typically mine only when transactions are sent, so waiting for
  // many confirmations can hang indefinitely.
  const isLocalChain = chainId === 1337 || chainId === 31337;
  const confirmations = isLocalChain ? 1 : 5;

  console.log(`\nWaiting for block confirmations (${confirmations})...`);
  await marketplace.deploymentTransaction().wait(confirmations);

  console.log("\nDeployment complete!");
  console.log("Contract address:", address);
  console.log(
    "\nUse this address in the local frontend configuration if needed.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
