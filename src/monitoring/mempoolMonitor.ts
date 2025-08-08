import { EventEmitter } from 'events';
import { WebSocketProvider } from 'ethers';
import { BaseTransactionFilter } from './filters/baseFilter';
import { AlertLogger } from './alertLogger';
import { FilterResult, UpgradeDetectedEvent, HackerActivityEvent, UpgradeFilterResult, ERC20FilterResult } from './types';
import { ExpectedTransaction } from './safe/safeApiTypes';

export class MempoolMonitor extends EventEmitter {
    private provider: WebSocketProvider;
    private filters: BaseTransactionFilter[] = [];
    private isRunning: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000;
    
    // Enhanced for targeted monitoring
    private targetTransaction: ExpectedTransaction | null = null;
    private aggressiveMode: boolean = false;

    constructor(websocketUrl: string) {
        super();
        this.provider = new WebSocketProvider(websocketUrl);
        this.setupEventHandlers();
    }

    addFilter(filter: BaseTransactionFilter): void {
        this.filters.push(filter);
        AlertLogger.logInfo(`Added filter: ${filter.getFilterName()}`);
    }

    removeFilter(filterName: string): void {
        this.filters = this.filters.filter(f => f.getFilterName() !== filterName);
        AlertLogger.logInfo(`Removed filter: ${filterName}`);
    }

    private setupEventHandlers(): void {
        // Avoid relying on internal websocket implementation; feature-detect if present
        const ws: any = (this.provider as any).websocket || (this.provider as any)._websocket;
        if (ws) {
            ws.on('open', () => {
                AlertLogger.logInfo('WebSocket connection established');
                this.reconnectAttempts = 0;
            });
            ws.on('close', () => {
                AlertLogger.logError('WebSocket connection closed');
                if (this.isRunning) {
                    this.handleReconnect();
                }
            });
            ws.on('error', (error: Error) => {
                AlertLogger.logError('WebSocket error', error);
            });
        }
    }

