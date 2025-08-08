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
        nonce?: number;
    };
}

// Input type for bundle signing: either a transaction to be signed by a signer,
// or a pre-signed raw transaction hex string.
export type BundleItemInput = TransactionEntry | { signedTransaction: string };