import { BaseEventHandler } from './baseHandler';
import { UpgradeDetectedEvent, BundleOpportunityEvent } from '../types';
import { AlertLogger } from '../alertLogger';

export class UpgradeHandler extends BaseEventHandler {
    constructor() {
        super('UpgradeHandler');
    }

    async handleEvent(event: UpgradeDetectedEvent): Promise<void> {
        if (event.type !== 'upgrade-detected') {
            return;
        }

        await this.handleUpgradeDetected(event);
    }

    private async handleUpgradeDetected(event: UpgradeDetectedEvent): Promise<void> {
        AlertLogger.logInfo('🚀 UPGRADE TRANSACTION DETECTED - Preparing Bundle2');
        
        try {
            AlertLogger.logInfo(`Upgrade Details:
   Proxy: ${event.proxyAddress}
   Admin: ${event.adminAddress}
   Method: ${event.upgradeMethod}
   Source: ${event.source}`);

            // Emit bundle opportunity event for Bundle2 creation
            const bundleOpportunity: BundleOpportunityEvent = {
                type: 'bundle-opportunity',
                reason: 'upgrade-detected',
                bundleType: 'Bundle2',
                transactionData: event.rawSignedTransactionHexString,
                timestamp: new Date(),
                blockNumber: event.blockNumber
            };

            this.emitEvent('bundle-opportunity', bundleOpportunity);

            AlertLogger.logInfo('✅ Bundle2 opportunity event emitted');
            
        } catch (error) {
            AlertLogger.logError('Failed to handle upgrade detection', error as Error);
        }
    }
}