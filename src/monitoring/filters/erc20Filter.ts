import { BaseTransactionFilter } from './baseFilter';
import { ERC20Detector } from '../detectors/erc20Detector';
import { FilterResult, ERC20FilterResult, SuspiciousTransaction } from '../types';

export class ERC20Filter extends BaseTransactionFilter {
    private compromisedAddress: string;
    private erc20TokenAddress: string;

    constructor(compromisedAddress: string, erc20TokenAddress: string) {
        super('ERC20Filter');
        this.compromisedAddress = compromisedAddress.toLowerCase();
        this.erc20TokenAddress = erc20TokenAddress.toLowerCase();
    }

    filterTransaction(tx: any): ERC20FilterResult | null {
        if (!tx.from || !tx.to || !tx.data) {
            return null;
        }

        const fromAddress = tx.from.toLowerCase();
        const toAddress = tx.to.toLowerCase();

        if (fromAddress !== this.compromisedAddress) {
            return null;
        }

        if (!ERC20Detector.isERC20Transaction(toAddress, tx.data, this.erc20TokenAddress)) {
            return null;
        }

        // Accept both legacy and EIP-1559 hacker transactions. We always respond with 1559.

        const methodInfo = ERC20Detector.decodeMethodCall(tx.data);
        if (!methodInfo) {
            return null;
        }

        const suspiciousTransaction: SuspiciousTransaction = {
            hash: tx.hash || 'pending',
            from: tx.from,
            to: tx.to,
            methodName: methodInfo.methodName,
            methodSignature: methodInfo.methodSignature,
            timestamp: new Date(),
            // Preserve hacker tx type and gas info (legacy or 1559)
            type: typeof tx.type !== 'undefined' ? Number(tx.type) : undefined,
            nonce: typeof tx.nonce === 'number' ? tx.nonce : undefined,
            gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
            maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined,
            // legacy gasPrice retained for replacement math/logging
            gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
            value: BigInt(tx.value || '0')
        };

        const urgencyLevel = this.determineUrgencyLevel(methodInfo.methodName);

        return {
            type: 'hacker-erc20',
            priority: urgencyLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            data: methodInfo,
            suspiciousTransaction,
            method: methodInfo.methodName,
            urgencyLevel
        };
    }

    private determineUrgencyLevel(methodName: string): 'HIGH' | 'CRITICAL' {
        const criticalMethods = new Set(['transfer', 'transferFrom']);
        return criticalMethods.has(methodName) ? 'CRITICAL' : 'HIGH';
    }
}