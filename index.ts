import { 
    simulate,
    useFlashBots,
    balance,
    compromisedAddress,
    funderAddress,
    erc20TokenAddress,
    proxyContractAddress,
    proxyAdminAddress,
    safeAddress,
    safeApiBaseUrl,
    ETH_AMOUNT_TO_FUND,
    websocketRpc,
    baseGasPrice,
    tip,
    upperBoundGasPrice,
    upperBoundMaxFeePerGas,
    upperBoundMaxPriorityFee
} from "./config";

import { ThreePhaseEventManager } from './src/monitoring/eventManager';
import { Bundle2Controller } from './src/bundle2Controller';
import { EmergencyReplacement } from './src/emergencyReplacement';
import { SuccessMonitor } from './src/successMonitor';
import { AlertLogger } from './src/monitoring/alertLogger';

import { createFundingTrx } from "./src/createFundingTrx";
import { createERC20RecoveryTrx } from "./src/createERC20RecoveryTrx";
import { createWithdrawTrx, WithdrawTrxResult } from "./src/createWithdrawTrx";
import { signBundle } from "./src/signBundle";
import { simulateBundle } from "./src/simulateBundle";
import { sendBundleToFlashbotsAndMonitor } from "./src/sendBundleToFlashbotsAndMonitor";
import { sendBundleToBeaver } from "./src/sendBundleToBeaver";
import { normalProvider, webhookUrl, consecutiveSkipThreshold } from "./config";
import { formatEther, formatUnits, FeeData } from "ethers";
import { updateGasConfig } from "./src/gasController";

class MasterOrchestrator {
    private eventManager: ThreePhaseEventManager;
    private bundle2Controller: Bundle2Controller;
    private successMonitor: SuccessMonitor;
    private recoverySucceeded: boolean = false;
    private isRunning: boolean = false;
    
    // Bundle1 tracking
    private bundle1Active: boolean = false;
    private bundle1Aggressive: boolean = false;
    private bundle1BlockListener?: (blockNumber: number) => Promise<void>;
    
    // Aggressive mode tracking
    private aggressiveModeStartBlock: number = 0;
    private lastProcessedBlock: number = 0;
    
    // Skip monitoring
    private consecutiveSkips: number = 0;
    private lastSubmissionAttemptBlock: number = 0;

