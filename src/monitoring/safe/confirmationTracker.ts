import { EventEmitter } from 'events';
import axios from 'axios';
import { AlertLogger } from '../alertLogger';
import { 
    SafeTransaction, 
    ConfirmationsReadyEvent, 
    ExpectedTransaction 
} from './safeApiTypes';

export class ConfirmationTracker extends EventEmitter {
    private safeAddress: string;
    private apiBaseUrl: string;
    private pollingInterval: number;
    private trackedProposals: Map<string, SafeTransaction> = new Map();
    private isRunning: boolean = false;
    private pollingTimer?: NodeJS.Timeout;

    constructor(
        safeAddress: string,
        apiBaseUrl: string = 'https://safe-transaction-mainnet.safe.global',
        pollingInterval: number = 5000 // 5 seconds for faster confirmation tracking
    ) {
        super();
        this.safeAddress = safeAddress.toLowerCase();
        this.apiBaseUrl = apiBaseUrl;
        this.pollingInterval = pollingInterval;
    }

    start(): void {
        if (this.isRunning) {
            AlertLogger.logInfo('ConfirmationTracker already running');
            return;
        }

        AlertLogger.logInfo('🔄 Starting Confirmation Tracker (Phase 2)...');
        this.isRunning = true;
        this.startPolling();
        AlertLogger.logInfo('✅ Confirmation Tracker started');
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        AlertLogger.logInfo('🛑 Stopping Confirmation Tracker...');
        
        this.isRunning = false;
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = undefined;
        }
        this.trackedProposals.clear();

