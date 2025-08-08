import { EventEmitter } from 'events';
import { TransactionEntry } from './types';
import { Bundle2Creator } from './bundles/bundle2Creator';
import { signBundle } from './signBundle';
import { simulateBundle } from './simulateBundle';
import { sendBundleToFlashbotsAndMonitor } from './sendBundleToFlashbotsAndMonitor';
import { sendBundleToBeaver } from './sendBundleToBeaver';
import { AlertLogger } from './monitoring/alertLogger';
import { 
    normalProvider,
    useFlashBots,
    simulate
} from '../config';

export class Bundle2Controller extends EventEmitter {
    private isRunning: boolean = false;
    private blockListener?: (blockNumber: number) => Promise<void>;

    constructor() {
        super();
    }

    async startBundle2Submission(upgradeTransactionHex: string): Promise<void> {
        if (this.isRunning) {
            AlertLogger.logInfo('Bundle2 controller already running');
            return;
        }

        AlertLogger.logInfo('🚀 Starting Bundle2 submission controller...');
        this.isRunning = true;

        try {
            if (simulate) {
                await this.simulateBundle2(upgradeTransactionHex);
            } else {
                await this.startContinuousBundle2Submission(upgradeTransactionHex);
            }
        } catch (error) {
            AlertLogger.logError('Failed to start Bundle2 submission', error as Error);
            this.isRunning = false;
            throw error;
        }
    }

    private async simulateBundle2(upgradeTransactionHex: string): Promise<void> {
        AlertLogger.logInfo('🧪 Running Bundle2 simulation...');
        
        try {
            const bundle2 = await Bundle2Creator.createBundle2WithUpgrade(upgradeTransactionHex);
            const signedBundle = await signBundle(bundle2);
            await simulateBundle(signedBundle);
            
            AlertLogger.logInfo('✅ Bundle2 simulation completed');
            this.isRunning = false;
        } catch (error) {
            AlertLogger.logError('Bundle2 simulation failed', error as Error);
            this.isRunning = false;
            throw error;
        }
    }

    private async startContinuousBundle2Submission(upgradeTransactionHex: string): Promise<void> {
        AlertLogger.logInfo('🔄 Starting continuous Bundle2 submission...');

        this.blockListener = async (blockNumber: number) => {
            if (!this.isRunning) return;

            try {
                await this.submitBundle2(upgradeTransactionHex, blockNumber);
            } catch (error) {
                AlertLogger.logError(`Bundle2 submission failed for block ${blockNumber}`, error as Error);
            }
        };

        normalProvider.on('block', this.blockListener);
        AlertLogger.logInfo('✅ Bundle2 controller started - submitting every block');
    }

    private async submitBundle2(upgradeTransactionHex: string, blockNumber: number): Promise<void> {
        const targetBlockNumber = blockNumber + 1;
        
        AlertLogger.logInfo(`📦 Creating Bundle2 for block ${targetBlockNumber}...`);

        try {
            // Create Bundle2 with upgrade transaction
            const bundle2 = await Bundle2Creator.createBundle2WithUpgrade(upgradeTransactionHex);
            
            // Sign bundle
            const signedBundle = await signBundle(bundle2);
            
            // Simulate first
            AlertLogger.logInfo('🧪 Simulating Bundle2...');
            await simulateBundle(signedBundle);
            
            // Submit to builder
            if (useFlashBots) {
                AlertLogger.logInfo(`🔥 Submitting Bundle2 to Flashbots for block ${targetBlockNumber}`);
                const result = await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
                
                // Emit the actual bundle result with success status
                this.emit('bundle2-submitted', result);
                
                if (result.success) {
                    AlertLogger.logInfo('🎉 Bundle2 included! Stopping controller...');
                    this.stop(); // Stop submitting more Bundle2s on success
                }
            } else {
                AlertLogger.logInfo(`🦫 Submitting Bundle2 to Beaver Build for block ${targetBlockNumber}`);
                await sendBundleToBeaver(signedBundle, BigInt(targetBlockNumber));
                // For Beaver, we don't get immediate feedback, so emit minimal info
                this.emit('bundle2-submitted', { 
                    bundleHash: 'beaver-submission',
                    resolution: 'unknown',
                    success: false, // We don't know yet
                    targetBlock: targetBlockNumber
                });
            }

        } catch (error) {
            AlertLogger.logError(`Bundle2 creation/submission failed for block ${targetBlockNumber}`, error as Error);
        }
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        AlertLogger.logInfo('🛑 Stopping Bundle2 controller...');
        
        this.isRunning = false;
        
        if (this.blockListener) {
            normalProvider.off('block', this.blockListener);
            this.blockListener = undefined;
        }
        
        AlertLogger.logInfo('✅ Bundle2 controller stopped');
    }

    isActive(): boolean {
        return this.isRunning;
    }

    // Create alternative Bundle2 without upgrade transaction (for when tokens are already unlocked)
    async startAlternativeBundle2Submission(): Promise<void> {
        if (this.isRunning) {
            AlertLogger.logInfo('Bundle2 controller already running');
            return;
        }

        AlertLogger.logInfo('🔄 Starting alternative Bundle2 submission (no upgrade transaction)...');
        this.isRunning = true;

        this.blockListener = async (blockNumber: number) => {
            if (!this.isRunning) return;

            try {
                await this.submitAlternativeBundle2(blockNumber);
            } catch (error) {
                AlertLogger.logError(`Alternative Bundle2 submission failed for block ${blockNumber}`, error as Error);
            }
        };

        normalProvider.on('block', this.blockListener);
        AlertLogger.logInfo('✅ Alternative Bundle2 controller started');
    }

    private async submitAlternativeBundle2(blockNumber: number): Promise<void> {
        const targetBlockNumber = blockNumber + 1;
        
        try {
            const bundle2 = await Bundle2Creator.createAlternativeBundle2();
            const signedBundle = await signBundle(bundle2);
            
            await simulateBundle(signedBundle);
            
            if (useFlashBots) {
                const result = await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
                this.emit('bundle2-submitted', result);
                
                if (result.success) {
                    AlertLogger.logInfo('🎉 Alternative Bundle2 included! Stopping controller...');
                    this.stop();
                }
            } else {
                await sendBundleToBeaver(signedBundle, BigInt(targetBlockNumber));
                this.emit('bundle2-submitted', {
                    bundleHash: 'beaver-submission',
                    resolution: 'unknown',
                    success: false,
                    targetBlock: targetBlockNumber
                });
            }

        } catch (error) {
            AlertLogger.logError(`Alternative Bundle2 failed for block ${targetBlockNumber}`, error as Error);
        }
    }
}