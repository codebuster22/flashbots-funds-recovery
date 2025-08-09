# System Architecture

## High-Level Architecture Overview

The Flashbots Recovery System is built around a three-phase event-driven architecture that monitors, detects, and responds to various blockchain events in real-time. The system operates as a coordinated set of components that work together to protect compromised wallets and recover tokens.

## Core Components

### 1. Master Orchestrator (`index.ts`)
**Role**: Central coordination hub and main entry point
- Manages all subsystems and their lifecycles
- Coordinates between different strategies (Bundle1, Bundle2, Emergency)
- Handles success monitoring and skip detection
- Implements dynamic gas escalation strategies
- Sends webhook alerts for monitoring

**Key Responsibilities**:
- System initialization and configuration
- Event routing and coordination
- Bundle strategy selection and execution
- Monitoring and alerting
- Graceful shutdown and cleanup

### 2. Three-Phase Event Manager (`src/monitoring/eventManager.ts`)
**Role**: Central event processing and coordination engine
- Orchestrates the three-phase monitoring system
- Manages transitions between monitoring phases
- Coordinates between different monitoring components
- Processes and routes events between subsystems

**Three Phases**:
1. **Standby Phase**: Waiting for upgrade proposals
2. **Proposal Detected Phase**: Monitoring proposal confirmations
3. **Mempool Active Phase**: Active mempool monitoring and execution

### 3. Safe Monitoring System
**Components**:
- **Safe Proposal Monitor** (`src/monitoring/safe/safeProposalMonitor.ts`): Monitors Gnosis Safe for new upgrade proposals
- **Confirmation Tracker** (`src/monitoring/safe/confirmationTracker.ts`): Tracks proposal confirmation progress
- **Safe Exec Builder** (`src/safeExecBuilder.ts`): Builds executable Safe transactions

**Role**: Monitors and processes Gnosis Safe multisig upgrade transactions
- Polls Safe Transaction Service API for new proposals
- Filters for ProxyAdmin upgrade transactions
- Tracks confirmation progress and readiness
- Builds executable transactions when thresholds are met

### 4. Mempool Monitoring System
**Components**:
- **Mempool Monitor** (`src/monitoring/mempoolMonitor.ts`): Real-time mempool monitoring
- **Upgrade Detector** (`src/monitoring/detectors/upgradeDetector.ts`): Detects upgrade transactions
- **Upgrade Filter** (`src/monitoring/filters/upgradeFilter.ts`): Filters relevant transactions

**Role**: Real-time monitoring of pending transactions
- Uses Alchemy WebSocket subscriptions for real-time data
- Filters transactions by source/destination addresses
- Detects upgrade and hacker activity patterns
- Triggers immediate response strategies

### 5. Bundle Execution System
**Components**:
- **Bundle1 Strategy**: Continuous token recovery attempts
- **Bundle2 Controller** (`src/bundle2Controller.ts`): Coordinated upgrade + recovery
- **Bundle Creators** (`src/bundles/`): Transaction bundle construction
- **Bundle Signing** (`src/signBundle.ts`): Transaction signing and preparation

**Role**: Executes atomic transaction bundles via Flashbots
- Creates different bundle types based on scenarios
- Handles conditional transaction inclusion (e.g., withdrawal transactions)
- Manages gas strategies and escalation
- Submits to Flashbots relay and monitors inclusion

### 6. Transaction Creation System
**Components**:
- **Funding Transaction Creator** (`src/createFundingTrx.ts`)
- **ERC20 Recovery Transaction Creator** (`src/createERC20RecoveryTrx.ts`)
- **Withdrawal Transaction Creator** (`src/createWithdrawTrx.ts`)

**Role**: Creates and configures individual transactions
- Handles EIP-1559 gas pricing
- Implements conditional transaction logic
- Calculates gas costs and funding requirements
- Returns properly formatted transaction objects

### 7. Gas Management System
**Components**:
- **Gas Controller** (`src/gasController.ts`): Centralized gas pricing
- **Dynamic Gas Escalation**: Aggressive mode gas strategies
- **Upper Bound Protection**: Gas cost limits and safeguards

**Role**: Manages all gas pricing across the system
- Provides consistent gas pricing interface
- Implements dynamic escalation strategies
- Enforces upper bound limits for cost protection
- Adapts to network conditions

