# Critical Points to Remember

## 🚨 Security-Critical Points

### Private Key Management
- **NEVER commit private keys to version control**
- Store private keys in `.env` file (ignored by git)
- Use different private keys for testnet and mainnet
- The `FUNDER_PRIVATE_KEY` should have sufficient ETH for funding operations
- The `COMPROMISED_PRIVATE_KEY` is the wallet being protected/recovered

### Address Validation
- **All addresses must be checksummed for Safe API calls**
- Safe API returns HTTP 422 if addresses are not properly checksummed
- Use `ethers.getAddress()` to ensure proper checksumming
- ProxyAdmin addresses can be lowercase for Alchemy filtering

### Contract Verification
- **Verify all contract addresses before deployment**
- Ensure ERC20 token contract is correct
- Verify ProxyAdmin contract controls the proxy
- Confirm Safe multisig setup and signer addresses
- Double-check proxy contract implementation and upgrade patterns

## ⚡ Transaction-Critical Points

### EIP-1559 Only
- **System only sends EIP-1559 transactions (type: 2)**
- All transactions include `maxFeePerGas` and `maxPriorityFeePerGas`
- System can detect and handle legacy transactions from hackers
- Never mix transaction types in the same bundle

### Gas Strategy Requirements
- **Base gas pricing must be competitive for bundle inclusion**
- Upper bounds prevent excessive gas costs during aggressive mode
- Dynamic escalation starts at 3x and increases every 2 blocks
- Gas limits are hardcoded: 21,000 (ETH), 100,000 (ERC20), 50,000 (withdrawal)

### Nonce Management
- **Flashbots automatically manages nonces for regular transactions**
- Safe `execTransaction` requires manual nonce fetching and setting
- Nonce must be fetched fresh for each block (not cached)
- Nonce errors will cause entire bundle to fail

### Conditional Withdrawal Logic
- **Withdrawal transaction is excluded if calculated amount <= 0**
- Gas cost calculation includes both current and ERC20 transaction costs
- Bundle composition changes dynamically (2-4 transactions)
- Log messages indicate when withdrawal is excluded and why

## 🔄 System Flow Critical Points

### Three-Phase System
- **System starts in Standby phase with Bundle1 active**
- Phase transitions are event-driven and irreversible
- Only one Bundle2 controller can be active at a time
- Emergency mode bypasses normal phase restrictions

### Event Deduplication
- **Multiple monitoring components must avoid infinite loops**
- SafeProposalMonitor tracks processed proposals and executions
- EventManager prevents re-emission of duplicate events
- Aggressive mode can only be activated once per session

### Bundle Timing
- **Bundle1 targets block N+1, Bundle2 targets block N+2**
- Target blocks are calculated when block N is received
- Flashbots bundles are valid for one block only
- Late submission results in automatic rejection

### Success Detection
- **Success monitoring requires actual transaction hash addition**
- Bundle success doesn't guarantee token recovery
- Individual transaction monitoring verifies actual token transfer
- System only shuts down on confirmed token recovery

## 🏗️ Architecture Critical Points

### Component Dependencies
- **EventManager coordinates all monitoring components**
- Safe monitoring requires valid Safe API endpoints
- Mempool monitoring requires Alchemy WebSocket connection
- All components depend on properly configured providers

### Event Handler Order
- **Event handlers must be wired before starting monitoring**
- Bundle2 events must be handled before Bundle1 in some cases
- Success monitoring starts before bundle submission begins
- Cleanup order matters during system shutdown

### Provider Configuration
- **WebSocket provider required for real-time mempool monitoring**
- Flashbots provider requires specific configuration for network
- Normal provider used for transaction submission and queries
- Provider failures can cascade through the entire system

## 📊 Monitoring Critical Points

### Skip Detection
- **Consecutive skip counter resets on ANY successful submission**
- Skip threshold is configurable but defaults to 5
- Webhook alerts continue until manual intervention
- Skip detection tracks Bundle1 and Bundle2 independently

### Webhook Integration
- **Webhook URL is optional but recommended for production**
- Webhook failures don't affect system operation
- Alert payloads include detailed context for debugging
- Webhook timeouts should be handled gracefully

### Log Level Configuration
- **DEBUG mode significantly increases log volume**
- INFO mode provides operational visibility without spam
- Bundle-specific tags help filter relevant logs
- Log rotation should be configured for production

## 💰 Economic Critical Points

### Funding Requirements
- **Funder wallet must have sufficient ETH for multiple operations**
- ETH_AMOUNT_TO_FUND should cover worst-case gas scenarios
- Emergency mode can consume significant ETH rapidly
- Upper bounds prevent total fund depletion

### Bundle Economics
- **Flashbots bundles compete on priority fee**
- Bundle inclusion is not guaranteed even with high gas
- Failed bundles consume no gas but waste time
- Simulation success doesn't guarantee inclusion

### Gas Price Competition
- **Network congestion affects bundle inclusion rates**
- Aggressive mode responds to competitive conditions
- Base gas pricing should reflect normal network conditions
- Upper bounds must balance inclusion and cost protection

## 🔍 Integration Critical Points

### Safe API Dependencies
- **Safe API requires specific endpoint URLs for different networks**
- API rate limiting may affect polling frequency
- Safe transaction hash format is different from Ethereum transaction hash
- API responses include both pending and executed transactions

### Alchemy Integration
- **Alchemy API key required for enhanced mempool monitoring**
- WebSocket subscriptions have connection limits
- Address filtering is case-sensitive for some operations
- Subscription failures require reconnection logic

### Flashbots Integration
- **Flashbots relay must match the target network**
- Bundle submission requires proper authentication
- Simulation results don't guarantee inclusion
- Bundle statistics are only available after inclusion attempts

## 🛠️ Development Critical Points

### Environment Variables
- **All required variables must be present for system startup**
- Optional variables have sensible defaults
- Chain ID must match all configured endpoints
- Missing variables cause immediate startup failure

### Type Safety
- **Mixed bundle types require careful type handling**
- Transaction signatures must match expected formats
- Event payloads must match interface definitions
- BigInt operations require explicit type conversion

### Error Handling
- **RPC errors are common and must be handled gracefully**
- API rate limits require retry logic with backoff
- Network disconnections should trigger reconnection
- Critical errors should trigger alerts but not system shutdown

### Testing Requirements
- **Testnet deployment required before mainnet usage**
- All scenarios should be tested with small amounts
- Contract interactions should be verified on testnets
- Monitoring systems should be tested with simulated events

## 🎯 Operational Critical Points

### Deployment Checklist
1. ✅ All environment variables configured and validated
2. ✅ Contract addresses verified on target network
3. ✅ Safe multisig properly configured and tested
4. ✅ Webhook endpoint configured and responding
5. ✅ Sufficient ETH in funder wallet
6. ✅ All RPC endpoints accessible and responsive
7. ✅ Log monitoring and alerting configured

### Monitoring Requirements
- **System should be monitored 24/7 in production**
- Webhook alerts should trigger immediate investigation
- Log analysis should identify patterns and issues
- Performance metrics should track bundle inclusion rates

### Emergency Procedures
- **Manual system shutdown may be required in emergencies**
- Backup recovery procedures should be documented
- Alternative recovery methods should be available
- Emergency contact procedures should be established

These critical points represent the most important considerations for safe and effective system operation. Failure to observe these points can result in security vulnerabilities, financial losses, or system failures.
