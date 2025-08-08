import { MempoolMonitor } from './src/monitoring/mempoolMonitor';
import { ERC20Filter } from './src/monitoring/filters/erc20Filter';
import { AlertLogger } from './src/monitoring/alertLogger';
import { websocketRpc, compromisedAddress, erc20TokenAddress } from './config';

console.log("🔍 Starting Flashbots Mempool Monitor");
console.log("=" .repeat(50));

console.log("📋 Monitor Configuration:");
console.log(`   WebSocket RPC: ${websocketRpc}`);
console.log(`   Compromised Address: ${compromisedAddress}`);
console.log(`   ERC20 Token: ${erc20TokenAddress}`);
console.log(`   Target Methods: transfer, transferFrom, approve, setApproval`);
console.log("");

const monitor = new MempoolMonitor(websocketRpc);
monitor.addFilter(new ERC20Filter(compromisedAddress, erc20TokenAddress));

async function startMonitoring(): Promise<void> {
    try {
        await monitor.start();
        
        AlertLogger.logInfo("🚨 Monitor is now active. Watching for suspicious transactions...");
        AlertLogger.logInfo("Press Ctrl+C to stop monitoring");
        
    } catch (error) {
        AlertLogger.logError("Failed to start monitor", error as Error);
        process.exit(1);
    }
}

function setupGracefulShutdown(): void {
    process.on('SIGINT', () => {
        AlertLogger.logInfo("\n👋 Shutting down monitor...");
        monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        AlertLogger.logInfo("\n👋 Shutting down monitor...");
        monitor.stop();
        process.exit(0);
    });
}

setupGracefulShutdown();
startMonitoring();