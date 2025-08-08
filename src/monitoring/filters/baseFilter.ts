import { FilterResult } from '../types';

export abstract class BaseTransactionFilter {
    protected filterName: string;

    constructor(filterName: string) {
        this.filterName = filterName;
    }

    abstract filterTransaction(tx: any): FilterResult | null;
    
    getFilterName(): string {
        return this.filterName;
    }

    protected serializeTransaction(tx: any): string {
        try {
            return JSON.stringify({
                to: tx.to,
                from: tx.from,
                data: tx.data,
                value: tx.value?.toString(),
                gasLimit: tx.gasLimit?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                maxFeePerGas: tx.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
                nonce: tx.nonce,
                type: tx.type,
                chainId: tx.chainId
            });
        } catch (error) {
            return '';
        }
    }
}