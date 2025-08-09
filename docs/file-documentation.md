# File Documentation

## Root Level Files

### `index.ts` - Master Orchestrator
**Role**: Central coordination hub and main entry point for the entire system.

**Key Components**:
- **MasterOrchestrator Class**: Main coordination class that manages all subsystems
- **Event Handler Setup**: Wires together all event listeners and handlers
- **Bundle Strategy Management**: Coordinates Bundle1, Bundle2, and emergency strategies
- **Skip Monitoring**: Tracks consecutive bundle submission failures
- **Dynamic Gas Escalation**: Implements aggressive gas pricing strategies

**Critical Methods**:
- `start()`: Initializes and starts all monitoring and execution systems
- `submitBundle1()`: Handles Bundle1 creation, submission, and monitoring
- `createAggressiveBundle1()`: Creates Bundle1 with escalating gas pricing
- `trackSubmissionAttempt()`: Monitors bundle submission success/failure
- `sendWebhookAlert()`: Sends monitoring alerts to external systems
- `handleRecoverySuccess()`: Processes successful token recovery

**State Management**:
- `bundle1Active/bundle1Aggressive`: Bundle1 strategy states
- `consecutiveSkips`: Skip counter for monitoring
- `aggressiveModeStartBlock`: Tracks aggressive mode duration
- `recoverySucceeded`: Global success flag

### `config.ts` - Configuration Management
**Role**: Centralized configuration loading, validation, and provider setup.

**Key Components**:
- **Environment Validation**: Zod schema validation for all environment variables
- **Provider Setup**: Flashbots, Alchemy, and RPC provider initialization
- **Contract Initialization**: ERC20 contract and signer setup
- **Gas Configuration**: Base gas pricing and upper bound configuration
- **Address Management**: Wallet and contract address handling

**Exported Configuration**:
- **Providers**: `flashbotsProvider`, `normalProvider`, `websocketRpc`
- **Addresses**: `funderAddress`, `compromisedAddress`, `safeAddress`, etc.
- **Signers**: `funderAuthSigner`, `compromisedAuthSigner`
- **Gas Settings**: `baseGasPrice`, `tip`, upper bound configurations
- **Monitoring**: `webhookUrl`, `consecutiveSkipThreshold`

**Critical Features**:
- Chain ID environment variable support
- Optional/required environment variable handling
- Provider fallback and error handling
- Gas pricing in gwei with proper parsing

### `package.json` - Project Configuration
**Role**: Defines project dependencies, scripts, and metadata.

**Key Scripts**:
- `start`: Main system execution (`node index.js`)
- `monitor`: Advanced mempool monitoring (`node monitorMempoolAdvanced.js`)
- `bundle1`: Standalone Bundle1 submission (`node bundle1Submission.js`)

**Dependencies**:
- **Core**: `ethers`, `@flashbots/ethers-provider-bundle`
- **Monitoring**: `alchemy-sdk` for enhanced mempool monitoring
- **Validation**: `zod` for environment variable validation
- **Development**: `typescript`, `@types/*` packages

### `.env.example` - Environment Template
**Role**: Template and documentation for required environment variables.

**Configuration Sections**:
- **Network Configuration**: RPC URLs, chain ID, WebSocket endpoints
- **Wallet Configuration**: Private keys for funder and compromised wallets
- **Contract Addresses**: ERC20 token, proxy, ProxyAdmin, Safe addresses
- **Flashbots Configuration**: Relay URL and authentication
- **Gas Configuration**: Base pricing and upper bounds
- **Monitoring Configuration**: Webhook URL, skip thresholds, logging levels

## Source Files (`src/`)

### Transaction Creation

#### `src/createFundingTrx.ts` - Funding Transaction Creator
**Role**: Creates transactions to fund the compromised wallet with ETH for gas.

**Functionality**:
- Calculates funding amount (configurable, default 0.1 ETH)
- Applies current gas pricing from gasController
- Creates EIP-1559 transaction from funder to compromised wallet
- Includes detailed logging of transaction parameters

