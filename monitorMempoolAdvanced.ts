import { MempoolEventManager } from './src/monitoring/eventManager';
import { AlertLogger } from './src/monitoring/alertLogger';
import { 
    websocketRpc, 
    compromisedAddress, 
    erc20TokenAddress, 
    proxyContractAddress,
    proxyAdminAddress 
} from './config';

console.log("🚀 Starting Advanced Event-Driven Flashbots Mempool Monitor");
console.log("=" .repeat(60));

console.log("📋 Monitor Configuration:");
console.log(`   WebSocket RPC: ${websocketRpc}`);
console.log(`   Compromised Address: ${compromisedAddress}`);
console.log(`   ERC20 Token: ${erc20TokenAddress}`);
console.log(`   Proxy Contract: ${proxyContractAddress}`);
console.log(`   Proxy Admin: ${proxyAdminAddress || 'Auto-detect'}`);
console.log(`   ERC20 Methods: transfer, transferFrom, approve, setApproval`);
console.log(`   Upgrade Methods: upgradeTo, upgradeToAndCall, changeAdmin`);
console.log("");

const eventManager = new MempoolEventManager(
    websocketRpc,
    compromisedAddress,
    erc20TokenAddress,
    proxyContractAddress,
    proxyAdminAddress
);

// Setup additional event listeners for monitoring insights
eventManager.on('upgrade-detected', (event) => {
    console.log('\n🚀 UPGRADE DETECTED EVENT:');
    console.log(`   Method: ${event.upgradeMethod}`);
    console.log(`   Proxy: ${event.proxyAddress}`);
    console.log(`   Admin: ${event.adminAddress}`);
    console.log(`   Block: ${event.blockNumber || 'pending'}`);
    console.log(`   → Bundle2 strategy will be triggered`);
});

eventManager.on('hacker-erc20-activity', (event) => {
    console.log('\n🚨 HACKER ACTIVITY DETECTED:');
    console.log(`   Method: ${event.erc20Method}`);
    console.log(`   Urgency: ${event.urgencyLevel}`);
    console.log(`   Hash: ${event.transaction.hash}`);
    console.log(`   Block: ${event.blockNumber || 'pending'}`);
    console.log(`   → ${event.urgencyLevel === 'CRITICAL' ? 'Emergency response' : 'High alert'} triggered`);
});

async function startAdvancedMonitoring(): Promise<void> {
    try {
        await eventManager.start();
        
        AlertLogger.logInfo("");
        AlertLogger.logInfo("🎯 ADVANCED MONITORING ACTIVE:");
        AlertLogger.logInfo("   • Upgrade Detection: Ready for Bundle2 creation");
        AlertLogger.logInfo("   • Hacker Monitoring: Emergency response enabled");
        AlertLogger.logInfo("   • Event-Driven: All handlers connected");
        AlertLogger.logInfo("");
        AlertLogger.logInfo("⚡ Waiting for events... Press Ctrl+C to stop");
        
    } catch (error) {
        AlertLogger.logError("Failed to start advanced monitoring", error as Error);
        process.exit(1);
    }
}

function setupGracefulShutdown(): void {
    process.on('SIGINT', () => {
        console.log("\n");
        AlertLogger.logInfo('👋 Shutting down advanced monitor...');
        eventManager.stop();
        AlertLogger.logInfo('✅ Advanced monitoring stopped gracefully');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log("\n");
        AlertLogger.logInfo('👋 Shutting down advanced monitor...');
        eventManager.stop();
        AlertLogger.logInfo('✅ Advanced monitoring stopped gracefully');
        process.exit(0);
    });
}

setupGracefulShutdown();
startAdvancedMonitoring();