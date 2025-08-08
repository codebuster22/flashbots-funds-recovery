import { FlashbotsTransactionResponse, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { flashbotsProvider } from "../config";

interface BundleSubmissionResult {
    bundleHash: string;
    resolution: FlashbotsBundleResolution;
    success: boolean;
    targetBlock: number;
}

export const sendBundleToFlashbotsAndMonitor = async (signedBundle: Array<string>, targetBlockNumber: number): Promise<BundleSubmissionResult> => {
    console.log("📡 Submitting bundle to Flashbots...");
    console.log(`   📦 Bundle size: ${signedBundle.length} transactions`);
    console.log(`   🎯 Target block: ${targetBlockNumber}`);
    
    try {
        const bundleReceipt = await flashbotsProvider.sendRawBundle(
            signedBundle,
            targetBlockNumber
        ) as FlashbotsTransactionResponse;
        
        // Check if there's an error in the receipt
        if ('error' in bundleReceipt) {
            console.log("❌ Bundle submission failed!");
            console.log(`   Error: ${JSON.stringify(bundleReceipt.error, null, 2)}`);
            throw new Error(`Bundle submission failed: ${JSON.stringify(bundleReceipt.error)}`);
        }
        
        console.log("✅ Bundle submitted successfully!");
        console.log(`   🔗 Bundle Hash: ${bundleReceipt.bundleHash}`);
        console.log(`   ⏱️  Valid until block: ${targetBlockNumber}`);
        console.log("");

        console.log(`⏳ Waiting for bundle inclusion in block ${targetBlockNumber}...`);
        
        // Wait for response
        const waitResponse = await bundleReceipt.wait();
        console.log(`📊 Bundle Resolution: ${waitResponse}`);
        
        const result: BundleSubmissionResult = {
            bundleHash: bundleReceipt.bundleHash,
            resolution: waitResponse,
            success: waitResponse === FlashbotsBundleResolution.BundleIncluded,
            targetBlock: targetBlockNumber
        };
        
        if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`🎉 SUCCESS: Bundle included in block ${targetBlockNumber}!`);
        } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`⚠️  Bundle not included in block ${targetBlockNumber} - block passed`);
        } else if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.log(`❌ Bundle failed: Account nonce too high`);
        } else {
            console.log(`❓ Unexpected bundle resolution: ${waitResponse}`);
        }
        
        return result;
        
    } catch (error: unknown) {
        console.log("❌ Failed to submit bundle to Flashbots!");
        if (error instanceof Error) {
            console.log(`   Error: ${error.message}`);
        } else {
            console.log(`   Error: ${String(error)}`);
        }
        throw error;
    }
}