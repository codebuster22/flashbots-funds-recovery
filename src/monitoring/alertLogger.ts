import { MonitoringAlert, SuspiciousTransaction } from './types';
import { formatEther, formatUnits } from 'ethers';

export class AlertLogger {
    private static formatTransaction(tx: SuspiciousTransaction): string {
        const gasInfo = tx.maxFeePerGas 
            ? `${formatUnits(tx.maxFeePerGas, "gwei")} gwei` 
            : tx.gasPrice 
                ? `${formatUnits(tx.gasPrice, "gwei")} gwei`
                : 'unknown';

        return [
            `🚨 SUSPICIOUS TRANSACTION DETECTED!`,
            `   Hash: ${tx.hash}`,
            `   From: ${tx.from} (COMPROMISED WALLET)`,
            `   To: ${tx.to}`,
            `   Method: ${tx.methodName} (${tx.methodSignature})`,
            `   Value: ${formatEther(tx.value)} ETH`,
            `   Gas: ${gasInfo}`,
            `   Time: ${tx.timestamp.toISOString()}`,
            `   ⚠️  IMMEDIATE ACTION MAY BE REQUIRED!`,
        ].join('\n');
    }

    static logAlert(alert: MonitoringAlert): void {
        console.log('='.repeat(60));
        console.log(this.formatTransaction(alert.transaction));
        console.log('='.repeat(60));
        console.log('');
    }

    static logInfo(message: string): void {
        console.log(`[${new Date().toISOString()}] INFO: ${message}`);
    }

    static logError(message: string, error?: Error): void {
        console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
        if (error) {
            console.error(error);
        }
    }
}