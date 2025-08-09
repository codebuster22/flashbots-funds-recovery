# Execution Flow Documentation

## System Startup Flow

### 1. Initialization Sequence
```
npm run start
    │
    ├─→ Load Environment Variables (.env)
    ├─→ Validate Configuration (config.ts)
    ├─→ Initialize Providers (Flashbots, Alchemy, RPC)
    ├─→ Create Component Instances
    │   ├─ EventManager
    │   ├─ Bundle2Controller  
    │   ├─ SuccessMonitor
    │   └─ SafeProposalMonitor
    ├─→ Setup Event Handlers
    ├─→ Start Monitoring Systems
    │   ├─ Safe API Polling
    │   ├─ Mempool WebSocket
    │   └─ Success Monitoring
    └─→ Begin Bundle1 Strategy
```

### 2. Component Initialization
```
MasterOrchestrator.constructor()
    │
    ├─→ Validate Required Addresses
    │   ├─ PROXY_ADMIN_ADDRESS
    │   └─ SAFE_ADDRESS
    ├─→ Create ThreePhaseEventManager
    ├─→ Create Bundle2Controller
    ├─→ Create SuccessMonitor
    └─→ Setup Event Handlers
```

### 3. Event Handler Wiring
```
setupEventHandlers()
    │
    ├─→ eventManager.on('upgrade-detected') → startBundle2Strategy()
    ├─→ eventManager.on('stop-bundle2') → bundle2Controller.stop()
    ├─→ eventManager.on('activate-aggressive-bundle1') → startAggressiveBundle1()
    ├─→ eventManager.on('hacker-erc20-activity') → handleHackerActivity()
    ├─→ successMonitor.on('transaction-success') → handleRecoverySuccess()
    ├─→ bundle2Controller.on('bundle2-success') → monitor transactions
    └─→ bundle2Controller.on('bundle2-attempt') → track skips
```

## Three-Phase System Flow

### Phase 1: Standby Mode
```
System Start
    │
    ├─→ SafeProposalMonitor.start()
    │   ├─ Poll Safe API every 10s
    │   ├─ Filter for ProxyAdmin upgrades
    │   └─ Check for executed upgrades
    │
    ├─→ Bundle1 Continuous Execution
    │   ├─ Create Bundle1 every block
    │   ├─ Fund → Recover → Withdraw
    │   ├─ Simulate → Submit → Monitor
    │   └─ Track consecutive skips
    │
    └─→ Wait for Events
        ├─ New upgrade proposal → Phase 2
        ├─ Executed upgrade → Aggressive Mode
        └─ Hacker activity → Emergency Response
```

### Phase 2: Proposal Detected
```
Upgrade Proposal Found
    │
    ├─→ ConfirmationTracker.start()
    │   ├─ Monitor specific proposal
    │   ├─ Check confirmation count
    │   └─ Detect threshold reached
    │
    ├─→ Continue Bundle1 Strategy
    │   └─ Same as Phase 1
    │
    └─→ Wait for Events
        ├─ Confirmations ready → Phase 3
        ├─ Proposal executed → Aggressive Mode
        └─ Hacker activity → Emergency Response
```

### Phase 3: Mempool Active
```
Confirmations Ready
    │
    ├─→ Build Safe execTransaction
    │   ├─ Fetch proposal details
    │   ├─ Get current nonce
    │   ├─ Sign transaction
    │   └─ Create raw hex string
    │
    ├─→ Start MempoolMonitor
    │   ├─ WebSocket subscription
    │   ├─ Filter by addresses
    │   └─ Detect upgrade attempts
    │
    ├─→ Activate Bundle2 Strategy
    │   ├─ Upgrade + Fund + Recover + Withdraw
    │   ├─ Submit every block
    │   └─ Monitor for inclusion
    │
    └─→ Continue Bundle1 Strategy
        └─ Fallback protection
```

## Bundle Strategy Decision Tree

