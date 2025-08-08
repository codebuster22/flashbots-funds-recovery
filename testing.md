### Testing Guide: Safe/Bundle2 Upgrade Flow and Hacker Neutralization

### Prerequisites
- Node.js 18+, npm
- RPCs:
  - Mainnet: HTTPS/WebSocket RPC
  - Sepolia: HTTPS/WebSocket RPC
- Builder:
  - Flashbots relay URL configured for the chosen chain
- Wallets:
  - Funder EOA funded with ETH
  - Compromised EOA (holds the target ERC20 tokens)
- Contracts:
  - Gnosis Safe (2-of-N recommended)
  - ProxyAdmin (owner = Safe)
  - TransparentUpgradeableProxy for the ERC20
  - ERC20 V1 (non-transferable), ERC20 V2 (transferable)
- Safe Transaction Service:
  - Mainnet: `https://safe-transaction-mainnet.safe.global`
  - Sepolia: `https://safe-transaction-sepolia.safe.global`

### Environment setup
- Create a Safe (mainnet and/or sepolia)
- Deploy ProxyAdmin with Safe as owner
- Deploy ERC20 V1 (transfers disabled), ERC20 V2 (transfers enabled)
- Deploy TransparentUpgradeableProxy pointing to V1, admin = ProxyAdmin
- Mint ERC20 proxy tokens to Compromised EOA
- Fund Funder EOA with ETH (gas) and Compromised EOA with 0 ETH (script funds it during Bundle1/2)

### .env examples
- Sepolia
```
CHAIN_ID=11155111
NORMAL_RPC=https://sepolia.infura.io/v3/...
WEBSOCKET_RPC=wss://sepolia.infura.io/ws/v3/...
USE_FLASHBOTS=true
FLASHBOTS_RPC=<sepolia flashbots relay>
FUNDER_PRIVATE_KEY=...
COMPROMISED_PRIVATE_KEY=...
ERC20_TOKEN_ADDRESS=<proxy_addr>
PROXY_CONTRACT_ADDRESS=<proxy_addr>
PROXY_ADMIN_ADDRESS=<proxy_admin_addr>
SAFE_ADDRESS=<safe_addr>
SAFE_API_BASE_URL=https://safe-transaction-sepolia.safe.global
ETH_AMOUNT_TO_FUND=0.002
BASE_GAS_PRICE=4
TIP_IN_GWEI=5
SIMULATE=false
```

- Mainnet
```
CHAIN_ID=1
NORMAL_RPC=https://mainnet.infura.io/v3/...
WEBSOCKET_RPC=wss://mainnet.infura.io/ws/v3/...
USE_FLASHBOTS=true
FLASHBOTS_RPC=https://relay.flashbots.net
FUNDER_PRIVATE_KEY=...
COMPROMISED_PRIVATE_KEY=...
ERC20_TOKEN_ADDRESS=<proxy_addr>
PROXY_CONTRACT_ADDRESS=<proxy_addr>
PROXY_ADMIN_ADDRESS=<proxy_admin_addr>
SAFE_ADDRESS=<safe_addr>
SAFE_API_BASE_URL=https://safe-transaction-mainnet.safe.global
ETH_AMOUNT_TO_FUND=0.002
BASE_GAS_PRICE=10
TIP_IN_GWEI=3
SIMULATE=false
```

### Manual testing (Sepolia then Mainnet)

- Safe upgrade path (upgrade-first Bundle2)
  1) Propose upgrade in the Safe (ProxyAdmin.upgrade/upgradeAndCall to implementation V2).
  2) Collect required confirmations (do not execute).
  3) Start orchestrator:
     - `npm start`
  4) Orchestrator behavior:
     - Detects confirmations-ready
     - Builds raw signed Safe execTransaction (outer EIP-1559 only), emits upgrade-detected
     - Submits Bundle2: [Safe exec, fund, recover, withdraw] via Flashbots
  5) Execute expectations:
     - The Safe exec includes first; proxy points to V2; transfer becomes enabled
     - Recovery and withdraw execute in the same block; tokens move to Funder

