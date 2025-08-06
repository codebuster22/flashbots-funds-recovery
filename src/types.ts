import { Wallet } from "ethers";


export interface TransactionEntry {
    signer: Wallet;
    transaction: {
        chainId: number;
        type: number;
        value: number | bigint;
        to: string;
        data?: string;
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
        gasLimit: bigint;
    };
}