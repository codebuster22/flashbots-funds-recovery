import { EventEmitter } from 'events';
import axios from 'axios';
import { AlertLogger } from '../alertLogger';
import { 
    SafeApiResponse, 
    SafeTransaction, 
    ProposalDetectedEvent,
    SafeDataDecoded 
} from './safeApiTypes';

export class SafeProposalMonitor extends EventEmitter {
    private safeAddress: string;
    private proxyAdminAddress: string;
    private apiBaseUrl: string;
    private pollingInterval: number;
    private isRunning: boolean = false;
    private pollingTimer?: NodeJS.Timeout;
    private seenProposals: Set<string> = new Set(); // Track safeTxHash

    // Method signatures for ProxyAdmin upgrade functions
    private static readonly UPGRADE_METHOD_SIGNATURES = new Set([
        '0x99a88ec4', // upgrade(ITransparentUpgradeableProxy,address)
        '0x9623609d', // upgradeAndCall(ITransparentUpgradeableProxy,address,bytes)
    ]);

    constructor(
        safeAddress: string,
        proxyAdminAddress: string,
        apiBaseUrl: string = 'https://safe-transaction-mainnet.safe.global',
        pollingInterval: number = 10000
    ) {
        super();
        this.safeAddress = safeAddress.toLowerCase();
        this.proxyAdminAddress = proxyAdminAddress.toLowerCase();
        this.apiBaseUrl = apiBaseUrl;
        this.pollingInterval = pollingInterval;
    }

    start(): void {
        if (this.isRunning) {
            AlertLogger.logInfo('SafeProposalMonitor already running');
            return;
        }

        AlertLogger.logInfo('🔍 Starting Safe Proposal Monitor (Phase 1)...');
        AlertLogger.logInfo(`Safe Address: ${this.safeAddress}`);
        AlertLogger.logInfo(`ProxyAdmin: ${this.proxyAdminAddress}`);
        AlertLogger.logInfo(`Polling Interval: ${this.pollingInterval}ms`);

        this.isRunning = true;
        this.startPolling();

        AlertLogger.logInfo('✅ Safe Proposal Monitor started');
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        AlertLogger.logInfo('🛑 Stopping Safe Proposal Monitor...');
        
        this.isRunning = false;
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = undefined;
        }
        this.seenProposals.clear();

        AlertLogger.logInfo('✅ Safe Proposal Monitor stopped');
    }

    private startPolling(): void {
        if (!this.isRunning) return;

        this.pollingTimer = setTimeout(async () => {
            try {
                await this.checkForNewProposals();
            } catch (error) {
                AlertLogger.logError('Error checking for proposals', error as Error);
            }
            
            // Schedule next poll
            if (this.isRunning) {
                this.startPolling();
            }
        }, this.pollingInterval);
    }

    private async checkForNewProposals(): Promise<void> {
        try {
            // Fetch recent transactions (both executed and pending)
            const apiUrl = `${this.apiBaseUrl}/api/v2/safes/${this.safeAddress}/multisig-transactions/`;
            const params = {
                limit: 20, // Check recent 20 transactions
                ordering: '-nonce' // Most recent first
            };

            const response = await axios.get<SafeApiResponse>(apiUrl, { params });
            
            if (!response.data.results) {
                return;
            }

            // Filter for upgrade proposals targeting our ProxyAdmin
            const upgradeTransactions = response.data.results.filter(tx => 
                this.isUpgradeTransaction(tx) && !this.seenProposals.has(tx.safeTxHash)
            );

            // Process new upgrade transactions
            for (const transaction of upgradeTransactions) {
                this.seenProposals.add(transaction.safeTxHash);
                await this.handleUpgradeProposal(transaction);
            }

        } catch (error) {
            AlertLogger.logError('Failed to fetch Safe API data', error as Error);
        }
    }

    private isUpgradeTransaction(transaction: SafeTransaction): boolean {
        // Check if transaction targets our ProxyAdmin
        if (transaction.to.toLowerCase() !== this.proxyAdminAddress) {
            return false;
        }

        // Check method signature or decoded method name
        if (transaction.dataDecoded) {
            return this.isUpgradeMethod(transaction.dataDecoded);
        }

        // Fallback to method signature check
        if (transaction.data && transaction.data.length >= 10) {
            const methodSig = transaction.data.slice(0, 10);
            return SafeProposalMonitor.UPGRADE_METHOD_SIGNATURES.has(methodSig);
        }

        return false;
    }

    private isUpgradeMethod(dataDecoded: SafeDataDecoded): boolean {
        return ['upgrade', 'upgradeAndCall'].includes(dataDecoded.method);
    }

    private async handleUpgradeProposal(transaction: SafeTransaction): Promise<void> {
        const confirmationCount = transaction.confirmations.length;
        const required = transaction.confirmationsRequired;

        AlertLogger.logInfo('🚨 UPGRADE PROPOSAL DETECTED!');
        AlertLogger.logInfo(`Safe Tx Hash: ${transaction.safeTxHash}`);
        AlertLogger.logInfo(`Method: ${transaction.dataDecoded?.method || 'upgrade'}`);
        AlertLogger.logInfo(`Executed: ${transaction.isExecuted}`);
        AlertLogger.logInfo(`Confirmations: ${confirmationCount}/${required}`);
        AlertLogger.logInfo(`Submitted: ${transaction.submissionDate}`);

        if (transaction.isExecuted) {
            AlertLogger.logInfo('⚡ Transaction already executed - triggering immediate Bundle2');
            // If already executed, we can trigger Bundle2 immediately
            this.handleExecutedUpgrade(transaction);
        } else {
            AlertLogger.logInfo('⏳ Transaction pending - starting confirmation tracking');
            
            // Emit proposal detected event
            const event: ProposalDetectedEvent = {
                type: 'proposal-detected',
                proposal: transaction,
                safeTxHash: transaction.safeTxHash,
                proxyAdmin: this.proxyAdminAddress,
                upgradeMethod: transaction.dataDecoded?.method || 'upgrade',
                confirmations: confirmationCount,
                required,
                timestamp: new Date()
            };

            this.emit('proposal-detected', event);
        }
    }

    private handleExecutedUpgrade(transaction: SafeTransaction): void {
        if (!transaction.transactionHash) {
            AlertLogger.logError('Executed transaction missing transactionHash');
            return;
        }

        AlertLogger.logInfo('🎯 Found already executed upgrade transaction');
        AlertLogger.logInfo(`Transaction Hash: ${transaction.transactionHash}`);
        AlertLogger.logInfo(`Block Number: ${transaction.blockNumber}`);

        // Emit upgrade-detected event for immediate Bundle2
        this.emit('upgrade-detected', {
            type: 'upgrade-detected',
            transaction: transaction,
            rawTransactionHash: transaction.transactionHash,
            proxyAddress: this.proxyAdminAddress,
            adminAddress: transaction.executor,
            upgradeMethod: transaction.dataDecoded?.method || 'upgrade',
            timestamp: new Date(),
            blockNumber: transaction.blockNumber
        });
    }

    // Get current status
    getStatus(): {
        isRunning: boolean;
        seenProposalsCount: number;
        safeAddress: string;
        proxyAdminAddress: string;
    } {
        return {
            isRunning: this.isRunning,
            seenProposalsCount: this.seenProposals.size,
            safeAddress: this.safeAddress,
            proxyAdminAddress: this.proxyAdminAddress
        };
    }

    // Manual proposal check (for testing)
    async checkNow(): Promise<void> {
        AlertLogger.logInfo('🔍 Manual proposal check triggered');
        await this.checkForNewProposals();
    }
}