- Hacker neutralization
  1) With orchestrator running, from Compromised EOA submit:
     - approve(spender, amount) with low fees
     - or transfer(thirdParty, amount) with low fees
     - Example (Foundry cast): `cast send <erc20> "approve(address,uint256)" <spender> <amount> --private-key <COMPROMISED_PK> --rpc-url <RPC> --gas-price 1gwei`
  2) Orchestrator behavior:
     - Detects ERC20 action from compromised address
     - Creates emergency replacement:
       - transfer hijack: full balance to Funder
       - or nonce-burn: 0 ETH self-transfer to block approval
     - Broadcasts replacement (EIP-1559) with higher gas dominance
  3) Expected:
     - Replacement lands before hacker’s tx
     - If hijack, tokens arrive to Funder; if neutralization, approval is blocked

### Automated testing (scripted steps using this repo)

- Orchestrator (full three-phase)
  - Use `npm start` with SIMULATE=false
  - Script the Safe proposal and signature collection off-repo (via Safe UI/API)
  - Once confirmations-ready, observe orchestrator building Safe exec and submitting Bundle2
  - Validate results and logs (see “Expected logs”)

- Bundle1-only baseline
  - `npm run bundle1` (for isolated baseline without Safe)
  - Avoids Safe/Proxy env; submits fund/recover/withdraw per block
  - Use this to validate Flashbots simulation/submission and balances movement when transfers are already enabled

- Advanced monitoring (optional)
  - `npm run monitor:advanced` to observe mempool detections and alerts without Bundle submission logic
  - Good for dry-testing filters and event emission

### Expected results

- Logs
  - Phase transitions: proposal-detected → confirmations-ready → mempool-active
  - Safe exec build: “rawSignedTransactionHexString built” (not printed raw; length/preview logs ok)
  - Bundle2: simulation OK, submitted to Flashbots for target block
  - Inclusion: “Bundle2 included in block X” then orchestrator stops
  - Emergency replacements: “transfer hijack” or “approval neutralization” with gas dominance logs

- State
  - After upgrade-first bundle:
    - TransparentUpgradeableProxy implementation = V2
    - Funder receives ERC20 tokens (verify `balanceOf(funder)` > 0)
  - After a hijack replacement:
    - Funder receives ERC20 tokens
  - After a neutralization:
    - Hacker’s approval does not land; Compromised nonce consumed by 0 ETH tx

- Failure modes to watch
  - Upgrade proposal doesn’t meet confirmations: orchestrator stays in monitoring; no Bundle2 submission
  - Flashbots not including bundle: raise `TIP_IN_GWEI` and/or `BASE_GAS_PRICE`; try multiple blocks
  - Mempool detection emits hints but no Safe proposal found: ensure Safe API base URL matches network, proposal is confirmed and not executed

### Notes and tips
- Always set CHAIN_ID per network. All txs are EIP-1559.
- We only act on Safe proposals targeting `ProxyAdmin` with `upgrade/upgradeAndCall`. Others are ignored.
- Flashbots-only: ensure the relay endpoint matches your network and credentials.
- Prefer testing end-to-end first on Sepolia with small amounts, then mainnet with minimal value.

---

### Smart contract specification and upgrade proposal (for Safe UI)

#### Goal
- Start with a simple ERC20 that is non-transferrable (V1) behind a TransparentUpgradeableProxy.
- Upgrade to a transferrable ERC20 (V2) using a Safe-controlled `ProxyAdmin` via a Safe multisig proposal.

#### Contracts
- `MyTokenV1` (implementation V1)
  - Based on OpenZeppelin `ERC20Upgradeable`.
  - Transfers disabled (e.g., override `transfer` and `transferFrom` to revert, or `_beforeTokenTransfer` to revert for non-mint/burn).
  - `initialize(name, symbol, initialHolder, initialSupply)` mints to `initialHolder` (Compromised EOA for tests).

