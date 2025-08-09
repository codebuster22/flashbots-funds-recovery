import { FlashbotsTransactionResponse, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { flashbotsProvider } from "../config";

interface BundleSubmissionResult {
    bundleHash: string;
    resolution: FlashbotsBundleResolution;
    success: boolean;
    targetBlock: number;
}

export const sendBundleToFlashbotsAndMonitor = async (signedBundle: Array<string>, targetBlockNumber: number): Promise<BundleSubmissionResult> => {
    console.log(`📡 Submitting bundle to Flashbots...`);
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
        
        console.log(`✅ Bundle submitted successfully! (${signedBundle.length} trx)`);
        console.log(`   🔗 Bundle Hash: ${bundleReceipt.bundleHash}`);
        console.log(`   ⏱️  Valid until block: ${targetBlockNumber}`);
        console.log("");

        console.log(`⏳ Waiting for bundle inclusion (${signedBundle.length} trx) in block ${targetBlockNumber}...`);
        
        // Wait for response
        const waitResponse = await bundleReceipt.wait();
        console.log(`📊 Bundle Resolution (${signedBundle.length} trx): ${waitResponse}`);
        
        const result: BundleSubmissionResult = {
            bundleHash: bundleReceipt.bundleHash,
            resolution: waitResponse,
            success: waitResponse === FlashbotsBundleResolution.BundleIncluded,
            targetBlock: targetBlockNumber
        };
        
        if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`🎉 SUCCESS: Bundle (${signedBundle.length} trx) included in block ${targetBlockNumber}!`);
        } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`⚠️  Bundle (${signedBundle.length} trx) not included in block ${targetBlockNumber} - block passed`);
            const stats = await flashbotsProvider.getBundleStats(bundleReceipt.bundleHash, targetBlockNumber);
            console.log(`   Stats: ${JSON.stringify(stats, null, 2)}`);
        } else {
            console.log(`❓ Unexpected bundle resolution (${signedBundle.length} trx): ${waitResponse}`);
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