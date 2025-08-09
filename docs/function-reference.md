# Critical Function Reference

## Core Orchestration Functions

### `MasterOrchestrator.start()` - System Initialization
**Location**: `index.ts`
**Purpose**: Initializes and starts the complete recovery system.

```typescript
async start(): Promise<void>
```

**Process**:
1. Starts success monitoring (`successMonitor.start()`)
2. Starts three-phase event management (`eventManager.start()`)
3. Activates Bundle1 strategy (`startBundle1Strategy()`)
4. Logs system startup completion

**Critical Behavior**:
- Must be called only once per system instance
- Failure at any step prevents system operation
- All monitoring systems depend on this initialization

### `MasterOrchestrator.submitBundle1()` - Bundle1 Execution
**Location**: `index.ts`
**Purpose**: Creates, simulates, and submits Bundle1 for token recovery.

```typescript
private async submitBundle1(blockNumber: number): Promise<void>
```

**Process**:
1. Calculates target block (blockNumber + 1)
2. Creates Bundle1 transactions (`createBundle1()`)
3. Signs bundle (`signBundle()`)
4. Simulates bundle (`simulateBundle()`)
5. Submits to Flashbots (`sendBundleToFlashbotsAndMonitor()`)
6. Processes results and tracks skips

**Critical Behavior**:
- Called every block when Bundle1 is active
- Failures are expected and handled gracefully
- Success triggers immediate system shutdown
- Skip tracking prevents infinite failures

### `MasterOrchestrator.createAggressiveBundle1()` - Dynamic Gas Bundle
**Location**: `index.ts`
**Purpose**: Creates Bundle1 with dynamically escalating gas pricing.

```typescript
private async createAggressiveBundle1(): Promise<any[]>
```

**Algorithm**:
1. Calculate dynamic multiplier: `3 + Math.floor(blocksSinceStart / 2)`
2. Fetch current network fee data
3. Apply multiplier to gas prices
4. Apply upper bound caps
5. Temporarily update gas configuration
6. Create transactions with aggressive pricing
7. Restore original gas configuration

**Critical Behavior**:
- Only active when `bundle1Aggressive = true`
- Multiplier starts at 3x and increases every 2 blocks
- Upper bounds prevent excessive costs
- Gas config restoration is guaranteed via try/finally

## Transaction Creation Functions

### `createWithdrawTrx()` - Conditional Withdrawal
**Location**: `src/createWithdrawTrx.ts`
**Purpose**: Creates withdrawal transaction only if economically viable.

```typescript
export const createWithdrawTrx = async (amount?: bigint): Promise<WithdrawTrxResult>
```

**Algorithm**:
1. Get current compromised wallet balance
2. Calculate total gas costs (withdrawal + ERC20 transactions)
3. Calculate net return amount: `fundedAmount + balance - gasCosts`
4. If amount <= 0: return `{ shouldInclude: false }`
5. If amount > 0: create transaction and return `{ shouldInclude: true }`

**Return Structure**:
```typescript
{
    transaction: TransactionEntry | null,
    shouldInclude: boolean,
    calculatedAmount: bigint,
    reason?: string
}
```

**Critical Behavior**:
- Prevents "unsigned value cannot be negative" errors
- Bundle composition changes based on economic viability
- Detailed logging explains inclusion/exclusion decisions

### `createFundingTrx()` - Wallet Funding
**Location**: `src/createFundingTrx.ts`
**Purpose**: Creates transaction to fund compromised wallet with ETH.

```typescript
export const createFundingTrx = (): TransactionEntry
```

**Configuration**:
- Amount: `ETH_AMOUNT_TO_FUND` (default 0.1 ETH)
- Gas limit: 21,000 (standard ETH transfer)
- From: funder wallet
- To: compromised wallet

**Critical Behavior**:
- Uses current gas pricing from gasController
- Must provide sufficient ETH for subsequent operations
- Creates EIP-1559 transaction with proper fee structure

### `createERC20RecoveryTrx()` - Token Recovery
**Location**: `src/createERC20RecoveryTrx.ts`
**Purpose**: Creates transaction to transfer all ERC20 tokens to safety.

