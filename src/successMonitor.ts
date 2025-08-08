import { EventEmitter } from 'events';
import { AlertLogger } from './monitoring/alertLogger';
import { normalProvider, erc20Contract, funderAddress } from '../config';

export interface SuccessEvent {
    type: 'bundle1' | 'bundle2' | 'hijacked-transfer' | 'neutralization';
    transactionHash: string;
    blockNumber: number;
    tokensRecovered: boolean;
}

export class SuccessMonitor extends EventEmitter {
    private monitoredTransactions: Set<string> = new Set();
    private isMonitoring: boolean = false;
    private blockListener?: (blockNumber: number) => Promise<void>;

    constructor() {
        super();
    }

    start(): void {
        if (this.isMonitoring) {
            return;
        }

        AlertLogger.logInfo('🔍 Starting success monitor...');
        this.isMonitoring = true;

        this.blockListener = async (blockNumber: number) => {
            await this.checkForSuccessfulTransactions(blockNumber);
        };

        normalProvider.on('block', this.blockListener);
        AlertLogger.logInfo('✅ Success monitor started');
    }

    stop(): void {
        if (!this.isMonitoring) {
            return;
        }

        AlertLogger.logInfo('🛑 Stopping success monitor...');
        this.isMonitoring = false;

        if (this.blockListener) {
            normalProvider.off('block', this.blockListener);
            this.blockListener = undefined;
        }

        this.monitoredTransactions.clear();
        AlertLogger.logInfo('✅ Success monitor stopped');
    }

    // Add transactions to monitor for success
    addTransactionToMonitor(txHash: string, type: SuccessEvent['type']): void {
        if (this.monitoredTransactions.has(txHash)) {
            return;
        }

        this.monitoredTransactions.add(txHash);
        AlertLogger.logInfo(`📋 Added ${type} transaction to monitor: ${txHash}`);

        // Also try to check immediately in case it's already confirmed
        this.checkSpecificTransaction(txHash, type).catch(error => {
            AlertLogger.logError(`Failed to check transaction ${txHash}`, error);
        });
    }

    private async checkForSuccessfulTransactions(blockNumber: number): Promise<void> {
        if (this.monitoredTransactions.size === 0) {
            return;
        }

        for (const txHash of this.monitoredTransactions) {
            try {
                const receipt = await normalProvider.getTransactionReceipt(txHash);
                
                if (receipt && receipt.blockNumber) {
                    // Transaction confirmed
                    this.monitoredTransactions.delete(txHash);
                    await this.handleConfirmedTransaction(txHash, receipt);
                }
            } catch (error) {
                // Transaction might not exist yet, continue monitoring
            }
        }
    }

    private async checkSpecificTransaction(txHash: string, type: SuccessEvent['type']): Promise<void> {
        try {
            const receipt = await normalProvider.getTransactionReceipt(txHash);
            
            if (receipt && receipt.blockNumber) {
                this.monitoredTransactions.delete(txHash);
                await this.handleConfirmedTransaction(txHash, receipt, type);
            }
        } catch (error) {
            // Transaction not confirmed yet
        }
    }

    private async handleConfirmedTransaction(
        txHash: string, 
        receipt: any, 
        knownType?: SuccessEvent['type']
    ): Promise<void> {
        AlertLogger.logInfo(`✅ Transaction confirmed: ${txHash} in block ${receipt.blockNumber}`);

        // Determine transaction type and success status
        const { type, tokensRecovered } = knownType ? 
            { type: knownType, tokensRecovered: await this.checkTokensRecovered(knownType, txHash) } :
            await this.analyzeTransaction(txHash, receipt);

        const successEvent: SuccessEvent = {
            type,
            transactionHash: txHash,
            blockNumber: receipt.blockNumber,
            tokensRecovered
        };

        // Log success details
        if (tokensRecovered) {
            AlertLogger.logInfo(`🎉 SUCCESS! Tokens recovered via ${type.toUpperCase()}`);
            AlertLogger.logInfo(`Transaction: ${txHash}`);
            AlertLogger.logInfo(`Block: ${receipt.blockNumber}`);
            
            // Verify token recovery
            await this.verifyTokenRecovery();
        } else {
            AlertLogger.logInfo(`✅ Defensive action completed: ${type.toUpperCase()}`);
            AlertLogger.logInfo(`Transaction: ${txHash} (non-recovery action)`);
        }

        this.emit('transaction-success', successEvent);
    }