**Key Parameters**:
- `ETH_AMOUNT_TO_FUND`: Configurable funding amount
- Gas limit: 21,000 (standard ETH transfer)
- Uses current `maxFeePerGas` and `maxPriorityFeePerGas`

#### `src/createERC20RecoveryTrx.ts` - ERC20 Recovery Transaction Creator
**Role**: Creates transactions to transfer all ERC20 tokens from compromised to funder wallet.

**Functionality**:
- Takes token balance as parameter or fetches current balance
- Creates `transfer()` call to ERC20 contract
- Transfers all tokens from compromised wallet to funder
- Applies current gas pricing with higher gas limit (100,000)

**Key Features**:
- Supports any ERC20 token through configurable contract address
- Uses actual token balance for complete recovery
- Higher gas limit to handle complex token contracts

#### `src/createWithdrawTrx.ts` - Withdrawal Transaction Creator
**Role**: Creates conditional transactions to return remaining ETH to funder.

**Functionality**:
- Calculates remaining ETH after gas costs
- Returns conditional result based on calculated amount
- Only creates transaction if amount > 0 (prevents negative value errors)
- Includes detailed gas cost calculations

**Return Type**: `WithdrawTrxResult`
```typescript
{
    transaction: TransactionEntry | null,
    shouldInclude: boolean,
    calculatedAmount: bigint,
    reason?: string
}
```

**Gas Cost Calculation**:
- Current transaction gas cost (50,000 gas limit)
- ERC20 transaction estimated cost (100,000 gas limit)
- Subtracts total costs from available ETH

### Bundle Management

#### `src/bundles/bundle2Creator.ts` - Bundle2 Construction
**Role**: Creates Bundle2 transactions that coordinate upgrade execution with token recovery.

**Key Methods**:
- `createBundle2WithUpgradeRaw()`: Creates Bundle2 with pre-signed Safe transaction
- `createAlternativeBundle2()`: Creates Bundle2 without upgrade (tokens already unlocked)

**Bundle2 Structure**:
1. **Upgrade Transaction**: Pre-signed Safe `execTransaction` (raw hex)
2. **Funding Transaction**: ETH to compromised wallet
3. **Recovery Transaction**: ERC20 tokens to funder
4. **Withdrawal Transaction**: Remaining ETH back to funder (conditional)

**Key Features**:
- Accepts mixed array of signed transactions and transaction objects
- Conditional withdrawal transaction inclusion
- Detailed logging of bundle composition

#### `src/bundle2Controller.ts` - Bundle2 Execution Management
**Role**: Manages Bundle2 submission lifecycle and coordination.

**Key Features**:
- **Continuous Submission**: Submits Bundle2 every block when active
- **Simulation First**: Always simulates before submission
- **Event Emission**: Emits success, failure, and attempt events
- **Skip Tracking**: Tracks submission attempts for monitoring
- **Graceful Shutdown**: Stops on success or manual termination

**Event Types**:
- `bundle2-submitted`: Bundle submitted to Flashbots
- `bundle2-success`: Bundle included with transaction hashes
- `bundle2-skipped`: Bundle submission failed/skipped
- `bundle2-attempt`: Tracks submission attempt for skip monitoring

#### `src/signBundle.ts` - Bundle Signing
**Role**: Signs transaction bundles for Flashbots submission.

**Functionality**:
- Accepts mixed arrays of `TransactionEntry` and `{ signedTransaction: string }`
- Signs unsigned transactions using their associated signers
- Passes through already-signed raw hex strings
- Returns array of signed transaction hex strings

**Key Features**:
- Supports Bundle2's mixed transaction types
- Handles both individual transactions and pre-signed Safe transactions
- Proper error handling and logging

### Gas Management

#### `src/gasController.ts` - Centralized Gas Pricing
**Role**: Provides centralized gas pricing interface for all transaction creation.

