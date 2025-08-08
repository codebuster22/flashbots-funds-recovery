import { BaseTransactionFilter } from './baseFilter';
import { UpgradeDetector } from '../detectors/upgradeDetector';
import { FilterResult, UpgradeFilterResult } from '../types';

export class UpgradeFilter extends BaseTransactionFilter {
    private proxyAddress: string;
    private adminAddress?: string;
    private safeAddress?: string;

    constructor(proxyAddress: string, adminAddress?: string, safeAddress?: string) {
        super('UpgradeFilter');
        this.proxyAddress = proxyAddress.toLowerCase();
        this.adminAddress = adminAddress?.toLowerCase();
        this.safeAddress = safeAddress?.toLowerCase();
    }

    filterTransaction(tx: any): UpgradeFilterResult | null {
        if (!tx.to || !tx.data) {
            return null;
        }

        const isUpgrade = UpgradeDetector.isUpgradeTransaction(
            tx.to,
            tx.data,
            this.proxyAddress,
            this.adminAddress,
            this.safeAddress
        );

        if (!isUpgrade) {
            return null;
        }

        const upgradeDetails = UpgradeDetector.extractUpgradeDetails(tx, this.proxyAddress, this.adminAddress, this.safeAddress);
        
        if (!upgradeDetails?.isUpgrade) {
            return null;
        }

        try {
            const rawTxMetadataJson = UpgradeDetector.serializeTransaction(tx);

            return {
                type: 'upgrade',
                priority: 'CRITICAL',
                data: upgradeDetails,
                proxyAddress: this.proxyAddress,
                adminAddress: this.adminAddress || tx.from,
                method: upgradeDetails.method,
                rawTxMetadataJson
            };
        } catch (error) {
            console.error('Failed to process upgrade transaction:', error);
            return null;
        }
    }
}