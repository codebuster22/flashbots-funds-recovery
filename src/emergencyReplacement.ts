import { TransactionEntry } from './types';
import { Interface, parseUnits, formatUnits } from 'ethers';
import { erc20Abi } from './abi/erc20Abi';
import {
    compromisedAuthSigner,
    funderAddress,
    balance,
    normalProvider,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId
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

        const hackerNonce = await this.getHackerNonce(hackerTx);
        const competitiveGas = await this.calculateCompetitiveGas(hackerTx);

        // Create transfer to our funder wallet with full balance
        const transferData = this.erc20Interface.encodeFunctionData('transfer', [
            funderAddress,
            balance
        ]);

            return {
            signer: compromisedAuthSigner,
            transaction: {
                chainId: chainId,
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

        const hackerNonce = await this.getHackerNonce(hackerTx);
        const dominatingGas = await this.calculateDominatingPriorityFee(hackerTx);

        // Create 0 ETH transfer to compromised wallet (nonce burn)
        return {
            signer: compromisedAuthSigner,
            transaction: {
                chainId: chainId,
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

    private static async getHackerNonce(hackerTx?: SuspiciousTransaction): Promise<number> {
        try {
            if (hackerTx?.nonce !== undefined) {
                AlertLogger.logInfo(`Using hacker tx nonce: ${hackerTx.nonce}`);
                return hackerTx.nonce;
            }
            const nonce = await normalProvider.getTransactionCount(compromisedAuthSigner.address, 'pending');
            AlertLogger.logInfo(`Using compromised wallet nonce: ${nonce}`);
            return nonce;
        } catch (error) {
            AlertLogger.logError('Failed to get hacker nonce', error as Error);
            throw error;
        }
    }

    private static async calculateCompetitiveGas(hackerTx: SuspiciousTransaction): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    }> {
        // EIP-1559 only. Bump both tip and maxFee over hacker's by multiplier and ensure baseFee coverage.
        const bump = 1.25;
        const minTip = parseUnits('2', 'gwei');
        const baseFee = (await normalProvider.getBlock('latest'))?.baseFeePerGas ?? 0n;

        // Support both legacy and 1559 hacker transactions
        const inferredHackerTip = hackerTx.maxPriorityFeePerGas ?? (hackerTx.gasPrice ?? 0n);
        const hackerTip = inferredHackerTip || maxPriorityFeePerGas;
        const inferredHackerMaxFee = hackerTx.maxFeePerGas ?? (hackerTx.gasPrice ? baseFee + hackerTx.gasPrice : undefined);
        const hackerMaxFee = inferredHackerMaxFee ?? (baseFee + hackerTip);

        const ourTip = BigInt(Math.ceil(Number(hackerTip) * bump));
        const finalTip = ourTip > minTip ? ourTip : minTip;

        const feeByBump = BigInt(Math.ceil(Number(hackerMaxFee) * bump));
        const feeByBase = baseFee + finalTip + parseUnits('5', 'gwei');
        const finalMaxFee = feeByBump > feeByBase ? feeByBump : feeByBase;

        AlertLogger.logInfo(`Gas Competition (1559):
   Base Fee: ${formatUnits(baseFee, 'gwei')} gwei
   Hacker MaxFee: ${formatUnits(hackerMaxFee, 'gwei')} gwei | Tip: ${formatUnits(hackerTip, 'gwei')} gwei
   Our MaxFee: ${formatUnits(finalMaxFee, 'gwei')} gwei | Tip: ${formatUnits(finalTip, 'gwei')} gwei`);

        return {
            maxFeePerGas: finalMaxFee,
            maxPriorityFeePerGas: finalTip
        };
    }

    private static async calculateDominatingPriorityFee(hackerTx: SuspiciousTransaction): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    }> {
        // Ensure our (tip * ourGas) > (hackerTip * hackerGas) by a margin and cover base fee.
        const baseFee = (await normalProvider.getBlock('latest'))?.baseFeePerGas ?? 0n;
        const minTip = parseUnits('2', 'gwei');
        const buffer = parseUnits('5', 'gwei');

        // Use the hacker's gas limit if provided; otherwise choose conservative defaults
        const methodHint = hackerTx.methodName?.toLowerCase?.() || '';
        const defaultLimit = methodHint.includes('approve') ? BigInt('80000') : methodHint.includes('transfer') ? BigInt('70000') : BigInt('120000');
        const hackerGasLimit = hackerTx.gasLimit ?? defaultLimit;
        const ourGasLimit = BigInt('21000'); // simple transfer
        const hackerTip = (hackerTx.maxPriorityFeePerGas ?? (hackerTx.gasPrice ?? 0n)) || maxPriorityFeePerGas;

        const hackerPriorityTotal = hackerTip * hackerGasLimit;
        const requiredTip = hackerPriorityTotal / ourGasLimit + parseUnits('1', 'gwei');
        const finalTip = requiredTip > minTip ? requiredTip : minTip;

        const finalMaxFee = baseFee + finalTip + buffer;

        AlertLogger.logInfo(`Dominance Gas (1559):
   Base Fee: ${formatUnits(baseFee, 'gwei')} gwei
   Hacker Tip: ${formatUnits(hackerTip, 'gwei')} gwei × Gas ${ourGasLimit.toString()} vs ${hackerGasLimit.toString()}
   Our Tip: ${formatUnits(finalTip, 'gwei')} gwei | Our MaxFee: ${formatUnits(finalMaxFee, 'gwei')} gwei`);

        return {
            maxFeePerGas: finalMaxFee,
            maxPriorityFeePerGas: finalTip
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