**Key Functions**:
- `getGasInfo(multiplier)`: Returns gas pricing with optional multiplier
- `updateGasConfig(feeData)`: Updates gas configuration from RPC data

**Functionality**:
- Maintains internal `basePrice` and `tipPrice` variables
- Supports dynamic multipliers for different bundle types
- Can be updated with current network conditions
- Provides consistent interface across all transaction creators

**Usage Patterns**:
- `getGasInfo(1n)`: Normal Bundle1 pricing
- `getGasInfo(2n)`: Bundle2 enhanced pricing
- `getGasInfo(3n)`: Emergency/aggressive pricing

### Monitoring System

#### `src/monitoring/eventManager.ts` - Three-Phase Event Manager
**Role**: Central event processing and coordination engine.

**Key Components**:
- **Phase Management**: Tracks and transitions between system phases
- **Event Routing**: Routes events between different monitoring components
- **Safe Integration**: Manages Safe proposal and confirmation monitoring
- **Mempool Integration**: Coordinates mempool monitoring activation

**Phases**:
1. **Standby**: Waiting for upgrade proposals
2. **Proposal Detected**: Monitoring proposal confirmations
3. **Mempool Active**: Active mempool monitoring with Bundle2

**Event Handling**:
- Deduplication logic to prevent infinite loops
- Event filtering and validation
- Graceful error handling and recovery

#### `src/monitoring/safe/safeProposalMonitor.ts` - Safe API Monitoring
**Role**: Monitors Gnosis Safe Transaction Service API for upgrade proposals.

**Key Features**:
- **Polling Strategy**: Configurable polling interval (default 10s)
- **Filtering**: Only processes ProxyAdmin upgrade transactions
- **Deduplication**: Tracks seen proposals and executed upgrades
- **Execution Detection**: Detects when upgrades are executed by others

**API Integration**:
- Fetches recent multisig transactions from Safe API
- Filters by transaction target (ProxyAdmin address)
- Decodes transaction data to identify upgrade methods
- Handles both pending and executed transactions

**Event Emissions**:
- `proposal-detected`: New upgrade proposal found
- `upgrade-executed`: Upgrade already executed by others

#### `src/monitoring/safe/confirmationTracker.ts` - Confirmation Monitoring
**Role**: Tracks confirmation progress for specific Safe proposals.

**Functionality**:
- Monitors specific proposal for confirmation updates
- Tracks confirmation count against required threshold
- Emits event when confirmation threshold is reached
- Handles confirmation state changes

#### `src/monitoring/mempoolMonitor.ts` - Real-time Mempool Monitoring
**Role**: Monitors pending transactions for upgrade and hacker activity.

**Key Features**:
- **Alchemy WebSocket**: Uses `alchemy_pendingTransactions` subscription
- **Address Filtering**: Filters by `fromAddress` and `toAddress`
- **Real-time Processing**: Processes transactions as they appear
- **Pattern Detection**: Identifies upgrade and hacker activity patterns

**Subscription Configuration**:
- `fromAddress`: Compromised wallet address
- `toAddress`: Safe and ProxyAdmin addresses
- `hashesOnly: false`: Gets full transaction data

#### `src/monitoring/detectors/upgradeDetector.ts` - Upgrade Pattern Detection
**Role**: Identifies upgrade transactions in mempool data.

**Detection Logic**:
- Checks transaction target addresses
- Identifies Safe `execTransaction` calls
- Decodes inner transaction data for ProxyAdmin upgrades
- Validates upgrade method signatures

#### `src/monitoring/filters/upgradeFilter.ts` - Transaction Filtering
**Role**: Filters and classifies transactions for upgrade patterns.

#### `src/monitoring/alertLogger.ts` - Centralized Logging
**Role**: Provides structured logging with levels and bundle-specific tags.

**Log Levels**:
- `DEBUG`: Detailed debugging information
- `INFO`: General operational information
- `WARN`: Warning conditions
- `ERROR`: Error conditions

