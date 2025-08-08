# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based Flashbots funds recovery tool that helps safely extract ERC20 tokens and ETH from compromised wallets using atomic bundles. The bot creates transactions that either all succeed or all fail together, preventing partial execution risks.

## Common Commands

### Running the Application
```bash
# Development with auto-restart on changes
npm run dev

# Run once (production or simulation mode based on .env)
npm start

# Alternative with Bun (also supported)
bun start
bun run dev
```

### Dependencies
```bash
# Install dependencies (npm recommended)
npm install

# Alternative with Bun
bun install
```

## Architecture

### Core Components

- **index.ts** - Main entry point that orchestrates the recovery process
- **config.ts** - Configuration management with environment variable validation using Zod
- **src/types.ts** - TypeScript type definitions for transactions

### Transaction Flow Modules
- **createFundingTrx.ts** - Creates transaction to fund compromised wallet with gas ETH
- **createERC20RecoveryTrx.ts** - Creates transaction to transfer ERC20 tokens from compromised to funder wallet
- **createWithdrawTrx.ts** - Creates transaction to return remaining ETH from compromised to funder wallet
- **signBundle.ts** - Signs all transactions for atomic bundle
- **simulateBundle.ts** - Simulates bundle execution for testing

### Bundle Submission
- **sendBundleToFlashbotsAndMonitor.ts** - Submits bundle to Flashbots and monitors inclusion
- **sendBundleToBeaver.ts** - Alternative submission to Beaver Build
- **getTargetBlock.ts** - Determines optimal target block for submission

### Key Dependencies
- **ethers 6.7.1** - Ethereum interaction library
- **@flashbots/ethers-provider-bundle** - Flashbots bundle provider
- **zod** - Environment variable validation
- **dotenv** - Environment configuration

### Configuration
Environment variables are validated in config.ts using Zod schema. Required variables:
- `NORMAL_RPC` - Ethereum RPC endpoint
- `FUNDER_PRIVATE_KEY` - Private key of wallet funding gas
- `COMPROMISED_PRIVATE_KEY` - Private key of compromised wallet
- `ERC20_TOKEN_ADDRESS` - Contract address of token to recover

Optional variables have defaults for gas pricing, simulation mode, and builder selection.

### Bundle Architecture
The system creates atomic bundles with exactly 3 transactions:
1. Fund compromised wallet with ETH for gas
2. Transfer ERC20 tokens from compromised to funder wallet  
3. Return remaining ETH from compromised to funder wallet

All transactions use EIP-1559 format with calculated maxFeePerGas and maxPriorityFeePerGas.

### Execution Modes
- **Simulation mode** (default): Tests bundle without execution
- **Production mode**: Executes real transactions on mainnet
- **Builder selection**: Choose between Flashbots or Beaver Build for submission