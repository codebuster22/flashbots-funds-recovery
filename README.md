# Flashbots Funds Recovery Bot

A TypeScript-based tool for recovering funds from compromised wallets using Flashbots atomic bundles. This bot enables safe extraction of ERC20 tokens and ETH from compromised addresses by bundling funding, transfer, and return transactions atomically.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- An Ethereum RPC endpoint (Infura, Alchemy, etc.)
- Private keys for both funder and compromised wallets
- ETH for gas fees in the funder wallet

### Installation

```bash
# Clone/download the project
cd flashbots-funds-recovery

# Install dependencies (using npm - recommended)
npm install

# Alternative: using bun
# bun install
```

## 📋 Environment Setup

Create a `.env` file in the project root with the following variables:

### Quick Setup
```bash
# Copy the example file and edit with your values
cp env.example .env
# Then edit .env with your actual configuration
```

```env
# Required: RPC Configuration
NORMAL_RPC=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
WEBSOCKET_RPC=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID  # Optional: WebSocket RPC

# Required: Wallet Private Keys (without 0x prefix)
FUNDER_PRIVATE_KEY=your_funder_wallet_private_key_here
COMPROMISED_PRIVATE_KEY=your_compromised_wallet_private_key_here

# Required: Token Configuration
ERC20_TOKEN_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7  # USDT example

# Required: Account Activation (get signature from WLFI official website unlock page)
ACTIVATE_ACCOUNT_SIGNATURE=your_account_activation_signature_here

# Required: Three-phase system configuration
PROXY_ADMIN_ADDRESS=0x...                   # Proxy admin address for upgradeable contracts
SAFE_ADDRESS=0x...                          # Safe multisig address

# Optional: Advanced Configuration
CHAIN_ID=1                                  # Ethereum mainnet (default: 1)
PROXY_CONTRACT_ADDRESS=0x...                # Optional: Proxy contract address (defaults to ERC20_TOKEN_ADDRESS)
LOCKBOX_VESTING_CONTRACT_ADDRESS=0x38F7e36eC57263e470a3c5761f3Ff4b94b0FDB2E  # Lockbox vesting contract

# Optional: Execution Configuration
ETH_AMOUNT_TO_FUND=0.001                    # ETH to send for gas (default: 0.001)
BASE_GAS_PRICE=4                            # Base gas price in gwei (default: 4)
TIP_IN_GWEI=4                              # Priority fee for validators in gwei (default: 4)
SIMULATE=false                              # Set to false for real execution (default: false)
USE_FLASHBOTS=true                          # Use Flashbots for bundle submission (default: true)

# Optional: Gas Price Limits
UPPER_BOUND_GAS_PRICE=100                   # Maximum gas price in gwei (default: 100)
UPPER_BOUND_MAX_FEE_PER_GAS=100            # Maximum fee per gas in gwei (default: 100)
UPPER_BOUND_MAX_PRIORITY_FEE=50            # Maximum priority fee in gwei (default: 50)

# Optional: API Configuration
FLASHBOTS_RPC=https://relay.flashbots.net   # Custom Flashbots RPC endpoint
BEAVER_RPC_URL=https://rpc.beaverbuild.org/ # Beaver builder RPC URL
ALCHEMY_API_KEY=your_alchemy_api_key        # Alchemy API key for enhanced features
SAFE_API_BASE_URL=https://safe-transaction-mainnet.safe.global  # Safe API base URL

# Optional: Monitoring & Alerting
WEBHOOK_URL=https://your-webhook-url.com    # Webhook for notifications
CONSECUTIVE_SKIP_THRESHOLD=5                # Number of consecutive skips before alert (default: 5)
```