    private async analyzeTransaction(txHash: string, receipt: any): Promise<{
        type: SuccessEvent['type'];
        tokensRecovered: boolean;
    }> {
        try {
            const transaction = await normalProvider.getTransaction(txHash);
            
            if (!transaction) {
                return { type: 'bundle1', tokensRecovered: false };
            }

            // Analyze transaction data to determine type
            if (transaction.data && transaction.data.length > 10) {
                const methodSignature = transaction.data.slice(0, 10);
                
                // ERC20 transfer signature
                if (methodSignature === '0xa9059cbb') {
                    const recovered = await this.verifyFunderReceivedFromTransaction(transaction);
                    return { type: 'hijacked-transfer', tokensRecovered: recovered };
                }
            }

            // Default to bundle transaction if we can't determine specifically
            return { type: 'bundle1', tokensRecovered: await this.verifyFunderBalanceIncrease() };

        } catch (error) {
            AlertLogger.logError('Failed to analyze transaction', error as Error);
            return { type: 'bundle1', tokensRecovered: false };
        }
    }

    private async checkTokensRecovered(type: SuccessEvent['type'], txHash: string): Promise<boolean> {
        if (type === 'hijacked-transfer') {
            const tx = await normalProvider.getTransaction(txHash);
            return await this.verifyFunderReceivedFromTransaction(tx);
        }
        if (type === 'bundle1' || type === 'bundle2') {
            return await this.verifyFunderBalanceIncrease();
        }
        return false;
    }

    private async verifyTokenRecovery(): Promise<void> {
        try {
            AlertLogger.logInfo('🔍 Verifying token recovery...');
            
            const funderBalance = await (erc20Contract as any).balanceOf(funderAddress);
            AlertLogger.logInfo(`💰 Funder wallet balance: ${funderBalance.toString()} tokens`);
            
            if (funderBalance > 0n) {
                AlertLogger.logInfo('✅ Token recovery VERIFIED - tokens are in funder wallet!');
            } else {
                AlertLogger.logInfo('⚠️ Token recovery verification: No tokens found in funder wallet');
            }
        } catch (error) {
            AlertLogger.logError('Failed to verify token recovery', error as Error);
        }
    }

    private async verifyFunderBalanceIncrease(): Promise<boolean> {
        try {
            const bal = await (erc20Contract as any).balanceOf(funderAddress);
            return bal > 0n;
        } catch {
            return false;
        }
    }

    private async verifyFunderReceivedFromTransaction(tx: any): Promise<boolean> {
        try {
            // Decode transfer(to, amount) and verify recipient == funder
            if (!tx || !tx.data) return false;
            const sig = tx.data.slice(0, 10);
            if (sig !== '0xa9059cbb') return false;
            const to = '0x' + tx.data.slice(34, 74);
            return to.toLowerCase() === funderAddress.toLowerCase();
        } catch {
            return false;
        }
    }

    // Check if we have any active monitoring
    hasActiveMonitoring(): boolean {
        return this.monitoredTransactions.size > 0;
    }

    // Get number of transactions being monitored
    getMonitoringCount(): number {
        return this.monitoredTransactions.size;
    }

    // Clear all monitored transactions
    clearMonitoring(): void {
        const count = this.monitoredTransactions.size;
        this.monitoredTransactions.clear();
        AlertLogger.logInfo(`🧹 Cleared ${count} transactions from monitoring`);
    }
}