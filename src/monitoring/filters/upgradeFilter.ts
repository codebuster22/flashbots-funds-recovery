import { BaseTransactionFilter } from './baseFilter';
import { UpgradeDetector } from '../detectors/upgradeDetector';
import { FilterResult, UpgradeFilterResult } from '../types';

export class UpgradeFilter extends BaseTransactionFilter {
    private proxyAddress: string;
    private adminAddress?: string;

    constructor(proxyAddress: string, adminAddress?: string) {
        super('UpgradeFilter');
        this.proxyAddress = proxyAddress.toLowerCase();
        this.adminAddress = adminAddress?.toLowerCase();
    }

    filterTransaction(tx: any): UpgradeFilterResult | null {
        if (!tx.to || !tx.data) {
            return null;
        }

        const isUpgrade = UpgradeDetector.isUpgradeTransaction(
            tx.to,
            tx.data,
            this.proxyAddress,
            this.adminAddress
        );

        if (!isUpgrade) {
            return null;
        }

        const upgradeDetails = UpgradeDetector.extractUpgradeDetails(tx, this.proxyAddress);
        
        if (!upgradeDetails?.isUpgrade) {
            return null;
        }

        try {
            const rawTransactionHex = UpgradeDetector.serializeTransaction(tx);

            return {
                type: 'upgrade',
                priority: 'CRITICAL',
                data: upgradeDetails,
                proxyAddress: this.proxyAddress,
                adminAddress: this.adminAddress || tx.from,
                method: upgradeDetails.method,
                rawTransactionHex
            };
        } catch (error) {
            console.error('Failed to process upgrade transaction:', error);
            return null;
        }
    }
}