### 8. Success Monitoring System
**Components**:
- **Success Monitor** (`src/successMonitor.ts`): Transaction success tracking
- **Skip Monitoring**: Consecutive failure detection
- **Webhook Integration**: External alerting system

**Role**: Monitors system effectiveness and alerts on issues
- Tracks transaction confirmations and success
- Detects token recovery completion
- Monitors for consecutive bundle failures
- Sends webhook alerts for external monitoring

### 9. Alerting and Logging System
**Components**:
- **Alert Logger** (`src/monitoring/alertLogger.ts`): Centralized logging
- **Webhook Alerts**: External monitoring integration
- **Debug/Info Modes**: Configurable logging levels

**Role**: Provides visibility and monitoring capabilities
- Structured logging with severity levels
- Bundle-specific log tagging
- External webhook integration
- Debug mode for troubleshooting

## Data Flow Architecture

### Event-Driven Flow
```
Safe API ─┐
          ├─→ Event Manager ─→ Master Orchestrator ─→ Bundle Controllers ─→ Flashbots
Mempool ──┘                                        └─→ Success Monitor ──→ Webhooks
```

### Bundle Strategy Selection
```
Phase Detection ─→ Strategy Selection ─→ Bundle Creation ─→ Submission ─→ Monitoring
      │                    │                   │              │           │
      │                    ├─ Bundle1         ├─ Fund        ├─ FB Relay  ├─ Success
      │                    ├─ Bundle2         ├─ Recovery    │             ├─ Skip Count
      └─ Standby          └─ Emergency       └─ Withdraw    └─ Stats      └─ Alerts
         Proposal
         Mempool-Active
```

### Gas Strategy Flow
```
Base Gas Config ─→ Gas Controller ─→ Transaction Creation ─→ Dynamic Escalation
                                   │                        │
                                   ├─ 1x Multiplier        ├─ 3x Base
                                   ├─ 2x Bundle2           ├─ +1x per 2 blocks
                                   └─ 3x Emergency         └─ Upper Bound Caps
```

## Component Interactions

### Startup Sequence
1. **Configuration Loading**: Environment variables and validation
2. **Component Initialization**: All monitoring and execution components
3. **Event Handler Setup**: Wire event listeners between components
4. **Monitoring Activation**: Start Safe API polling and mempool monitoring
5. **Bundle1 Strategy**: Begin continuous token recovery attempts

### Event Processing
1. **Event Detection**: Safe API or mempool events detected
2. **Event Filtering**: Relevant events identified and classified
3. **Event Routing**: Events sent to appropriate handlers
4. **Strategy Activation**: Bundle strategies activated based on event type
5. **Execution Monitoring**: Bundle submission and success tracking

### Emergency Scenarios
1. **Hacker Activity Detected**: Immediate Bundle1 with emergency gas
2. **Upgrade Executed by Others**: Switch to aggressive Bundle1 mode
3. **Consecutive Failures**: Webhook alerts and potential system shutdown
4. **Success Detection**: System shutdown and cleanup

## System States

### Operating Modes
- **Normal Mode**: Standard Bundle1 with base gas pricing
- **Aggressive Mode**: Enhanced Bundle1 with escalating gas (when upgrade executed)
- **Bundle2 Mode**: Coordinated upgrade + recovery bundles
- **Emergency Mode**: Maximum gas pricing for immediate response

### Phase Transitions
- **Standby → Proposal Detected**: New upgrade proposal found
- **Proposal Detected → Confirmations Ready**: Threshold confirmations reached
- **Confirmations Ready → Mempool Active**: Executable transaction built
- **Any Phase → Emergency**: Hacker activity or upgrade execution detected

## Scalability and Performance

### Resource Management
- **Connection Pooling**: Efficient RPC and WebSocket management
- **Event Batching**: Grouped processing for efficiency
- **Memory Management**: Cleanup of completed monitoring tasks
- **Rate Limiting**: Respectful API usage patterns

### Monitoring Efficiency
- **Selective Polling**: Only relevant Safe proposals monitored
- **Address Filtering**: Mempool monitoring limited to specific addresses
- **Event Deduplication**: Prevent processing of duplicate events
- **Skip Detection**: Early detection of system issues

This architecture ensures the system can respond quickly to threats while maintaining reliability and cost-effectiveness.
