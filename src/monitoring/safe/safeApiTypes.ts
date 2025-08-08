// Safe API Response Types
export interface SafeTransaction {
    safe: string;
    to: string;
    value: string;
    data: string;
    operation: number;
    gasToken: string;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    refundReceiver: string;
    nonce: string;
    executionDate: string | null;
    submissionDate: string;
    modified: string;
    blockNumber: number | null;
    transactionHash: string | null;
    safeTxHash: string;
    proposer: string;
    proposedByDelegate: string | null;
    executor: string | null;
    isExecuted: boolean;
    isSuccessful: boolean | null;
    ethGasPrice: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    gasUsed: number | null;
    fee: string | null;
    origin: string | null;
    dataDecoded: SafeDataDecoded | null;
    confirmationsRequired: number;
    confirmations: SafeConfirmation[];
    trusted: boolean;
    signatures: string | null;
}

export interface SafeDataDecoded {
    method: string;
    parameters: SafeParameter[];
}

export interface SafeParameter {
    name: string;
    type: string;
    value: string;
}

export interface SafeConfirmation {
    owner: string;
    submissionDate: string;
    transactionHash: string | null;
    signature: string;
    signatureType: string;
}

export interface SafeApiResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: SafeTransaction[];
    countUniqueNonce: number;
}

// Internal Event Types for Three-Phase System
export interface ProposalDetectedEvent {
    type: 'proposal-detected';
    proposal: SafeTransaction;
    safeTxHash: string;
    proxyAdmin: string;
    upgradeMethod: string;
    confirmations: number;
    required: number;
    timestamp: Date;
}

export interface ConfirmationsReadyEvent {
    type: 'confirmations-ready';
    proposal: SafeTransaction;
    safeTxHash: string;
    confirmations: number;
    required: number;
    expectedTransactionPattern: ExpectedTransaction;
    timestamp: Date;
}

export interface ExpectedTransaction {
    to: string; // multisig address
    dataPattern: string; // execTransaction pattern to match
    upgradeCalldata: string; // nested ProxyAdmin.upgrade call
}

// Gas Mode Types
export type GasMode = 'normal' | 'aggressive';
export type TransactionType = 'bundle1' | 'bundle2' | 'emergency';

export interface GasConfiguration {
    mode: GasMode;
    multiplier: number;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
}