### Environment Variables Explained

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `NORMAL_RPC` | Ethereum RPC endpoint | `https://mainnet.infura.io/v3/...` | ✅ |
| `FUNDER_PRIVATE_KEY` | Private key of wallet with ETH for gas | `abcd1234...` | ✅ |
| `COMPROMISED_PRIVATE_KEY` | Private key of compromised wallet | `efgh5678...` | ✅ |
| `ERC20_TOKEN_ADDRESS` | Contract address of token to recover | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | ✅ |
| `ACTIVATE_ACCOUNT_SIGNATURE` | Account activation signature (get from WLFI unlock page) | `0x1234...` | ✅ |
| `PROXY_ADMIN_ADDRESS` | Proxy admin address for upgradeable contracts | `0xabc123...` | ✅ |
| `SAFE_ADDRESS` | Safe multisig address for three-phase system | `0xdef456...` | ✅ |
| `WEBSOCKET_RPC` | WebSocket RPC endpoint (optional) | `wss://mainnet.infura.io/ws/v3/...` | ❌ |
| `CHAIN_ID` | Ethereum chain ID | `1` | ❌ |
| `PROXY_CONTRACT_ADDRESS` | Proxy contract address (defaults to ERC20_TOKEN_ADDRESS) | `0x789abc...` | ❌ |
| `LOCKBOX_VESTING_CONTRACT_ADDRESS` | Lockbox vesting contract address | `0x38F7e36...` | ❌ |
| `ETH_AMOUNT_TO_FUND` | ETH amount to fund for gas fees | `0.001` | ❌ |
| `BASE_GAS_PRICE` | Base gas price in gwei | `4` | ❌ |
| `TIP_IN_GWEI` | Priority fee for Flashbots validators | `4` | ❌ |
| `SIMULATE` | Run simulation only (true/false) | `false` | ❌ |
| `USE_FLASHBOTS` | Use Flashbots for bundle submission | `true` | ❌ |
| `UPPER_BOUND_GAS_PRICE` | Maximum gas price in gwei | `100` | ❌ |
| `UPPER_BOUND_MAX_FEE_PER_GAS` | Maximum fee per gas in gwei | `100` | ❌ |
| `UPPER_BOUND_MAX_PRIORITY_FEE` | Maximum priority fee in gwei | `50` | ❌ |
| `FLASHBOTS_RPC` | Custom Flashbots RPC endpoint | `https://relay.flashbots.net` | ❌ |
| `BEAVER_RPC_URL` | Beaver builder RPC URL | `https://rpc.beaverbuild.org/` | ❌ |
| `ALCHEMY_API_KEY` | Alchemy API key for enhanced features | `your_api_key` | ❌ |
| `SAFE_API_BASE_URL` | Safe API base URL | `https://safe-transaction-mainnet.safe.global` | ❌ |
| `WEBHOOK_URL` | Webhook URL for notifications | `https://your-webhook-url.com` | ❌ |
| `CONSECUTIVE_SKIP_THRESHOLD` | Consecutive skips before alert | `5` | ❌ |

### 🔐 Account Activation Signature

The `ACTIVATE_ACCOUNT_SIGNATURE` is required for WLFI token operations. To obtain this signature:

1. Visit the **WLFI official website**
2. Navigate to the **unlock page** 
3. Connect your compromised wallet
4. Complete the account activation process
5. Copy the generated signature
6. Add it to your `.env` file as `ACTIVATE_ACCOUNT_SIGNATURE`

**Important**: This signature is wallet-specific and must be obtained for the exact compromised wallet address you're recovering from.

## 🎯 How to Run

### 1. Simulation Mode (Recommended First)

```bash
# Run simulation to test bundle
npm start

# Alternative with bun
# bun start
```

This will:
- ✅ Test all transactions without executing
- ✅ Show gas estimates and costs
- ✅ Verify bundle construction
- ✅ Display expected results

### 2. Production Mode

**⚠️ WARNING: This executes real transactions with real funds!**

```bash
# Set SIMULATE=false in .env file
echo "SIMULATE=false" >> .env

# Run actual recovery
npm start
```

## 📊 What to Expect

### Simulation Output
```
{
  chainId: 1n,
  maxFeePerGas: 28000000000n,
  maxPriorityFeePerGas: 4000000000n,
  type: 2,
  nonce: 1,
  to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  data: '0xa9059cbb...'
}

{
  bundleGasPrice: 2000000000n,
  bundleHash: '0x6dcdc8021f8dba59d4580e863857775dc7f87a53733a307a0d58212ee78b8d47',
  coinbaseDiff: 160790000000000n,
  totalGasUsed: 80395,
  results: [...]
}
```

