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
    tip
} from "./config";

import { ThreePhaseEventManager } from './src/monitoring/eventManager';
import { Bundle2Controller } from './src/bundle2Controller';
import { EmergencyReplacement } from './src/emergencyReplacement';
import { SuccessMonitor } from './src/successMonitor';
import { AlertLogger } from './src/monitoring/alertLogger';

import { createFundingTrx } from "./src/createFundingTrx";
import { createERC20RecoveryTrx } from "./src/createERC20RecoveryTrx";
import { createWithdrawTrx } from "./src/createWithdrawTrx";
import { signBundle } from "./src/signBundle";
import { simulateBundle } from "./src/simulateBundle";
import { sendBundleToFlashbotsAndMonitor } from "./src/sendBundleToFlashbotsAndMonitor";
import { sendBundleToBeaver } from "./src/sendBundleToBeaver";
import { normalProvider } from "./config";
import { formatEther, formatUnits } from "ethers";

class MasterOrchestrator {
    private eventManager: ThreePhaseEventManager;
    private bundle2Controller: Bundle2Controller;
    private successMonitor: SuccessMonitor;
    private recoverySucceeded: boolean = false;
    private isRunning: boolean = false;
    
    // Bundle1 tracking
    private bundle1Active: boolean = false;
    private bundle1BlockListener?: (blockNumber: number) => Promise<void>;

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
        
        try {
            const bundle1 = await this.createBundle1();
            const signedBundle = await signBundle(bundle1);
            
            // Simulate bundle first
            await simulateBundle(signedBundle);
            
            // Submit to Flashbots
            const result = await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
            if (result.success) {
                AlertLogger.logInfo(`🎉 Bundle1 included in block ${result.targetBlock}!`);
                // Bundle1 success means tokens were recovered - trigger success handling
                this.handleRecoverySuccess();
                return; // Exit early on success
            }

        } catch (error) {
            // Silently continue - Bundle1 failures are expected until tokens unlock
            if (blockNumber % 10 === 0) { // Log every 10 blocks to avoid spam
                AlertLogger.logInfo(`Bundle1 continuing (block ${blockNumber})...`);
            }
        }
    }

    private async createBundle1(): Promise<any[]> {
        const fundingTx = createFundingTrx();
        const recoveryTx = createERC20RecoveryTrx(balance);
        const withdrawTx = await createWithdrawTrx();
        
        return [fundingTx, recoveryTx, withdrawTx];
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