    private async handleReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            AlertLogger.logError('Max reconnection attempts reached. Stopping monitor.');
            this.stop();
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        AlertLogger.logInfo(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (this.isRunning) {
                this.start().catch(error => {
                    AlertLogger.logError('Reconnection failed', error);
                });
            }
        }, delay);
    }

    private onPendingTransaction = async (txHash: string): Promise<void> => {
        try {
            const tx = await this.provider.getTransaction(txHash);
            
            if (!tx) {
                return;
            }

            // Phase 3: Check for targeted upgrade transaction first (highest priority)
            if (this.targetTransaction && this.aggressiveMode) {
                if (this.isTargetUpgradeTransaction(tx)) {
                    AlertLogger.logInfo('🎯 TARGET UPGRADE TRANSACTION DETECTED IN MEMPOOL!');
                    await this.handleTargetTransactionDetected(tx);
                    return; // Priority handling, skip other filters
                }
            }

            // Regular filter processing (hacker activity, etc.)
            for (const filter of this.filters) {
                const result = filter.filterTransaction(tx);
                
                if (result) {
                    await this.emitFilterEvent(result, tx);
                }
            }
        } catch (error) {
            AlertLogger.logError(`Error processing transaction ${txHash}`, error as Error);
        }
    };

    private async emitFilterEvent(result: FilterResult, tx: any): Promise<void> {
        const blockNumber = await this.getCurrentBlockNumber();

        switch (result.type) {
            case 'upgrade':
                const upgradeResult = result as UpgradeFilterResult;
                // Emit a simplified event; upstream will fetch/build raw signed exec if needed
                const upgradeEvent: any = {
                    type: 'upgrade-detected',
                    source: 'mempool',
                    rawSignedTransactionHexString: '',
                    proxyAddress: upgradeResult.proxyAddress,
                    adminAddress: upgradeResult.adminAddress,
                    upgradeMethod: upgradeResult.method,
                    timestamp: new Date(),
                    blockNumber,
                    metadata: upgradeResult.rawTxMetadataJson
                };
                this.emit('upgrade-detected', upgradeEvent);
                break;

            case 'hacker-erc20':
                const erc20Result = result as ERC20FilterResult;
                const hackerEvent: HackerActivityEvent = {
                    type: 'hacker-erc20-activity',
                    transaction: erc20Result.suspiciousTransaction,
                    erc20Method: erc20Result.method,
                    urgencyLevel: erc20Result.urgencyLevel,
                    timestamp: new Date(),
                    blockNumber
                };
                this.emit('hacker-erc20-activity', hackerEvent);
                break;

            default:
                AlertLogger.logInfo(`Unknown filter result type: ${result.type}`);
        }
    }

    private async getCurrentBlockNumber(): Promise<number | undefined> {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            return undefined;
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            AlertLogger.logInfo('Monitor is already running');
            return;
        }

        try {
            this.isRunning = true;
            
            AlertLogger.logInfo('Starting mempool monitor...');
            AlertLogger.logInfo(`Active filters: ${this.filters.map(f => f.getFilterName()).join(', ')}`);
            
            await this.provider.on('pending', this.onPendingTransaction);
            
            AlertLogger.logInfo('✅ Mempool monitor started successfully');
            
        } catch (error) {
            this.isRunning = false;
            throw error;
        }
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        AlertLogger.logInfo('Stopping mempool monitor...');
        
        this.isRunning = false;
        this.provider.off('pending', this.onPendingTransaction);
        const ws: any = (this.provider as any).websocket || (this.provider as any)._websocket;
        if (ws && typeof ws.close === 'function') {
            ws.close();
        }
        
        AlertLogger.logInfo('✅ Mempool monitor stopped');
    }

    isMonitoring(): boolean {
        return this.isRunning;
    }

    // Enhanced methods for Phase 3 targeted monitoring
    setTargetTransaction(expectedTransaction: ExpectedTransaction): void {
        this.targetTransaction = expectedTransaction;
        AlertLogger.logInfo('🎯 Target transaction set for mempool monitoring');
        AlertLogger.logInfo(`Target Address: ${expectedTransaction.to}`);
        AlertLogger.logInfo(`Data Pattern Length: ${expectedTransaction.dataPattern.length} chars`);
    }

    clearTargetTransaction(): void {
        this.targetTransaction = null;
        AlertLogger.logInfo('🧹 Target transaction cleared');
    }

    enableAggressiveMode(): void {
        if (!this.aggressiveMode) {
            this.aggressiveMode = true;
            AlertLogger.logInfo('🔥 AGGRESSIVE MODE ENABLED - Enhanced mempool monitoring active');
        }
    }

    disableAggressiveMode(): void {
        if (this.aggressiveMode) {
            this.aggressiveMode = false;
            AlertLogger.logInfo('🔄 Aggressive mode disabled - Normal monitoring resumed');
        }
    }

    private isTargetUpgradeTransaction(tx: any): boolean {
        if (!this.targetTransaction) {
            return false;
        }

        // Check if transaction is sent to the expected multisig address
        if (tx.to?.toLowerCase() !== this.targetTransaction.to.toLowerCase()) {
            return false;
        }

        // Check if transaction data contains the upgrade pattern
        if (!tx.data || !this.targetTransaction.dataPattern) {
            return false;
        }

        // Match the upgrade calldata pattern within the Safe execTransaction call
        const txData = tx.data.toLowerCase();
        const patternData = this.targetTransaction.upgradeCalldata.toLowerCase();

        // The upgrade calldata should be contained within the Safe's execTransaction call
        return txData.includes(patternData);
    }

    private async handleTargetTransactionDetected(tx: any): Promise<void> {
        const blockNumber = await this.getCurrentBlockNumber();

        AlertLogger.logInfo('🚀 UPGRADE TRANSACTION DETECTED - PHASE 3 COMPLETE!');
        AlertLogger.logInfo(`Transaction Hash: ${tx.hash}`);
        AlertLogger.logInfo(`From: ${tx.from}`);
        AlertLogger.logInfo(`To: ${tx.to} (Safe Multisig)`);
        AlertLogger.logInfo(`Block: ${blockNumber || 'pending'}`);
        AlertLogger.logInfo('⚡ Triggering Bundle2 with actual upgrade transaction...');

        // Emit simplified event; upstream will build raw signed exec if needed
        const upgradeEvent: any = {
            type: 'upgrade-detected',
            source: 'mempool',
            rawSignedTransactionHexString: '',
            proxyAddress: this.targetTransaction?.to || '',
            adminAddress: tx.from,
            upgradeMethod: 'execTransaction',
            timestamp: new Date(),
            blockNumber
        };

        this.emit('upgrade-detected', upgradeEvent);

        // Clear target transaction after detection to avoid duplicates
        this.clearTargetTransaction();
    }

    private serializeTransaction(tx: any): string {
        try {
            return JSON.stringify({
                to: tx.to,
                from: tx.from,
                data: tx.data,
                value: tx.value?.toString() || '0',
                gasLimit: tx.gasLimit?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                maxFeePerGas: tx.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
                nonce: tx.nonce,
                type: tx.type || 2,
                chainId: tx.chainId || 1,
                hash: tx.hash
            });
        } catch (error) {
            AlertLogger.logError('Failed to serialize transaction', error as Error);
            return '';
        }
    }

    // Get current status including aggressive mode
    getEnhancedStatus(): {
        isRunning: boolean;
        filtersCount: number;
        aggressiveMode: boolean;
        hasTargetTransaction: boolean;
        targetTransactionTo?: string;
    } {
        return {
            isRunning: this.isRunning,
            filtersCount: this.filters.length,
            aggressiveMode: this.aggressiveMode,
            hasTargetTransaction: this.targetTransaction !== null,
            targetTransactionTo: this.targetTransaction?.to
        };
    }
}