    constructor() {
        // Ensure required addresses are provided for three-phase system
        if (!proxyAdminAddress) {
            throw new Error('PROXY_ADMIN_ADDRESS is required for three-phase system');
        }
        
        if (!safeAddress) {
            throw new Error('SAFE_ADDRESS is required for three-phase system');
        }
        
        this.eventManager = new ThreePhaseEventManager(
            websocketRpc,
            compromisedAddress,
            erc20TokenAddress,
            proxyContractAddress,
            proxyAdminAddress,
            safeAddress,
            safeApiBaseUrl
        );
        
        this.bundle2Controller = new Bundle2Controller();
        this.successMonitor = new SuccessMonitor();
        
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Upgrade detection → Bundle2 activation
        this.eventManager.on('upgrade-detected', (event) => {
            AlertLogger.logInfo('🔥 DEBUG: MasterOrchestrator received upgrade-detected event');
            if (this.recoverySucceeded) return;
            
            AlertLogger.logInfo('🚀 UPGRADE DETECTED - Activating Bundle2 strategy');
            AlertLogger.logInfo(`Upgrade method: ${event.upgradeMethod}`);
            AlertLogger.logInfo(`Proxy: ${event.proxyAddress}`);
            
            this.startBundle2Strategy(event.rawSignedTransactionHexString);
        });

        // Bundle2 stop signal
        this.eventManager.on('stop-bundle2', () => {
            AlertLogger.logInfo('🛑 Received stop-bundle2 signal');
            this.bundle2Controller.stop();
        });

        // Aggressive Bundle1 activation signal
        this.eventManager.on('activate-aggressive-bundle1', async () => {
            AlertLogger.logInfo('⚡ Activating aggressive Bundle1 mode');
            await this.startAggressiveBundle1();
        });

        // Hacker activity → Emergency replacement
        this.eventManager.on('hacker-erc20-activity', (event) => {
            if (this.recoverySucceeded) return;
            
            AlertLogger.logInfo('🚨 HACKER ACTIVITY DETECTED - Creating emergency replacement');
            AlertLogger.logInfo(`Method: ${event.erc20Method}`);
            AlertLogger.logInfo(`Urgency: ${event.urgencyLevel}`);
            
            this.handleHackerActivity(event);
        });

        // Success monitoring → Stop all strategies
        this.successMonitor.on('transaction-success', (event) => {
            if (event.tokensRecovered) {
                AlertLogger.logInfo('🎉 TOKEN RECOVERY SUCCESSFUL!');
                AlertLogger.logInfo(`Recovery method: ${event.type.toUpperCase()}`);
                AlertLogger.logInfo(`Transaction: ${event.transactionHash}`);
                AlertLogger.logInfo(`Block: ${event.blockNumber}`);
                
                this.handleRecoverySuccess();
            } else {
                AlertLogger.logInfo(`✅ Defensive action completed: ${event.type}`);
                // Continue other strategies for defensive actions
            }
        });

        // Bundle2 success monitoring
        this.bundle2Controller.on('bundle2-success', (event) => {
            if (this.recoverySucceeded) return;
            
            AlertLogger.logInfo('🎉 Bundle2 success detected - adding transactions to success monitoring');
            for (const txHash of event.transactionHashes) {
                this.successMonitor.addTransactionToMonitor(txHash, 'bundle2');
            }
        });

        // Bundle2 skip monitoring
        this.bundle2Controller.on('bundle2-attempt', (event) => {
            this.trackSubmissionAttempt(event.blockNumber, event.submitted, 'bundle2');
        });

        // Bundle2 submission tracking
        this.bundle2Controller.on('bundle2-submitted', (result) => {
            if (result.success) {
                AlertLogger.logInfo(`🎉 Bundle2 included in block ${result.targetBlock}!`);
                // Bundle2 success means tokens were recovered - trigger success handling
                this.handleRecoverySuccess();
            } else {
                AlertLogger.logInfo(`⚠️ Bundle2 not included: ${result.resolution}`);
                // Continue with other strategies
            }
        });
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            AlertLogger.logInfo('Master orchestrator already running');
            return;
        }

        console.log("🎯 Starting Three-Phase Fund Recovery Orchestrator");
        console.log("=" .repeat(70));
        console.log("");
        
        // Display configuration
        this.logConfiguration();
        
