import { BaseEventHandler } from './baseHandler';
import { HackerActivityEvent, EmergencyResponseEvent } from '../types';
import { AlertLogger, MonitoringAlert } from '../alertLogger';

export class HackerActivityHandler extends BaseEventHandler {
    constructor() {
        super('HackerActivityHandler');
    }

    async handleEvent(event: HackerActivityEvent): Promise<void> {
        if (event.type !== 'hacker-erc20-activity') {
            return;
        }

        await this.handleHackerActivity(event);
    }

    private async handleHackerActivity(event: HackerActivityEvent): Promise<void> {
        const alert: MonitoringAlert = {
            type: 'SUSPICIOUS_TRANSACTION',
            transaction: event.transaction,
            message: `🚨 HACKER DETECTED: ${event.erc20Method} transaction from compromised wallet`
        };

        AlertLogger.logAlert(alert);
        
        AlertLogger.logInfo(`Hacker Activity Details:
   Method: ${event.erc20Method}
   Urgency: ${event.urgencyLevel}
   Hash: ${event.transaction.hash}
   Gas Price: ${event.transaction.gasPrice ? `${event.transaction.gasPrice.toString()} wei` : 'N/A'}
   Max Fee: ${event.transaction.maxFeePerGas ? `${event.transaction.maxFeePerGas.toString()} wei` : 'N/A'}`);

        if (event.urgencyLevel === 'CRITICAL') {
            AlertLogger.logInfo('🔥 CRITICAL URGENCY - Triggering emergency response');
            
            // Emit emergency response event
            const emergencyEvent: EmergencyResponseEvent = {
                type: 'emergency-response',
                originalTx: event.transaction,
                action: 'replace-with-higher-gas',
                timestamp: new Date(),
                blockNumber: event.blockNumber
            };

            this.emitEvent('emergency-response', emergencyEvent);
        }
    }
}