export interface SuspiciousTransaction {
    hash: string;
    from: string;
    to: string;
    methodName: string;
    methodSignature: string;
    timestamp: Date;
    // EIP-1559 fields (preferred)
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    // Additional context for reliable replacement
    type?: number; // should be 2 for EIP-1559
    nonce?: number;
    gasLimit?: bigint;
    // Legacy field retained as optional for logging only (not used in logic)
    gasPrice?: bigint;
    value: bigint;
}

export interface MonitoringAlert {
    type: 'SUSPICIOUS_TRANSACTION';
    transaction: SuspiciousTransaction;
    message: string;
}

// Event-driven architecture types
export interface BaseMonitoringEvent {
    timestamp: Date;
    blockNumber?: number;
}

export interface UpgradeDetectedEvent extends BaseMonitoringEvent {
    type: 'upgrade-detected';
    source: 'safe-api' | 'mempool';
    rawSignedTransactionHexString: string;
    proxyAddress: string;
    adminAddress: string;
    upgradeMethod: string;
}

export interface UpgradeExecutedEvent extends BaseMonitoringEvent {
    type: 'upgrade-executed';
    source: 'safe-api';
    safeTxHash: string;
    blockNumber: number;
    isSuccessful: boolean;
    executedAt: Date;
}

export interface HackerActivityEvent extends BaseMonitoringEvent {
    type: 'hacker-erc20-activity';
    transaction: SuspiciousTransaction;
    erc20Method: string;
    urgencyLevel: 'HIGH' | 'CRITICAL';
}

export interface BundleOpportunityEvent extends BaseMonitoringEvent {
    type: 'bundle-opportunity';
    reason: 'upgrade-detected' | 'hacker-activity';
    bundleType: 'Bundle1' | 'Bundle2' | 'Emergency';
    transactionData?: string;
}

export interface EmergencyResponseEvent extends BaseMonitoringEvent {
    type: 'emergency-response';
    originalTx: SuspiciousTransaction;
    action: 'replace-with-higher-gas' | 'emergency-bundle';
}

// Filter system types
export interface FilterResult {
    type: 'upgrade' | 'hacker-erc20';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    data: any;
}

export interface UpgradeFilterResult extends FilterResult {
    type: 'upgrade';
    proxyAddress: string;
    adminAddress: string;
    method: string;
    // JSON metadata for logging only; not a raw signed tx
    rawTxMetadataJson?: string;
}

export interface ERC20FilterResult extends FilterResult {
    type: 'hacker-erc20';
    suspiciousTransaction: SuspiciousTransaction;
    method: string;
    urgencyLevel: 'HIGH' | 'CRITICAL';
}

// Handler types
export type MonitoringEventType = 'upgrade-detected' | 'hacker-erc20-activity' | 'bundle-opportunity' | 'emergency-response';

export type MonitoringEvent = UpgradeDetectedEvent | HackerActivityEvent | BundleOpportunityEvent | EmergencyResponseEvent;