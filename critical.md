### Critical logical issues to address (no code)

- Bold: Event propagation mismatch (Safe events don’t reach orchestrator)
  - `MasterOrchestrator` subscribes via `this.eventManager.on('upgrade-detected' | 'hacker-erc20-activity', ...)`, but `ThreePhaseEventManager.on(...)` only proxies to the mempool monitor’s events. Safe-based events emitted by `SafeProposalMonitor` and `ConfirmationTracker` are handled internally and not re-emitted for the orchestrator to catch. Result: Safe-detected upgrades won’t trigger `startBundle2Strategy` in the orchestrator.

- Bold: Inconsistent event payload: rawTransactionHex vs rawTransactionHash
  - `UpgradeDetectedEvent` expects `rawTransactionHex`, but `SafeProposalMonitor.handleExecutedUpgrade` emits `rawTransactionHash`. `UpgradeHandler` then passes `event.rawTransactionHex` downstream, which will be undefined for Safe-originated events, breaking Bundle2 preparation. This is a hard functional break in the Safe path.

- Bold: Bundle2 upgrade transaction cannot be reproduced by us
  - `Bundle2Creator.parseUpgradeTransaction` “parses” the upgrade tx JSON and creates a new tx signed by our funder (`funderAuthSigner`). We can’t validly sign the Safe’s upgrade. The correct approach would be to include the original raw signed upgrade transaction in the bundle; instead, we re-create an invalid one. This guarantees Bundle2 won’t perform the upgrade as intended.

- Bold: “Upgrade transaction” handled as JSON, not raw tx
  - Upgrade flow passes/serializes JSON (e.g., `UpgradeDetector.serializeTransaction`, `MempoolMonitor.serializeTransaction`) and not raw signed transaction hex. Builders require raw signed txs. This makes the “include upgrade first in bundle” path logically inoperable.

- Bold: Simulation always uses Flashbots even when using Beaver/other builder
  - `simulateBundle` always calls `flashbotsProvider.simulate(...)`. In Beaver mode (or if using a different relay for Sepolia), simulation will fail if `FLASHBOTS_RPC` is not provided or incompatible. Submission path respects `USE_FLASHBOTS`, but simulation does not, causing runtime failure or false negatives.

- Bold: Chain ID inconsistency in Bundle2 upgrade tx
  - `Bundle2Creator.parseUpgradeTransaction` defaults `chainId` to 1 and doesn’t use env `CHAIN_ID`. On Sepolia (or any non-mainnet), that created tx is invalid, further breaking Bundle2.

- Bold: Success detection gap for Beaver path
  - When `USE_FLASHBOTS=false`, we submit via Beaver but don’t receive an inclusion status. Also, we don’t add any bundle tx hashes to `SuccessMonitor`, so no “transaction-success” events will ever fire for bundles. Result: orchestrator won’t auto-stop on a successful Beaver inclusion.

- Bold: Misleading “upgrade-detected → Bundle2” assumption for Safe
  - `SafeProposalMonitor.handleExecutedUpgrade` emits “upgrade-detected” after execution with only a hash. But the Bundle2 flow expects to include the upgrade transaction itself first. After it’s already executed, including it is pointless. There’s a conceptual mismatch: the post-execution event can’t power the “upgrade-first” bundle as designed.

- Bold: ERC20 recovery amount argument ignored
  - `createERC20RecoveryTrx` takes `amount` but encodes transfer using the global `balance` captured at startup, ignoring the parameter. This can create mismatches if different amounts were intended, and it relies on a potentially stale balance snapshot.

- Bold: SuccessMonitor marks some cases as “recovered” without proof
  - `SuccessMonitor.checkTokensRecovered` returns true for default “bundle1/bundle2/hijacked-transfer” types, and `analyzeTransaction` defaults to “bundle1, tokensRecovered: true” when it can’t classify the tx. This can produce false-positive “recovered” signals if used (it currently won’t trigger for bundles as their hashes aren’t monitored, but logically it’s incorrect).

- Bold: Generic mempool upgrade detector coverage mismatch
  - `UpgradeDetector` checks for proxy-level signatures like `upgradeTo/upgradeToAndCall` rather than `ProxyAdmin.upgrade(...)`. Real upgrades via Safe call `ProxyAdmin` and may not be detected by the generic filter (only Phase 3 targeted detection handles the Safe path). If Phase 3 isn’t reached, upgrades can be missed.

- Bold: “raw upgrade transaction” flow never originates from Safe monitors
  - Safe monitors never produce a raw tx hex for use in a bundle; they only emit hashes or decoded data. Without the raw signed tx, the designed “upgrade first in Bundle2” cannot function.

- Bold: MempoolMonitor provider assumptions
  - The code uses `provider.websocket.on('open'|'close'|'error', ...)`. In ethers v6, `WebSocketProvider` does not expose a public `.websocket` in the same way; this can break reconnection logic and thus Phase 3 monitoring reliability.

- Bold: Chain ID and builder endpoint coupling
  - `flashbotsProvider` is created unconditionally. If CHAIN_ID is Sepolia but `FLASHBOTS_RPC` is missing or still points to mainnet relay, signing/simulation/submission assumptions can be invalid. Since simulation uses the flashbots provider regardless of `USE_FLASHBOTS`, this misalignment becomes critical on testnets.