### Bundle Selection Logic
```
New Block Event
    │
    ├─→ Is Bundle2 Active?
    │   ├─ YES → Submit Bundle2
    │   │   ├─ Create: [Upgrade, Fund, Recover, Withdraw*]
    │   │   ├─ Simulate → Submit → Monitor
    │   │   └─ Success → Stop all / Failure → Continue
    │   │
    │   └─ NO → Continue to Bundle1
    │
    └─→ Submit Bundle1
        ├─ Is Aggressive Mode?
        │   ├─ YES → Calculate Dynamic Multiplier
        │   │   ├─ Base: 3x
        │   │   ├─ Escalation: +1x every 2 blocks
        │   │   ├─ Apply Upper Bounds
        │   │   └─ Temporarily Update Gas Config
        │   │
        │   └─ NO → Use Normal Gas (1x)
        │
        ├─ Create: [Fund, Recover, Withdraw*]
        ├─ Simulate → Submit → Monitor
        └─ Track Skip Counter
```

*Withdrawal transaction is conditional based on calculated amount

### Bundle Creation Flow
```
createBundle1() / createBundle2()
    │
    ├─→ createFundingTrx()
    │   ├─ Calculate funding amount (0.1 ETH)
    │   ├─ Apply current gas pricing
    │   └─ Return: funder → compromised
    │
    ├─→ createERC20RecoveryTrx()
    │   ├─ Get token balance
    │   ├─ Apply current gas pricing
    │   └─ Return: compromised → funder (all tokens)
    │
    ├─→ createWithdrawTrx()
    │   ├─ Calculate remaining ETH
    │   ├─ Subtract estimated gas costs
    │   ├─ Check if amount > 0
    │   └─ Return: conditional transaction or null
    │
    └─→ Conditional Bundle Assembly
        ├─ Always: [funding, recovery]
        ├─ If withdrawal valid: add withdrawal
        └─ Return bundle array
```

## Event-Driven Execution

### Safe API Event Flow
```
SafeProposalMonitor (every 10s)
    │
    ├─→ Fetch recent transactions
    ├─→ Filter for ProxyAdmin upgrades
    ├─→ Check for new proposals
    │   └─ Emit: 'proposal-detected'
    │
    ├─→ Check for executed upgrades
    │   └─ Emit: 'upgrade-executed'
    │
    └─→ Deduplication Logic
        ├─ Skip already processed proposals
        └─ Skip already processed executions
```

### Mempool Event Flow
```
MempoolMonitor (WebSocket)
    │
    ├─→ alchemy_pendingTransactions subscription
    ├─→ Filter: fromAddress=compromised OR toAddress=Safe/ProxyAdmin
    ├─→ Process each transaction
    │   ├─ upgradeDetector.isUpgradeTransaction()
    │   ├─ hackerActivityDetector.isHackerActivity()
    │   └─ Emit appropriate events
    │
    └─→ Event Routing
        ├─ Upgrade detected → Bundle2 activation
        ├─ Hacker activity → Emergency response
        └─ Other → Continue monitoring
```

### Bundle Submission Flow
```
submitBundle() [1 or 2]
    │
    ├─→ Bundle Creation
    │   ├─ Create individual transactions
    │   ├─ Apply current gas strategy
    │   └─ Assemble bundle array
    │
    ├─→ Bundle Signing
    │   ├─ Sign each transaction
    │   ├─ Convert to raw hex strings
    │   └─ Prepare for Flashbots
    │
    ├─→ Bundle Simulation
    │   ├─ flashbotsProvider.simulate()
    │   ├─ Check for reverts/errors
    │   └─ Skip if simulation fails
    │
    ├─→ Bundle Submission
    │   ├─ flashbotsProvider.sendRawBundle()
    │   ├─ Wait for inclusion result
    │   └─ Extract transaction hashes if successful
    │
    └─→ Result Processing
        ├─ Success → Add to SuccessMonitor
        ├─ Failure → Track skip counter
        └─ Continue strategy
```

## Gas Strategy Execution

### Normal Mode Gas Flow
```
getGasInfo(1n) [1x multiplier]
    │
    ├─→ basePrice (from config)
    ├─→ tipPrice (from config)
    └─→ Return: {
            maxFeePerGas: basePrice + tipPrice,
            maxPriorityFeePerGas: tipPrice
        }
```