- `MyTokenV2` (implementation V2)
  - Based on OpenZeppelin `ERC20Upgradeable` with the same storage layout as V1.
  - Transfers enabled (standard ERC20 behavior); preserves initializer guards so no re-init.

- `ProxyAdmin`
  - Admin/owner transferred to the Safe (`SAFE_ADDRESS`).

- `TransparentUpgradeableProxy`
  - `implementation = MyTokenV1` on deploy.
  - `admin = ProxyAdmin`.
  - `data = encodeFunctionData("initialize", [...])` to mint initial supply to `COMPROMISED_ADDRESS`.

Storage/layout constraints
- V2 must not change storage layout vs V1 (no new variables inserted before existing ones). Follow OZ upgradeable guidelines.

#### Deployment plan (both Sepolia and Mainnet)
1) Deploy `MyTokenV1`.
2) Deploy `ProxyAdmin`.
3) Deploy `TransparentUpgradeableProxy` with:
   - `implementation = MyTokenV1`
   - `admin = ProxyAdmin`
   - `data = MyTokenV1.initialize(name, symbol, compromised, initialSupply)`
4) Transfer `ProxyAdmin` ownership to `SAFE_ADDRESS` (your Safe multisig).
5) (Optional) Verify `balanceOf(COMPROMISED_ADDRESS)` matches `initialSupply`.
6) Deploy `MyTokenV2` (transfers enabled).

#### Building the Safe upgrade transaction (data for Safe UI)
You will create a proposal in the Safe web UI that calls `ProxyAdmin.upgrade(proxy, newImplementation)` (or `upgradeAndCall` if you need a post-upgrade call).

Inputs you need
- `PROXY_ADMIN_ADDRESS` (owner is the Safe)
- `PROXY_ADDRESS` (TransparentUpgradeableProxy)
- `NEW_IMPL_ADDRESS` (MyTokenV2 implementation)

ProxyAdmin ABI (minimal)
```json
[
  {"inputs":[{"internalType":"contract ITransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"contract ITransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeAndCall","outputs":[],"stateMutability":"payable","type":"function"}
]
```

Build calldata with ethers v6 (run locally; paste result in Safe UI):
```ts
import { Interface } from "ethers";

const proxyAdminAbi = [
  {"inputs":[{"internalType":"address","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeAndCall","outputs":[],"stateMutability":"payable","type":"function"}
];

const PROXY_ADMIN_ADDRESS = "0x...";
const PROXY_ADDRESS = "0x...";
const NEW_IMPL_ADDRESS = "0x...";

const iface = new Interface(proxyAdminAbi);

// 1) Simple upgrade (no extra call)
const dataUpgrade = iface.encodeFunctionData("upgrade", [PROXY_ADDRESS, NEW_IMPL_ADDRESS]);

// 2) Upgrade and call (if you need to call a function right after upgrade)
// Example: calling `reinitialize()` on the new implementation via proxy
// const tokenIface = new Interface([{"inputs":[],"name":"reinitialize","outputs":[],"stateMutability":"nonpayable","type":"function"}]);
// const postData = tokenIface.encodeFunctionData("reinitialize", []);
// const dataUpgradeAndCall = iface.encodeFunctionData("upgradeAndCall", [PROXY_ADDRESS, NEW_IMPL_ADDRESS, postData]);

console.log({
  to: PROXY_ADMIN_ADDRESS,
  value: "0",
  data: dataUpgrade, // or dataUpgradeAndCall
  operation: 0 // 0 = CALL
});
```

How to use this in Safe UI
- Open your Safe on the appropriate network.
- New Transaction → Contract interaction.
- `to` = `PROXY_ADMIN_ADDRESS`.
- Method = leave blank (paste `data` directly) or select via ABI upload.
- `data` = output `dataUpgrade` (or `dataUpgradeAndCall`).
- `value` = 0, `operation` = CALL.
- Propose → collect owner signatures → do not execute (the bot will execute via Bundle2).

Expected after execution
- Once your Safe upgrade is executed in-bundle, the proxy should point to `MyTokenV2` (transfers enabled) and the bot will immediately fund/transfer/withdraw in the same block.