        try {
            this.isRunning = true;
            
            // Start success monitoring first
            this.successMonitor.start();
            
            if (simulate) {
                await this.runSimulation();
            } else {
                // Start all strategies
                await this.startAllStrategies();
            }
            
        } catch (error) {
            AlertLogger.logError('Failed to start master orchestrator', error as Error);
            await this.stop();
            throw error;
        }
    }

    private logConfiguration(): void {
        console.log("📋 Three-Phase System Configuration:");
        console.log(`   Mode: ${simulate ? "🧪 SIMULATION" : "⚡ PRODUCTION"}`);
        console.log(`   Builder: 🔥 Flashbots`);
        console.log(`   Funder Address: ${funderAddress}`);
        console.log(`   Compromised Address: ${compromisedAddress}`);
        console.log(`   ERC20 Token: ${erc20TokenAddress}`);
        console.log(`   Proxy Contract: ${proxyContractAddress}`);
        console.log(`   ProxyAdmin: ${proxyAdminAddress}`);
        console.log(`   Safe Multisig: ${safeAddress}`);
        console.log(`   Safe API: ${safeApiBaseUrl}`);
        console.log(`   ETH to Fund: ${ETH_AMOUNT_TO_FUND} ETH`);
        console.log(`   Base Gas Price: ${formatUnits(baseGasPrice, "gwei")} gwei`);
        console.log(`   Priority Fee: ${formatUnits(tip, "gwei")} gwei`);
        console.log(`   ERC20 Balance: ${balance.toString()} tokens`);
        console.log("");
        console.log("🔍 THREE-PHASE STRATEGY:");
        console.log("   Phase 1: Safe API monitoring for upgrade proposals");
        console.log("   Phase 2: Confirmation tracking with 2x aggressive gas");
        console.log("   Phase 3: Targeted mempool interception");
        console.log("");
    }

    private async runSimulation(): Promise<void> {
        AlertLogger.logInfo('🧪 Running unified simulation...');
        
        // Simulate Bundle1
        AlertLogger.logInfo('1️⃣ Simulating Bundle1...');
        const bundle1 = await this.createBundle1();
        const signedBundle1 = await signBundle(bundle1);
        await simulateBundle(signedBundle1);
        
        AlertLogger.logInfo('✅ All simulations completed');
        this.isRunning = false;
    }

    private async startAllStrategies(): Promise<void> {
        AlertLogger.logInfo('🎯 Starting all recovery strategies...');
        
        // Start Bundle1 (continuous baseline)
        await this.startBundle1Strategy();
        
        // Start monitoring system
        await this.eventManager.start();
        
        AlertLogger.logInfo('✅ Three-phase system active and monitoring');
        AlertLogger.logInfo('');
        AlertLogger.logInfo('🔄 ACTIVE STRATEGIES:');
        AlertLogger.logInfo('   • Bundle1: Continuous submission every block');
        AlertLogger.logInfo('   • Phase 1: Safe API proposal monitoring');
        AlertLogger.logInfo('   • Phase 2: Ready for confirmation tracking');
        AlertLogger.logInfo('   • Phase 3: Ready for aggressive mempool interception');
        AlertLogger.logInfo('   • Bundle2: Ready to activate on upgrade detection');
        AlertLogger.logInfo('   • Emergency: Ready for transaction replacement');
        AlertLogger.logInfo('');
        AlertLogger.logInfo('⚡ Press Ctrl+C to stop all strategies');
    }

    private async startBundle1Strategy(): Promise<void> {
        if (this.bundle1Active) return;
        
        AlertLogger.logInfo('🔄 Starting Bundle1 continuous submission...');
        this.bundle1Active = true;

        this.bundle1BlockListener = async (blockNumber: number) => {
            if (!this.bundle1Active || this.recoverySucceeded) return;

            const feeData = await normalProvider.getFeeData();

            updateGasConfig(feeData)
            
            try {
                await this.submitBundle1(blockNumber);
            } catch (error) {
                AlertLogger.logError(`Bundle1 submission failed for block ${blockNumber}`, error as Error);
            }
        };

        normalProvider.on('block', this.bundle1BlockListener);
        AlertLogger.logInfo('✅ Bundle1 strategy started');
    }

    private async submitBundle1(blockNumber: number): Promise<void> {
        const targetBlockNumber = blockNumber + 1;
        let bundleSubmitted = false;
        
        try {
            const bundle1 = await this.createBundle1();
            const signedBundle = await signBundle(bundle1);
            
            // Simulate bundle first
            await simulateBundle(signedBundle);
            
            // Submit to Flashbots
            const result = await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
            bundleSubmitted = true; // Successfully submitted (regardless of inclusion)
            
            if (result.success) {
                AlertLogger.logInfo(`🎉 Bundle1 included in block ${result.targetBlock}!`);
                
                // Add successful bundle transactions to success monitoring
                if (result.includedTransactions) {
                    for (const txHash of result.includedTransactions) {
                        this.successMonitor.addTransactionToMonitor(txHash, 'bundle1');
                    }
                }
                
                // Bundle1 success means tokens were recovered - trigger success handling
                this.handleRecoverySuccess();
                return; // Exit early on success
            }

        } catch (error) {
            // Bundle submission failed
            bundleSubmitted = false;
            
            // Silently continue - Bundle1 failures are expected until tokens unlock
            if (blockNumber % 10 === 0) { // Log every 10 blocks to avoid spam
                AlertLogger.logInfo(`Bundle1 continuing (block ${blockNumber})...`);
            }
        } finally {
            // Track skip monitoring
            this.trackSubmissionAttempt(blockNumber, bundleSubmitted, 'bundle1');
        }
    }

    private async createBundle1(): Promise<any[]> {
        if (this.bundle1Aggressive) {
            return await this.createAggressiveBundle1();
        }
        
        const fundingTx = createFundingTrx();
        const recoveryTx = createERC20RecoveryTrx(balance);
        const withdrawResult = await createWithdrawTrx();
        
        const bundle = [fundingTx, recoveryTx];
        if (withdrawResult.shouldInclude) {
            bundle.push(withdrawResult.transaction!);
            AlertLogger.logInfo(`✅ Bundle1 created with 3 transactions (including withdrawal)`);
        } else {
            AlertLogger.logInfo(`⚠️ Bundle1 created with 2 transactions (withdrawal excluded: ${withdrawResult.reason})`);
        }
        
        return bundle;
    }

    private async createAggressiveBundle1(): Promise<any[]> {
        // Get current block to calculate dynamic multiplier
        const currentBlock = await normalProvider.getBlockNumber();
        const multiplier = this.calculateDynamicMultiplier(currentBlock);
        
        // Log escalation info only when multiplier changes
        const blocksSinceStart = currentBlock - this.aggressiveModeStartBlock;
        if (currentBlock !== this.lastProcessedBlock && blocksSinceStart % 2 === 0 && blocksSinceStart > 0) {
            AlertLogger.logInfo(`🚀 Gas escalation: Block ${currentBlock} (+${blocksSinceStart}) → ${multiplier}x multiplier`);
        }
        this.lastProcessedBlock = currentBlock;
        
        AlertLogger.logInfo(`⚡ Creating AGGRESSIVE Bundle1 with ${multiplier}x gas multiplier (block ${currentBlock})`);
        
        // Use aggressive gas pricing by temporarily updating gas config
        const originalFeeData = await normalProvider.getFeeData();
        
        // Calculate boosted values with upper bound protection
        let aggressiveMaxFee: bigint | null = null;
        let aggressivePriorityFee: bigint | null = null;
        let aggressiveGasPrice: bigint | null = null;
        
        if (originalFeeData.maxFeePerGas) {
            const boostedMaxFee = originalFeeData.maxFeePerGas * BigInt(multiplier);
            aggressiveMaxFee = this.applyUpperBounds(boostedMaxFee, upperBoundMaxFeePerGas);
        }
        
        if (originalFeeData.maxPriorityFeePerGas) {
            const boostedPriorityFee = originalFeeData.maxPriorityFeePerGas * BigInt(multiplier);
            aggressivePriorityFee = this.applyUpperBounds(boostedPriorityFee, upperBoundMaxPriorityFee);
        }
        
        if (originalFeeData.gasPrice) {
            const boostedGasPrice = originalFeeData.gasPrice * BigInt(multiplier);
            aggressiveGasPrice = this.applyUpperBounds(boostedGasPrice, upperBoundGasPrice);
        }
        
        // Log if upper bounds were applied
        if (originalFeeData.maxFeePerGas && aggressiveMaxFee === upperBoundMaxFeePerGas) {
            AlertLogger.logInfo(`🔒 Max fee capped at upper bound: ${formatUnits(upperBoundMaxFeePerGas, "gwei")} gwei`);
        }
        if (originalFeeData.maxPriorityFeePerGas && aggressivePriorityFee === upperBoundMaxPriorityFee) {
            AlertLogger.logInfo(`🔒 Priority fee capped at upper bound: ${formatUnits(upperBoundMaxPriorityFee, "gwei")} gwei`);
        }
        if (originalFeeData.gasPrice && aggressiveGasPrice === upperBoundGasPrice) {
            AlertLogger.logInfo(`🔒 Gas price capped at upper bound: ${formatUnits(upperBoundGasPrice, "gwei")} gwei`);
        }
        
        // Create a boosted fee data for aggressive mode
        const aggressiveFeeData = {
            maxFeePerGas: aggressiveMaxFee,
            maxPriorityFeePerGas: aggressivePriorityFee,
            gasPrice: aggressiveGasPrice,
            toJSON: originalFeeData.toJSON // Required by FeeData interface
        };
        
        // Temporarily update gas config for aggressive pricing
        updateGasConfig(aggressiveFeeData);
        
        try {
            const fundingTx = createFundingTrx();
            const recoveryTx = createERC20RecoveryTrx(balance);
            const withdrawResult = await createWithdrawTrx();
            
            const bundle = [fundingTx, recoveryTx];
            if (withdrawResult.shouldInclude) {
                bundle.push(withdrawResult.transaction!);
                AlertLogger.logInfo(`⚡ Aggressive Bundle1 created with 3 transactions (including withdrawal)`);
            } else {
                AlertLogger.logInfo(`⚠️ Aggressive Bundle1 created with 2 transactions (withdrawal excluded: ${withdrawResult.reason})`);
            }
            
            return bundle;
        } finally {
            // Restore original gas config
            updateGasConfig(originalFeeData);
        }
    }

    private calculateDynamicMultiplier(currentBlock: number): number {
        if (!this.bundle1Aggressive || this.aggressiveModeStartBlock === 0) {
            return 1; // Normal mode
        }
        
        const blocksSinceStart = currentBlock - this.aggressiveModeStartBlock;
        
        // Start with 3x multiplier, increase by 1x every 2 blocks
        // Block 0-1: 3x, Block 2-3: 4x, Block 4-5: 5x, etc.
        const additionalMultiplier = Math.floor(blocksSinceStart / 2);
        const dynamicMultiplier = 3 + additionalMultiplier;
        
        return dynamicMultiplier;
    }

    private applyUpperBounds(gas: bigint, upperBound: bigint): bigint {
        return gas > upperBound ? upperBound : gas;
    }

    private trackSubmissionAttempt(blockNumber: number, bundleSubmitted: boolean, bundleType: string): void {
        if (bundleSubmitted) {
            // Reset consecutive skip counter on successful submission
            if (this.consecutiveSkips > 0) {
                AlertLogger.logDebug(`✅ Bundle submission successful - resetting skip counter (was ${this.consecutiveSkips})`);
                this.consecutiveSkips = 0;
            }
            this.lastSubmissionAttemptBlock = blockNumber;
        } else {
            // Increment skip counter
            this.consecutiveSkips++;
            
            AlertLogger.logDebug(`⚠️ Bundle skip detected - consecutive skips: ${this.consecutiveSkips}/${consecutiveSkipThreshold}`);
            
            // Check if we've hit the threshold
            if (this.consecutiveSkips >= consecutiveSkipThreshold) {
                const message = `🚨 ALERT: ${this.consecutiveSkips} consecutive bundles skipped!`;
                const data = {
                    consecutiveSkips: this.consecutiveSkips,
                    lastSubmissionBlock: this.lastSubmissionAttemptBlock,
                    currentBlock: blockNumber,
                    bundleType: bundleType,
                    threshold: consecutiveSkipThreshold
                };
                
                AlertLogger.logError(message);
                AlertLogger.logError(`Last successful submission: block ${this.lastSubmissionAttemptBlock}`);
                AlertLogger.logError(`Current block: ${blockNumber}`);
                
                // Send webhook alert
                this.sendWebhookAlert(message, data);
            }
        }
    }

    private async sendWebhookAlert(message: string, data?: any): Promise<void> {
        if (!webhookUrl) {
            AlertLogger.logDebug('Webhook URL not configured - skipping alert');
            return;
        }

        try {
            const payload = {
                alert: message,
                timestamp: new Date().toISOString(),
                system: 'flashbots-recovery',
                data: data || {}
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                AlertLogger.logInfo(`📡 Webhook alert sent: ${message}`);
            } else {
                AlertLogger.logError(`Webhook failed with status ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            AlertLogger.logError('Failed to send webhook alert', error as Error);
        }
    }

    private async startAggressiveBundle1(): Promise<void> {
        if (this.bundle1Aggressive) {
            AlertLogger.logDebug('Aggressive Bundle1 already active - ignoring duplicate activation');
            return;
        }
        
        AlertLogger.logInfo('🔥 SWITCHING TO AGGRESSIVE BUNDLE1 MODE');
        AlertLogger.logInfo('   Starting with 3x gas multiplier, escalating +1x every 2 blocks');
        
        // Track the starting block for escalation calculations
        const currentBlock = await normalProvider.getBlockNumber();
        this.aggressiveModeStartBlock = currentBlock;
        this.lastProcessedBlock = currentBlock;
        this.bundle1Aggressive = true;
        
        AlertLogger.logInfo(`   Aggressive mode started at block ${currentBlock}`);
        AlertLogger.logInfo(`   Upper bounds: Max Fee ${formatUnits(upperBoundMaxFeePerGas, "gwei")} gwei, Priority ${formatUnits(upperBoundMaxPriorityFee, "gwei")} gwei, Gas Price ${formatUnits(upperBoundGasPrice, "gwei")} gwei`);
    }

    private async startBundle2Strategy(upgradeRawSignedHex: string): Promise<void> {
        if (this.recoverySucceeded) return;
        
        AlertLogger.logInfo('🚀 Activating Bundle2 strategy with upgrade transaction...');
        
        try {
            await this.bundle2Controller.startBundle2Submission(upgradeRawSignedHex);
            AlertLogger.logInfo('✅ Bundle2 strategy activated');
        } catch (error) {
            AlertLogger.logError('Failed to start Bundle2 strategy', error as Error);
        }
    }

    private async handleHackerActivity(event: any): Promise<void> {
        if (this.recoverySucceeded) return;
        
        try {
            AlertLogger.logInfo('⚡ Creating emergency replacement transaction...');
            
            const { transaction: replacementTx, isRecoveryAction } = 
                await EmergencyReplacement.createReplacementTransaction(event.transaction);
            
            const txHash = await EmergencyReplacement.submitReplacementTransaction(replacementTx);
            
            // Monitor for success - Emergency replacements still use transaction monitoring
            const txType = isRecoveryAction ? 'hijacked-transfer' : 'neutralization';
            this.successMonitor.addTransactionToMonitor(txHash, txType);
            
            AlertLogger.logInfo(`✅ Emergency replacement submitted: ${isRecoveryAction ? 'RECOVERY' : 'DEFENSIVE'} action`);
            
            if (isRecoveryAction) {
                AlertLogger.logInfo('🎯 Recovery transaction submitted - monitoring for inclusion...');
            }
            
        } catch (error) {
            AlertLogger.logError('Emergency replacement failed', error as Error);
        }
    }

    private handleRecoverySuccess(): void {
        AlertLogger.logInfo('🛑 TOKEN RECOVERY SUCCESSFUL - Stopping all strategies...');
        
        this.recoverySucceeded = true;
        this.stop().then(() => {
            AlertLogger.logInfo('');
            AlertLogger.logInfo('🎉 RECOVERY COMPLETE! 🎉');
            AlertLogger.logInfo('All strategies stopped. Tokens have been recovered!');
            AlertLogger.logInfo('');
            process.exit(0);
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        AlertLogger.logInfo('🛑 Stopping three-phase orchestrator...');
        
        this.isRunning = false;
        
        // Stop Bundle1
        if (this.bundle1Active && this.bundle1BlockListener) {
            normalProvider.off('block', this.bundle1BlockListener);
            this.bundle1Active = false;
        }
        
        // Stop Bundle2
        this.bundle2Controller.stop();
        
        // Stop monitoring
        this.eventManager.stop();
        this.successMonitor.stop();
        
        AlertLogger.logInfo('✅ Three-phase orchestrator stopped');
    }

    // Graceful shutdown handling
    setupGracefulShutdown(): void {
        const handleShutdown = () => {
            console.log('\n');
            AlertLogger.logInfo('👋 Graceful shutdown initiated...');
            this.stop().then(() => {
                AlertLogger.logInfo('✅ Shutdown complete');
                process.exit(0);
            }).catch(error => {
                AlertLogger.logError('Error during shutdown', error);
                process.exit(1);
            });
        };

        process.on('SIGINT', handleShutdown);
        process.on('SIGTERM', handleShutdown);
    }
}

// Main execution
async function main(): Promise<void> {
    const orchestrator = new MasterOrchestrator();
    
    // Setup graceful shutdown
    orchestrator.setupGracefulShutdown();
    
    try {
        await orchestrator.start();
    } catch (error) {
        AlertLogger.logError('Three-phase orchestrator failed to start', error as Error);
        process.exit(1);
    }
}

// Start the three-phase orchestrator
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});