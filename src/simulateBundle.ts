import { formatEther, formatUnits } from "ethers";
import { flashbotsProvider } from "../config";

export const simulateBundle = async (signedBundle: Array<string>, blockTag?: bigint | "latest"): Promise<boolean> => {
    console.log("🧪 Starting bundle simulation...");
    console.log(`   📦 Bundle contains ${signedBundle.length} transactions`);
    
    if (!blockTag) {
        blockTag = "latest";
    }
    
    console.log(`   🎯 Simulating against block: ${blockTag}`);
    
    try {
        const simulation = await flashbotsProvider.simulate(signedBundle, blockTag);
        // console.log(simulation);
        
        console.log(`📊 Simulation Results (${signedBundle.length} trx):`);
        console.log("=" .repeat(50));

        if (simulation.error) {
            console.log("❌ SIMULATION FAILED!");
            console.log(`   Error:`, simulation.error);
            return false;
        }

        if (simulation.firstRevert) {
            console.log("❌ SIMULATION FAILED!");
            console.log(`   First Revert:`, simulation.firstRevert);
            return false;
        }
        
        console.log("✅ SIMULATION SUCCESSFUL!");
        console.log(`   Bundle Hash: ${simulation.bundleHash}`);
        console.log(`   Bundle Gas Price: ${formatUnits(simulation.bundleGasPrice, "gwei")} gwei`);
        console.log(`   Total Gas Used: ${simulation.totalGasUsed.toLocaleString()}`);
        console.log(`   Coinbase Diff: ${formatEther(simulation.coinbaseDiff)} ETH`);
        console.log(`   ETH Sent to Coinbase: ${formatEther(simulation.ethSentToCoinbase)} ETH`);
        console.log(`   Gas Fees: ${formatEther(simulation.gasFees)} ETH`);
        console.log(`   State Block Number: ${simulation.stateBlockNumber}`);
        
        console.log("");
        console.log("📋 Individual Transaction Results:");
        
        simulation.results.forEach((result, index) => {
            console.log(`   Transaction ${index + 1}:`);
            console.log(`      TX Hash: ${result.txHash}`);
            console.log(`      From: ${result.fromAddress}`);
            console.log(`      To: ${result.toAddress}`);
            console.log(`      Gas Used: ${result.gasUsed.toLocaleString()}`);
            console.log(`      Gas Price: ${formatUnits(result.gasPrice, "gwei")} gwei`);
            console.log(`      Gas Fees: ${formatEther(result.gasFees)} ETH`);
            console.log(`      Coinbase Diff: ${formatEther(result.coinbaseDiff)} ETH`);
            console.log(`      ETH to Coinbase: ${formatEther(result.ethSentToCoinbase)} ETH`);
            if (result.value && result.value !== "0x") {
                console.log(`      Value: ${formatEther(result.value)} ETH`);
            }
            console.log("");
        });
        
        console.log("🎉 Bundle simulation completed successfully!");
        console.log("💡 The bundle is ready for production execution.");

        return true;
    } catch (error) {
        console.log("❌ SIMULATION FAILED!");
        console.log(`   Error: ${error.message}`);
        if (error.reason) {
            console.log(`   Reason: ${error.reason}`);
        }
        throw error;
    }
}