**Bundle Tags**:
- `BUNDLE1`: Bundle1-specific logs
- `BUNDLE2`: Bundle2-specific logs
- `SYSTEM`: System-level logs
- `MONITOR`: Monitoring-related logs

**Key Methods**:
- `logInfo()`, `logDebug()`, `logWarn()`, `logError()`
- `bundle1Info()`, `bundle2Debug()`: Convenience methods
- Configurable via `LOG_LEVEL` environment variable

### Success and Monitoring

#### `src/successMonitor.ts` - Transaction Success Tracking
**Role**: Monitors confirmed transactions for token recovery success.

**Functionality**:
- **Transaction Monitoring**: Tracks specific transaction hashes
- **Recovery Verification**: Verifies actual token transfer to funder
- **Event Emission**: Emits success events with detailed information
- **Block Listening**: Monitors new blocks for transaction confirmations

**Success Detection**:
- Confirms transaction inclusion in blocks
- Analyzes transaction type and impact
- Verifies token balance changes
- Distinguishes between recovery and defensive actions

#### `src/sendBundleToFlashbotsAndMonitor.ts` - Flashbots Integration
**Role**: Handles bundle submission to Flashbots and monitors inclusion.

**Functionality**:
- **Bundle Submission**: Submits signed bundles to Flashbots relay
- **Inclusion Monitoring**: Waits for and reports inclusion status
- **Transaction Extraction**: Extracts individual transaction hashes from successful bundles
- **Statistics Reporting**: Reports bundle statistics and performance

**Return Data**:
```typescript
{
    bundleHash: string,
    resolution: FlashbotsBundleResolution,
    success: boolean,
    targetBlock: number,
    includedTransactions?: string[]
}
```

### Safe Integration

#### `src/safeExecBuilder.ts` - Safe Transaction Builder
**Role**: Builds executable Safe transactions from API proposal data.

**Functionality**:
- Fetches Safe proposal details from API
- Builds `execTransaction` call data
- Gets current nonce for transaction sender
- Signs transaction with funder wallet
- Returns raw signed transaction hex

**Key Features**:
- Dynamic nonce fetching for each block
- Proper gas pricing from gasController
- Error handling for API failures
- Support for confirmed upgrade proposals

#### `src/abi/safeAbi.ts` - Safe Contract ABI
**Role**: Provides ABI definition for Safe `execTransaction` function.

**Usage**:
- Used by safeExecBuilder for transaction construction
- Used by upgradeDetector for transaction decoding
- Enables proper interaction with Safe contracts

## Standalone Scripts

### `bundle1Submission.ts` - Standalone Bundle1 Script
**Role**: Standalone script for Bundle1 testing and manual execution.

**Features**:
- **Simulation Mode**: Test bundle creation and simulation
- **Production Mode**: Continuous bundle submission
- **Conditional Transactions**: Handles conditional withdrawal logic
- **Independent Execution**: Runs without full monitoring system

### `monitorMempoolAdvanced.ts` - Advanced Monitoring Script
**Role**: Standalone script for testing the three-phase monitoring system.

**Usage**:
- Testing event manager functionality
- Debugging monitoring workflows
- Validating Safe API integration
- Development and troubleshooting

## Supporting Files

### `src/types.ts` - Type Definitions
**Role**: Defines common types and interfaces used throughout the system.

**Key Types**:
- `TransactionEntry`: Standard transaction object structure
- `BundleItemInput`: Mixed type for bundle items (signed/unsigned)
- `WithdrawTrxResult`: Conditional withdrawal transaction result

### `src/monitoring/types.ts` - Monitoring Type Definitions
**Role**: Defines types specific to the monitoring system.

**Key Interfaces**:
- `SuspiciousTransaction`: Detected suspicious activity
- `UpgradeDetectedEvent`: Upgrade detection events
- `UpgradeExecutedEvent`: Upgrade execution events
- `MonitoringAlert`: Alert structure for notifications

This file structure provides a comprehensive, modular system that separates concerns while maintaining tight integration between components.