### Aggressive Mode Gas Flow
```
createAggressiveBundle1()
    │
    ├─→ Calculate Dynamic Multiplier
    │   ├─ blocksSinceStart = current - aggressiveModeStartBlock
    │   ├─ additionalMultiplier = Math.floor(blocksSinceStart / 2)
    │   └─ multiplier = 3 + additionalMultiplier
    │
    ├─→ Fetch Current RPC FeeData
    │   ├─ provider.getFeeData()
    │   └─ Get current network conditions
    │
    ├─→ Calculate Boosted Values
    │   ├─ maxFeePerGas * multiplier
    │   ├─ maxPriorityFeePerGas * multiplier
    │   └─ gasPrice * multiplier
    │
    ├─→ Apply Upper Bounds
    │   ├─ Cap at UPPER_BOUND_MAX_FEE_PER_GAS
    │   ├─ Cap at UPPER_BOUND_MAX_PRIORITY_FEE
    │   └─ Cap at UPPER_BOUND_GAS_PRICE
    │
    ├─→ Temporarily Update Gas Config
    │   ├─ updateGasConfig(aggressiveFeeData)
    │   ├─ Create transactions with new pricing
    │   └─ Restore original config in finally block
    │
    └─→ Bundle Creation & Submission
```

## Monitoring and Success Detection

### Skip Monitoring Flow
```
trackSubmissionAttempt(blockNumber, bundleSubmitted, bundleType)
    │
    ├─→ Bundle Submitted?
    │   ├─ YES → Reset consecutiveSkips to 0
    │   └─ NO → Increment consecutiveSkips
    │
    ├─→ Check Threshold
    │   ├─ consecutiveSkips >= CONSECUTIVE_SKIP_THRESHOLD?
    │   └─ YES → Send Webhook Alert
    │
    └─→ Log Debug Information
```

### Success Monitoring Flow
```
Bundle Success Detection
    │
    ├─→ Extract Transaction Hashes
    │   ├─ getBundleStats() from Flashbots
    │   ├─ Extract individual tx hashes
    │   └─ Add to SuccessMonitor
    │
    ├─→ SuccessMonitor Processing
    │   ├─ Monitor tx confirmations
    │   ├─ Verify token recovery
    │   └─ Emit 'transaction-success'
    │
    └─→ System Response
        ├─ Token recovery confirmed → Shutdown
        ├─ Defensive action → Continue
        └─ Update monitoring state
```

## Emergency Scenarios

### Hacker Activity Detected
```
Mempool: Suspicious Transaction
    │
    ├─→ Immediate Bundle1 Submission
    │   ├─ Use emergency gas (3x multiplier)
    │   ├─ Skip normal timing
    │   └─ Priority submission
    │
    ├─→ Enhanced Monitoring
    │   ├─ Increase polling frequency
    │   └─ Track transaction results
    │
    └─→ Success Tracking
        └─ Monitor for front-running success
```

### Upgrade Executed by Others
```
Safe API: Upgrade Executed
    │
    ├─→ Immediate Mode Switch
    │   ├─ Set aggressiveModeActivated = true
    │   ├─ Stop Bundle2 submissions
    │   └─ Activate aggressive Bundle1
    │
    ├─→ Enhanced Gas Strategy
    │   ├─ Start with 3x multiplier
    │   ├─ Escalate +1x every 2 blocks
    │   └─ Apply upper bound limits
    │
    └─→ Timed Shutdown
        ├─ Continue for 5 seconds
        └─ Stop all monitoring
```

### System Failure Scenarios
```
Consecutive Skip Threshold Reached
    │
    ├─→ Webhook Alert
    │   ├─ Send detailed failure information
    │   ├─ Include skip count and reasons
    │   └─ Alert external monitoring
    │
    ├─→ Log Critical Information
    │   ├─ Last successful submission block
    │   ├─ Current block number
    │   └─ Failure reasons
    │
    └─→ Continue Operation
        ├─ System continues attempting
        ├─ Reset counter on next success
        └─ No automatic shutdown
```

This execution flow ensures the system responds appropriately to all scenarios while maintaining efficiency and reliability.
