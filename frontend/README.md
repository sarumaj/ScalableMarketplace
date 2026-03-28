# ScalableMarketplace Frontend

React + ethers.js interface for `ScalableMarketplace.sol`.

## Features

- MetaMask connection and account detection
- Network switch support for Hardhat local only
- Interface for all public contract functions:
  - `listItem`
  - `batchListItems`
  - `buyItem`
  - `batchBuyItems`
  - `withdraw`
  - `items`
  - `userBalance`
  - `itemCount`
  - `MAX_BATCH_SIZE`
  - `getUserItems`
  - `batchGetItems`

## Quick Start

```bash
cd Blockchain/frontend
npm install
npm run dev
```

## Contract ABI and Address Sync

From the `Blockchain` root:

```bash
npm run compile
```

This updates `frontend/src/abi.json`.

When you deploy with `scripts/deploy.js`, the deployed contract address is automatically written to:

- `frontend/src/deployedAddresses.json`

The frontend auto-loads the address for the connected chain ID.
