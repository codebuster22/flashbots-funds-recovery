import { ERC20Detector } from './erc20Detector';
import { SuspiciousTransaction } from './types';

export class TransactionFilter {
    private compromisedAddress: string;
    private erc20TokenAddress: string;

    constructor(compromisedAddress: string, erc20TokenAddress: string) {
        this.compromisedAddress = compromisedAddress.toLowerCase();
        this.erc20TokenAddress = erc20TokenAddress.toLowerCase();
    }

    filterTransaction(tx: any): SuspiciousTransaction | null {
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

        const methodInfo = ERC20Detector.decodeMethodCall(tx.data);
        if (!methodInfo) {
            return null;
        }

        return {
            hash: tx.hash || 'pending',
            from: tx.from,
            to: tx.to,
            methodName: methodInfo.methodName,
            methodSignature: methodInfo.methodSignature,
            timestamp: new Date(),
            gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
            maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
            value: BigInt(tx.value || '0')
        };
    }
}