- Bold: UpgradeFilter “rawTransactionHex” is not hex
  - `UpgradeFilter` returns `rawTransactionHex` based on `UpgradeDetector.serializeTransaction(tx)` which is JSON text. Downstream code expects hex. This breaks any later attempt to treat it as a raw tx.

- Bold: Bundle2Creator uses upgrade nonce info but doesn’t apply it
  - `parseUpgradeTransaction` fetches nonce for the upgrade sender but doesn’t set it. Even if you could sign (you can’t), nonce handling would still be suspect.

- Bold: Orchestrator requires three-phase env even for simple Bundle1
  - `index.ts` throws if `PROXY_ADMIN_ADDRESS` or `SAFE_ADDRESS` is missing. This blocks running a Bundle1-only recovery scenario. Given `bundle1Submission.ts` exists separately, this is acceptable for the orchestrator, but functionally it prevents a minimal run through the main entrypoint.

- Bold: Targeted mempool detection string matching
  - `MempoolMonitor.isTargetUpgradeTransaction` uses substring matching of `upgradeCalldata` within `execTransaction` data. If calldata is encoded differently (e.g., ABI encoding differences/params ordering), detection could fail. This is brittle and can miss the actual transaction.

- Bold: EmergencyReplacement dominance math can undercount hacker gas
  - Dominance logic uses `hackerTx.gasLimit ?? 50,000`. If the hacker’s actual gas limit is higher, the computed required tip may be too low, risking non-replacement in edge cases. This is a substantive logic risk under adversarial settings.

---

### Issue Index with IDs

- [C-01] Event propagation mismatch (Safe events don’t reach orchestrator)
- [C-02] Inconsistent event payload: `rawTransactionHex` vs `rawTransactionHash`
- [C-03] Bundle2 upgrade transaction cannot be reproduced/signed by us
- [C-04] “Upgrade transaction” handled as JSON, not raw signed tx
- [C-05] Simulation always uses Flashbots even when Beaver/other builder is selected
- [C-06] Chain ID inconsistency in Bundle2 upgrade tx
- [C-07] Success detection gap for Beaver path (no inclusion feedback, hashes not monitored)
- [C-08] Misleading Safe post-execution “upgrade-detected → Bundle2” assumption
- [C-09] ERC20 recovery amount argument ignored; relies on stale global balance
- [C-10] SuccessMonitor can mark recovered without proof (false positives)
- [C-11] Generic mempool upgrade detector may miss ProxyAdmin upgrades
- [C-12] Safe monitors never emit raw signed upgrade tx for bundling
- [C-13] MempoolMonitor provider assumptions (WebSocket internals in ethers v6)
- [C-14] Chain ID and builder endpoint coupling/misalignment
- [C-15] UpgradeFilter `rawTransactionHex` is JSON, not hex
- [C-16] Bundle2Creator fetches upgrade nonce but doesn’t apply it
- [C-17] Orchestrator hard-requires three-phase env even for Bundle1
- [C-18] Targeted mempool detection string matching is brittle
- [C-19] EmergencyReplacement dominance math can undercount hacker gas

---

### Paired, priority-ordered work items

1) Safe/Bundle2 upgrade path correctness and event plumbing
   - Title: Make upgrade-first bundling viable and wire Safe events end-to-end
   - IDs: C-01, C-02, C-03, C-04, C-06, C-12, C-15, C-16, C-08
   - Rationale: These are interdependent issues blocking the core Bundle2 flow (plumbing, data format, ability to include the actual upgrade tx, and consistent chain fields). Fixing together ensures a coherent, testable upgrade-first bundle path.

2) Builder and simulation alignment across networks
   - Title: Align simulation with selected builder and network
   - IDs: C-05, C-14
   - Rationale: Simulation must reflect the chosen relay/builder and chain. These two are tightly linked and impact every run on Sepolia vs mainnet.

3) Inclusion feedback and outcome verification
   - Title: Accurate success detection for all builders
   - IDs: C-07, C-10
   - Rationale: Without inclusion feedback and proof-based success, the orchestrator cannot reliably stop or report outcomes, especially in Beaver mode.

4) Upgrade transaction detection robustness
   - Title: Reliably detect ProxyAdmin/Safe upgrade calls in mempool
   - IDs: C-11, C-18
   - Rationale: These both pertain to correctly recognizing upgrade activity in the mempool (coverage gaps and brittle matching). Address together to raise detection accuracy.

5) Emergency replacement gas dominance reliability
   - Title: Ensure dominance math covers adversarial gas limits
   - IDs: C-19
   - Rationale: Standalone fix to reduce risk of failed replacements when hacker uses higher gas limits.

6) ERC20 recovery amount correctness
   - Title: Use intended amount and avoid stale balance
   - IDs: C-09
   - Rationale: Localized logical correction; not strongly coupled to other items.

7) Mempool monitor reliability (WebSocket internals)
   - Title: Robust provider lifecycle handling in ethers v6
   - IDs: C-13
   - Rationale: Stability fix for reconnection and event stream; can be done independently.

8) Orchestrator minimal-mode constraint
   - Title: Allow Bundle1-only via main entrypoint (optional)
   - IDs: C-17
   - Rationale: Usability constraint; separate from core recovery logic.