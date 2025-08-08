import { TransactionEntry } from './types';
import { Interface, parseUnits, formatUnits } from 'ethers';
import { erc20Abi } from './abi/erc20Abi';
import {
    compromisedAuthSigner,
    funderAddress,
    balance,
    normalProvider,
    maxFeePerGas,
    maxPriorityFeePerGas
} from '../config';
import { AlertLogger } from './monitoring/alertLogger';
import { SuspiciousTransaction } from './monitoring/types';

export class EmergencyReplacement {
    private static erc20Interface = new Interface(erc20Abi);

    static async createReplacementTransaction(
        hackerTx: SuspiciousTransaction
    ): Promise<{ transaction: TransactionEntry; isRecoveryAction: boolean }> {
        
        const isTransferMethod = this.isTransferMethod(hackerTx.methodName);
        
        if (isTransferMethod) {
            // RECOVERY ACTION: Hijack transfer with full balance
            return {
                transaction: await this.createTransferHijacking(hackerTx),
                isRecoveryAction: true
            };
        } else {
            // DEFENSIVE ACTION: Neutralize approval with 0 ETH transfer
            return {
                transaction: await this.createApprovalNeutralization(hackerTx),
                isRecoveryAction: false
            };
        }
    }

    private static async createTransferHijacking(hackerTx: SuspiciousTransaction): Promise<TransactionEntry> {
        AlertLogger.logInfo('🎯 Creating transfer hijacking transaction...');
        AlertLogger.logInfo(`Hijacking ${hackerTx.methodName} with full balance: ${balance.toString()}`);

        const hackerNonce = await this.getHackerNonce();
        const competitiveGas = this.calculateCompetitiveGas(hackerTx);

        // Create transfer to our funder wallet with full balance
        const transferData = this.erc20Interface.encodeFunctionData('transfer', [
            funderAddress,
            balance
        ]);

        return {
            signer: compromisedAuthSigner,
            transaction: {
                chainId: 1,
                type: 2,
                value: 0,
                to: hackerTx.to,
                data: transferData,
                maxFeePerGas: competitiveGas.maxFeePerGas,
                maxPriorityFeePerGas: competitiveGas.maxPriorityFeePerGas,
                gasLimit: BigInt('65000'),
                nonce: hackerNonce
            }
        };
    }

    private static async createApprovalNeutralization(hackerTx: SuspiciousTransaction): Promise<TransactionEntry> {
        AlertLogger.logInfo('🛡️ Creating approval neutralization transaction...');
        AlertLogger.logInfo('Burning nonce with 0 ETH transfer to block approval');

        const hackerNonce = await this.getHackerNonce();
        const dominatingGas = this.calculateDominatingPriorityFee(hackerTx);

        // Create 0 ETH transfer to compromised wallet (nonce burn)
        return {
            signer: compromisedAuthSigner,
            transaction: {
                chainId: 1,
                type: 2,
                value: 0,
                to: compromisedAuthSigner.address, // Send to self
                data: '0x',
                maxFeePerGas: dominatingGas.maxFeePerGas,
                maxPriorityFeePerGas: dominatingGas.maxPriorityFeePerGas,
                gasLimit: BigInt('21000'),
                nonce: hackerNonce
            }
        };
    }

    private static async getHackerNonce(): Promise<number> {
        try {
            const nonce = await normalProvider.getTransactionCount(compromisedAuthSigner.address, 'pending');
            AlertLogger.logInfo(`Using compromised wallet nonce: ${nonce}`);
            return nonce;
        } catch (error) {
            AlertLogger.logError('Failed to get hacker nonce', error as Error);
            throw error;
        }
    }

    private static calculateCompetitiveGas(hackerTx: SuspiciousTransaction): {
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    } {
        // Use 25% higher gas prices than hacker
        const gasMultiplier = 1.25;
        
        const hackerMaxFee = hackerTx.maxFeePerGas || hackerTx.gasPrice || maxFeePerGas;
        const hackerPriorityFee = hackerTx.maxFeePerGas ? 
            (hackerTx.maxPriorityFeePerGas || maxPriorityFeePerGas) : 
            (hackerTx.gasPrice || maxPriorityFeePerGas);

        const competitiveMaxFee = BigInt(Math.ceil(Number(hackerMaxFee) * gasMultiplier));
        const competitivePriorityFee = BigInt(Math.ceil(Number(hackerPriorityFee) * gasMultiplier));

        AlertLogger.logInfo(`Gas Competition:
   Hacker Max Fee: ${formatUnits(hackerMaxFee, 'gwei')} gwei
   Our Max Fee: ${formatUnits(competitiveMaxFee, 'gwei')} gwei (+25%)
   Hacker Priority: ${formatUnits(hackerPriorityFee, 'gwei')} gwei  
   Our Priority: ${formatUnits(competitivePriorityFee, 'gwei')} gwei (+25%)`);

        return {
            maxFeePerGas: competitiveMaxFee,
            maxPriorityFeePerGas: competitivePriorityFee
        };
    }

    private static calculateDominatingPriorityFee(hackerTx: SuspiciousTransaction): {
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    } {
        // Calculate priority fee dominance: our_priority × our_gas > hacker_priority × hacker_gas
        const hackerGasLimit = BigInt('50000'); // Typical approve gas
        const ourGasLimit = BigInt('21000'); // Simple transfer gas
        
        const hackerPriorityFee = hackerTx.maxPriorityFeePerGas || 
            hackerTx.gasPrice || 
            maxPriorityFeePerGas;

        const hackerPriorityTotal = hackerPriorityFee * hackerGasLimit;
        const requiredPriorityFee = hackerPriorityTotal / ourGasLimit + parseUnits('1', 'gwei'); // +1 gwei buffer
        
        const dominatingMaxFee = requiredPriorityFee + parseUnits('10', 'gwei'); // base fee buffer

        AlertLogger.logInfo(`Priority Fee Dominance:
   Hacker Priority Total: ${formatUnits(hackerPriorityTotal, 'gwei')} gwei×gas
   Required Our Priority: ${formatUnits(requiredPriorityFee, 'gwei')} gwei
   Our Priority Total: ${formatUnits(requiredPriorityFee * ourGasLimit, 'gwei')} gwei×gas`);

        return {
            maxFeePerGas: dominatingMaxFee,
            maxPriorityFeePerGas: requiredPriorityFee
        };
    }

    private static isTransferMethod(methodName: string): boolean {
        return ['transfer', 'transferFrom'].includes(methodName);
    }

    static async submitReplacementTransaction(
        replacementTx: TransactionEntry
    ): Promise<string> {
        try {
            AlertLogger.logInfo('🚀 Submitting emergency replacement transaction...');
            
            const signedTx = await replacementTx.signer.signTransaction(replacementTx.transaction);
            const txResponse = await normalProvider.broadcastTransaction(signedTx);
            
            AlertLogger.logInfo(`✅ Replacement transaction submitted: ${txResponse.hash}`);
            AlertLogger.logInfo(`Nonce: ${replacementTx.transaction.nonce}`);
            AlertLogger.logInfo(`Gas: ${formatUnits(replacementTx.transaction.maxFeePerGas, 'gwei')} gwei`);
            
            return txResponse.hash;
        } catch (error) {
            AlertLogger.logError('Failed to submit replacement transaction', error as Error);
            throw error;
        }
    }
}