```typescript
export const createERC20RecoveryTrx = (tokenBalance: bigint): TransactionEntry
```

**Configuration**:
- Method: `transfer(address to, uint256 amount)`
- To: ERC20 contract address
- Amount: All available tokens
- Gas limit: 100,000 (handles complex tokens)

**Critical Behavior**:
- Transfers entire token balance
- Higher gas limit accommodates various token implementations
- From: compromised wallet, To: funder wallet

## Bundle Management Functions

### `Bundle2Creator.createBundle2WithUpgradeRaw()` - Coordinated Bundle
**Location**: `src/bundles/bundle2Creator.ts`
**Purpose**: Creates Bundle2 that coordinates upgrade execution with token recovery.

```typescript
static async createBundle2WithUpgradeRaw(upgradeRawSignedHex: string): Promise<BundleItemInput[]>
```

**Bundle Structure**:
1. **Upgrade Transaction**: Pre-signed Safe `execTransaction` (raw hex)
2. **Funding Transaction**: ETH to compromised wallet
3. **Recovery Transaction**: ERC20 tokens to funder
4. **Withdrawal Transaction**: Remaining ETH back to funder (conditional)

**Critical Behavior**:
- First transaction must be the upgrade to unlock tokens
- Conditional withdrawal based on economic calculation
- Mixed array of signed and unsigned transactions
- Atomic execution ensures upgrade + recovery coordination

### `signBundle()` - Transaction Signing
**Location**: `src/signBundle.ts`
**Purpose**: Signs mixed arrays of transactions for Flashbots submission.

```typescript
export const signBundle = async (bundle: BundleItemInput[]): Promise<string[]>
```

**Process**:
1. Iterate through bundle items
2. If `signedTransaction` exists: use raw hex directly
3. If `TransactionEntry`: sign using associated signer
4. Return array of signed transaction hex strings

**Critical Behavior**:
- Handles Bundle2's mixed transaction types
- Preserves transaction order in bundle
- Proper error handling for signing failures

## Gas Management Functions

### `getGasInfo()` - Centralized Gas Pricing
**Location**: `src/gasController.ts`
**Purpose**: Provides consistent gas pricing across all transaction creation.

```typescript
export function getGasInfo(multiplier: bigint = 1n): {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
}
```

**Calculation**:
- `adjustedBaseGas = basePrice * multiplier`
- `adjustedTip = tipPrice * multiplier`
- `maxFeePerGas = adjustedBaseGas + adjustedTip`
- `maxPriorityFeePerGas = adjustedTip`

**Usage Patterns**:
- `getGasInfo(1n)`: Normal Bundle1 operations
- `getGasInfo(2n)`: Bundle2 operations
- `getGasInfo(3n)`: Emergency operations

### `updateGasConfig()` - Dynamic Gas Updates
**Location**: `src/gasController.ts`
**Purpose**: Updates gas configuration based on current network conditions.

```typescript
export function updateGasConfig(feeData: FeeData): void
```

**Purpose**:
- Allows temporary gas configuration changes
- Used in aggressive mode for dynamic pricing
- Updates internal `basePrice` and `tipPrice` variables

## Monitoring Functions

### `SafeProposalMonitor.checkForNewProposals()` - Proposal Detection
**Location**: `src/monitoring/safe/safeProposalMonitor.ts`
**Purpose**: Monitors Safe API for new upgrade proposals and executions.

```typescript
private async checkForNewProposals(): Promise<void>
```

**Process**:
1. Fetch recent transactions from Safe API
2. Filter for ProxyAdmin upgrade transactions
3. Separate pending and executed transactions
4. Check for new proposals (not seen before)
5. Check for executed upgrades
6. Emit appropriate events with deduplication

**Critical Behavior**:
- Deduplication prevents infinite event loops
- Filters only relevant upgrade transactions
- Handles both pending and executed states
- Rate-limited API calls

### `trackSubmissionAttempt()` - Skip Monitoring
**Location**: `index.ts`
**Purpose**: Monitors consecutive bundle submission failures.

```typescript
private trackSubmissionAttempt(blockNumber: number, bundleSubmitted: boolean, bundleType: string): void
```