        AlertLogger.logInfo('✅ Confirmation Tracker stopped');
    }

    trackProposal(proposal: SafeTransaction): void {
        if (proposal.isExecuted) {
            AlertLogger.logInfo(`⚠️ Proposal ${proposal.safeTxHash} already executed, not tracking`);
            return;
        }

        AlertLogger.logInfo(`📋 Starting to track proposal: ${proposal.safeTxHash}`);
        AlertLogger.logInfo(`Initial confirmations: ${proposal.confirmations.length}/${proposal.confirmationsRequired}`);

        this.trackedProposals.set(proposal.safeTxHash, proposal);

        // If already has enough confirmations, trigger immediately
        if (proposal.confirmations.length >= proposal.confirmationsRequired) {
            AlertLogger.logInfo('⚡ Proposal already has enough confirmations!');
            this.handleConfirmationsReady(proposal);
        }
    }

    private startPolling(): void {
        if (!this.isRunning) return;

        this.pollingTimer = setTimeout(async () => {
            try {
                await this.checkConfirmationStatus();
            } catch (error) {
                AlertLogger.logError('Error checking confirmation status', error as Error);
            }
            
            // Schedule next poll
            if (this.isRunning) {
                this.startPolling();
            }
        }, this.pollingInterval);
    }

    private async checkConfirmationStatus(): Promise<void> {
        if (this.trackedProposals.size === 0) {
            return;
        }

        for (const [safeTxHash, originalProposal] of this.trackedProposals) {
            try {
                const updatedProposal = await this.fetchProposal(safeTxHash);
                
                if (!updatedProposal) {
                    AlertLogger.logError(`Failed to fetch proposal: ${safeTxHash}`);
                    continue;
                }

                // Check if executed
                if (updatedProposal.isExecuted) {
                    AlertLogger.logInfo(`🎉 Proposal executed: ${safeTxHash}`);
                    this.handleProposalExecuted(updatedProposal);
                    this.trackedProposals.delete(safeTxHash);
                    continue;
                }

                // Check if confirmations changed
                const currentConfirmations = updatedProposal.confirmations.length;
                const originalConfirmations = originalProposal.confirmations.length;
                const required = updatedProposal.confirmationsRequired;

                if (currentConfirmations !== originalConfirmations) {
                    AlertLogger.logInfo(`📝 Confirmation update for ${safeTxHash}: ${currentConfirmations}/${required}`);
                    this.trackedProposals.set(safeTxHash, updatedProposal);

                    // Log new signers
                    const newSigners = updatedProposal.confirmations
                        .filter(conf => !originalProposal.confirmations.some(orig => orig.owner === conf.owner))
                        .map(conf => conf.owner);
                    
                    if (newSigners.length > 0) {
                        AlertLogger.logInfo(`✍️ New signatures from: ${newSigners.join(', ')}`);
                    }
                }

                // Check if ready for execution
                if (currentConfirmations >= required && originalConfirmations < required) {
                    AlertLogger.logInfo(`🚀 Confirmations threshold reached for ${safeTxHash}!`);
                    this.handleConfirmationsReady(updatedProposal);
                }

            } catch (error) {
                AlertLogger.logError(`Error checking proposal ${safeTxHash}`, error as Error);
            }
        }
    }

    private async fetchProposal(safeTxHash: string): Promise<SafeTransaction | null> {
        try {
            // Get specific transaction by safeTxHash
            const apiUrl = `${this.apiBaseUrl}/api/v2/safes/${this.safeAddress}/multisig-transactions/`;
            const response = await axios.get(apiUrl, {
                params: {
                    safe_tx_hash: safeTxHash,
                    limit: 1
                }
            });

            if (response.data.results && response.data.results.length > 0) {
                return response.data.results[0];
            }

            return null;
        } catch (error) {
            AlertLogger.logError(`Failed to fetch proposal ${safeTxHash}`, error as Error);
            return null;
        }
    }

    private handleConfirmationsReady(proposal: SafeTransaction): void {
        AlertLogger.logInfo('🎯 CONFIRMATIONS READY - Activating Phase 3!');
        AlertLogger.logInfo(`Proposal: ${proposal.safeTxHash}`);
        AlertLogger.logInfo(`Confirmations: ${proposal.confirmations.length}/${proposal.confirmationsRequired}`);
        AlertLogger.logInfo('🔥 AGGRESSIVE MODE ACTIVATED!');

        // Generate expected transaction pattern for mempool detection
        const expectedTransaction = this.generateExpectedTransaction(proposal);

        const event: ConfirmationsReadyEvent = {
            type: 'confirmations-ready',
            proposal,
            safeTxHash: proposal.safeTxHash,
            confirmations: proposal.confirmations.length,
            required: proposal.confirmationsRequired,
            expectedTransactionPattern: expectedTransaction,
            timestamp: new Date()
        };

        this.emit('confirmations-ready', event);
    }

    private handleProposalExecuted(proposal: SafeTransaction): void {
        AlertLogger.logInfo('⚡ PROPOSAL EXECUTED IN BLOCKCHAIN!');
        AlertLogger.logInfo(`Transaction Hash: ${proposal.transactionHash}`);
        AlertLogger.logInfo(`Block: ${proposal.blockNumber}`);

        // Emit upgrade-detected event for immediate Bundle2
        this.emit('upgrade-detected', {
            type: 'upgrade-detected',
            transaction: proposal,
            rawTransactionHash: proposal.transactionHash,
            proxyAddress: proposal.to, // ProxyAdmin address
            adminAddress: proposal.executor,
            upgradeMethod: proposal.dataDecoded?.method || 'upgrade',
            timestamp: new Date(),
            blockNumber: proposal.blockNumber
        });
    }

    private generateExpectedTransaction(proposal: SafeTransaction): ExpectedTransaction {
        // Generate the expected transaction pattern for mempool detection
        // Safe execTransaction calls the ProxyAdmin.upgrade internally

        return {
            to: this.safeAddress, // Transaction will be sent to Safe contract
            dataPattern: proposal.data, // The upgrade calldata
            upgradeCalldata: proposal.data // ProxyAdmin upgrade call
        };
    }

    // Public methods
    isTracking(safeTxHash: string): boolean {
        return this.trackedProposals.has(safeTxHash);
    }

    getTrackedProposals(): string[] {
        return Array.from(this.trackedProposals.keys());
    }

    getTrackedProposalsCount(): number {
        return this.trackedProposals.size;
    }

    // Stop tracking specific proposal
    stopTracking(safeTxHash: string): void {
        if (this.trackedProposals.has(safeTxHash)) {
            this.trackedProposals.delete(safeTxHash);
            AlertLogger.logInfo(`📋 Stopped tracking proposal: ${safeTxHash}`);
        }
    }

    // Manual check for specific proposal
    async checkProposalNow(safeTxHash: string): Promise<void> {
        if (!this.trackedProposals.has(safeTxHash)) {
            AlertLogger.logError(`Proposal ${safeTxHash} is not being tracked`);
            return;
        }

        AlertLogger.logInfo(`🔍 Manual check for proposal: ${safeTxHash}`);
        const proposal = await this.fetchProposal(safeTxHash);
        
        if (proposal) {
            const confirmations = proposal.confirmations.length;
            const required = proposal.confirmationsRequired;
            
            AlertLogger.logInfo(`Status: ${confirmations}/${required} confirmations`);
            AlertLogger.logInfo(`Executed: ${proposal.isExecuted}`);
            
            if (proposal.isExecuted) {
                this.handleProposalExecuted(proposal);
                this.trackedProposals.delete(safeTxHash);
            } else if (confirmations >= required) {
                this.handleConfirmationsReady(proposal);
            }
        }
    }
}