### Production Output
```
Sending bundle...
Bundle sent successfully
0x8841d8ef65e4e80a6571d821236b5905d9a81ebc3193ffe1ff7fa8233cbe455c
monitoring bundle status...

Check 1: Bundle stats: {
  isHighPriority: false,
  isSentToMiners: true,
  isSimulated: true,
  simulatedAt: '2025-08-05T16:41:16.052Z',
  submittedAt: '2025-08-05T16:41:16.052Z'
}
```

## 🔄 Transaction Flow

The bot creates an atomic bundle with these transactions:

1. **Fund Transaction**: Funder → Compromised wallet (ETH for gas)
2. **Recovery Transaction**: Compromised wallet → Funder (ERC20 tokens)
3. **Return Transaction**: Compromised wallet → Funder (remaining ETH)

**Atomic guarantee**: Either all transactions succeed, or none execute.

## ⚡ Bundle Inclusion Factors

Bundle inclusion in blocks depends on several factors:

### 1. 🏆 Reputation
- **High reputation accounts** get priority
- Built through consistent, profitable bundle submissions
- Measured by historical validator payments and gas usage

### 2. 💰 Gas Fees & Priority Fees
- **`BASE_GAS_PRICE`**: Base fee willing to pay (in gwei)
- **`TIP_IN_GWEI`**: Priority fee (tip) for validators
- Higher tips = better inclusion chances
- Formula: `Total Fee = BASE_GAS_PRICE * 3 + TIP_IN_GWEI`

### 3. 🎯 MEV Opportunity
- Bundle must be profitable for block builders
- Competition with other MEV searchers
- Market timing and conditions

### 4. ⏰ Network Timing
- Bundle submission timing within block slots
- Network congestion
- Builder selection randomness

## 📈 Optimizing Inclusion Chances

### Increase Priority Fees
```env
TIP_IN_GWEI=5    # Higher tip for better priority
BASE_GAS_PRICE=15 # Higher base gas price
```

### Build Reputation
- Start with smaller, profitable bundles
- Consistently submit well-formed bundles
- Monitor and improve success rates

### Timing Optimization
- Submit during high MEV activity periods
- Monitor gas prices and adjust accordingly
- Consider multiple submissions with different parameters

## 🛡️ Security Considerations

### Private Key Safety
- **Never commit `.env` to version control**
- Use secure key management practices
- Test with small amounts first

### Fund Requirements
- Funder wallet needs sufficient ETH for gas fees
- Compromised wallet should have the target ERC20 tokens
- Consider gas price fluctuations

### Network Risks
- Mainnet transactions are irreversible
- Bundle failure still consumes some gas
- Always test in simulation mode first

## 🔧 Troubleshooting

### Common Issues

#### Bundle Not Included
```
Check 50: Bundle stats: {
  isHighPriority: false,
  isSentToMiners: false,
  isSimulated: true
}
```

**Solutions:**
- Increase `TIP_IN_GWEI` (try 5-10 gwei)
- Increase `BASE_GAS_PRICE`
- Check account reputation
- Retry during different network conditions

#### "Unable to decode txs" Error
- Ensure `chainId: 1` is set for mainnet
- Verify all transactions have proper EIP-1559 format
- Check transaction encoding

#### Nonce Errors
- Bundle manages nonces automatically
- If issues persist, check account transaction history

#### Gas Estimation Failures
- Verify RPC endpoint is responsive
- Check account balances and token ownership
- Ensure contract addresses are correct

### Debug Mode

Add console logs for detailed debugging:
```typescript
console.log("Current nonces:", { funderNonce, compromisedNonce });
console.log("Gas calculations:", { maxFeePerGas, maxPriorityFeePerGas });
```

## 📝 Example Use Cases

### USDT Recovery
```env
ERC20_TOKEN_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7
ETH_AMOUNT_TO_FUND=0.001
TIP_IN_GWEI=3
```

### USDC Recovery
```env
ERC20_TOKEN_ADDRESS=0xA0b86a33E6441026cA8fd7D72eeA6D79a9daBAFf
ETH_AMOUNT_TO_FUND=0.002
TIP_IN_GWEI=5
```

### High-Value Recovery
```env
ERC20_TOKEN_ADDRESS=0x...
ETH_AMOUNT_TO_FUND=0.005
BASE_GAS_PRICE=20
TIP_IN_GWEI=10
```