**Algorithm**:
1. If `bundleSubmitted = true`: reset `consecutiveSkips = 0`
2. If `bundleSubmitted = false`: increment `consecutiveSkips`
3. If `consecutiveSkips >= threshold`: send webhook alert
4. Log debug information about skip status

**Critical Behavior**:
- Tracks Bundle1 and Bundle2 independently
- Resets counter on ANY successful submission
- Webhook alerts provide external monitoring integration

## Flashbots Integration Functions

### `sendBundleToFlashbotsAndMonitor()` - Bundle Submission
**Location**: `src/sendBundleToFlashbotsAndMonitor.ts`
**Purpose**: Submits bundles to Flashbots and monitors inclusion results.

```typescript
export const sendBundleToFlashbotsAndMonitor = async (
    signedBundle: Array<string>, 
    targetBlockNumber: number
): Promise<BundleSubmissionResult>
```

**Process**:
1. Submit bundle to Flashbots relay
2. Wait for inclusion result
3. Extract transaction hashes if successful
4. Return detailed result object

**Return Structure**:
```typescript
{
    bundleHash: string,
    resolution: FlashbotsBundleResolution,
    success: boolean,
    targetBlock: number,
    includedTransactions?: string[]
}
```

**Critical Behavior**:
- Extracts individual transaction hashes for success monitoring
- Handles various resolution types (included, passed, failed)
- Provides detailed statistics for debugging

### `simulateBundle()` - Bundle Validation
**Location**: `src/simulateBundle.ts`
**Purpose**: Simulates bundle execution before submission.

```typescript
export const simulateBundle = async (signedBundle: Array<string>, blockTag?: bigint | "latest"): Promise<boolean>
```

**Validation**:
1. Submit bundle for simulation
2. Check for simulation errors
3. Check for transaction reverts
4. Report gas usage and fees
5. Return success/failure boolean

**Critical Behavior**:
- Prevents submission of invalid bundles
- Provides detailed gas and fee information
- Early detection of transaction failures

## Safe Integration Functions

### `buildSafeExecTransaction()` - Safe Transaction Construction
**Location**: `src/safeExecBuilder.ts`
**Purpose**: Builds executable Safe transactions from API proposal data.

```typescript
export async function buildSafeExecTransaction(safeTxHash: string): Promise<string>
```

**Process**:
1. Fetch proposal details from Safe API
2. Extract transaction parameters
3. Get current nonce for funder wallet
4. Build `execTransaction` call data
5. Sign transaction with funder wallet
6. Return raw signed transaction hex

**Critical Behavior**:
- Fetches fresh nonce for each call
- Maintains original Safe transaction parameters
- Only modifies outer gas pricing, not inner transaction
- Proper error handling for API failures

## Success Detection Functions

### `SuccessMonitor.addTransactionToMonitor()` - Success Tracking
**Location**: `src/successMonitor.ts`
**Purpose**: Adds successful bundle transactions to success monitoring.

```typescript
addTransactionToMonitor(txHash: string, type: SuccessEvent['type']): void
```

**Process**:
1. Check for duplicate transaction hashes
2. Add to monitoring set
3. Attempt immediate confirmation check
4. Continue monitoring until confirmed

**Critical Behavior**:
- Deduplication prevents duplicate monitoring
- Immediate check handles already-confirmed transactions
- Persistent monitoring until confirmation

### `SuccessMonitor.checkTokensRecovered()` - Recovery Verification
**Location**: `src/successMonitor.ts`
**Purpose**: Verifies actual token transfer to funder wallet.

```typescript
private async checkTokensRecovered(type: SuccessEvent['type'], txHash: string): Promise<boolean>
```

**Verification Methods**:
- **Bundle transactions**: Check funder token balance increase
- **Hijacked transfers**: Decode transaction data to verify recipient
- **Direct verification**: Query current token balances

**Critical Behavior**:
- Actual token verification, not just transaction success
- Different verification methods for different transaction types
- Only returns true for confirmed token recovery

This function reference covers the most critical functions that drive system behavior and require careful understanding for maintenance and debugging.
