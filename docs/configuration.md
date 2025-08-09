# Configuration Guide

## Environment Variables Reference

### Required Variables

#### Network Configuration
```bash
# Primary RPC endpoint for transaction submission and queries
NORMAL_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# WebSocket RPC for real-time monitoring (optional, falls back to NORMAL_RPC)
WEBSOCKET_RPC=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Chain ID (1 for mainnet, 11155111 for Sepolia)
CHAIN_ID=1

# Flashbots relay URL
FLASHBOTS_RPC=https://relay.flashbots.net
```

#### Wallet Configuration
```bash
# Private key of wallet that will fund operations and receive recovered tokens
FUNDER_PRIVATE_KEY=0x1234...

# Private key of compromised wallet that needs protection/recovery
COMPROMISED_PRIVATE_KEY=0x5678...

# Public address of compromised wallet (for verification)
COMPROMISED_PUBLIC_KEY=0xabcd...
```

#### Contract Addresses
```bash
# ERC20 token contract address
ERC20_TOKEN_ADDRESS=0x...

# Proxy contract address (usually same as ERC20_TOKEN_ADDRESS)
PROXY_CONTRACT_ADDRESS=0x...

# ProxyAdmin contract address (controls upgrades)
PROXY_ADMIN_ADDRESS=0x...

# Gnosis Safe multisig address
SAFE_ADDRESS=0x...
```

#### Operational Configuration
```bash
# Amount of ETH to fund compromised wallet (in ETH units)
ETH_AMOUNT_TO_FUND=0.1

# Base gas price in gwei
BASE_GAS_PRICE=4

# Priority fee in gwei
TIP_IN_GWEI=10
```

### Optional Variables

#### Enhanced Monitoring
```bash
# Alchemy API key for enhanced mempool monitoring
ALCHEMY_API_KEY=your_alchemy_api_key

# Safe Transaction Service API base URL
SAFE_API_BASE_URL=https://safe-transaction-mainnet.safe.global
```

#### Safety Limits
```bash
# Upper bounds for aggressive gas pricing (in gwei)
UPPER_BOUND_GAS_PRICE=100
UPPER_BOUND_MAX_FEE_PER_GAS=100
UPPER_BOUND_MAX_PRIORITY_FEE=50
```

#### Monitoring & Alerts
```bash
# Webhook URL for external monitoring alerts
WEBHOOK_URL=https://your-monitoring-service.com/webhook

# Number of consecutive skipped bundles before alert
CONSECUTIVE_SKIP_THRESHOLD=5

# Logging level (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO
```

#### Testing & Development
```bash
# Enable simulation mode (true/false)
SIMULATE=false

# Force Flashbots usage (legacy, always true now)
USE_FLASHBOTS=true
```

## Network-Specific Configurations

### Mainnet Configuration
```bash
CHAIN_ID=1
NORMAL_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
FLASHBOTS_RPC=https://relay.flashbots.net
SAFE_API_BASE_URL=https://safe-transaction-mainnet.safe.global
```

### Sepolia Testnet Configuration
```bash
CHAIN_ID=11155111
NORMAL_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
FLASHBOTS_RPC=https://relay-sepolia.flashbots.net
SAFE_API_BASE_URL=https://safe-transaction-sepolia.safe.global
```

## Gas Strategy Configuration

### Conservative Settings (Low Cost)
```bash
BASE_GAS_PRICE=2
TIP_IN_GWEI=5
UPPER_BOUND_GAS_PRICE=50
UPPER_BOUND_MAX_FEE_PER_GAS=50
UPPER_BOUND_MAX_PRIORITY_FEE=25
```

### Standard Settings (Balanced)
```bash
BASE_GAS_PRICE=4
TIP_IN_GWEI=10
UPPER_BOUND_GAS_PRICE=100
UPPER_BOUND_MAX_FEE_PER_GAS=100
UPPER_BOUND_MAX_PRIORITY_FEE=50
```

### Aggressive Settings (High Priority)
```bash
BASE_GAS_PRICE=8
TIP_IN_GWEI=20
UPPER_BOUND_GAS_PRICE=200
UPPER_BOUND_MAX_FEE_PER_GAS=200
UPPER_BOUND_MAX_PRIORITY_FEE=100
```

## Monitoring Configuration

### Production Monitoring
```bash
LOG_LEVEL=INFO
WEBHOOK_URL=https://your-production-monitoring.com/alerts
CONSECUTIVE_SKIP_THRESHOLD=3
```

### Development/Testing
```bash
LOG_LEVEL=DEBUG
WEBHOOK_URL=https://webhook.site/your-test-endpoint
CONSECUTIVE_SKIP_THRESHOLD=10
```

## Security Considerations

### Key Management
- Never commit private keys to version control
- Use different keys for testnet and mainnet
- Consider hardware wallet integration for production
- Implement key rotation procedures

### Network Security
- Use trusted RPC endpoints
- Verify Flashbots relay URLs
- Monitor for man-in-the-middle attacks
- Use VPN or secure networks when possible

### Operational Security
- Limit access to configuration files
- Monitor system logs for suspicious activity
- Implement alerting for configuration changes
- Regular security audits of deployment environment

## Validation and Testing

### Configuration Validation
```bash
# Test RPC connectivity
curl -X POST $NORMAL_RPC -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Verify wallet addresses
# Check that funder wallet has sufficient ETH
# Verify compromised wallet contains target tokens
# Confirm all contract addresses are correct
```

### Testnet Testing Checklist
- [ ] All environment variables configured correctly
- [ ] RPC endpoints accessible and responsive
- [ ] Wallet keys valid and funded appropriately
- [ ] Contract addresses verified on target network
- [ ] Safe multisig accessible and configured
- [ ] Webhook endpoint responding correctly
- [ ] Log levels producing expected output

This configuration guide ensures proper system setup across different environments and use cases.
