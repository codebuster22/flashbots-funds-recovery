import { FlashbotsTransactionResponse, FlashbotsBundleResolution } from "@flashbots/ethers-provider-bundle";
import { flashbotsProvider } from "../config";

export const sendBundleToFlashbotsAndMonitor = async (signedBundle: Array<string>, targetBlockNumber: number) => {
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
            process.exit(1);
        }
        
        console.log("✅ Bundle submitted successfully!");
        console.log(`   🔗 Bundle Hash: ${bundleReceipt.bundleHash}`);
        console.log(`   ⏱️  Valid until block: ${targetBlockNumber}`);
        console.log("");

        console.log(`Bundle sent, waiting for inclusion in block ${targetBlockNumber}`);
        
        // Wait for response
        const waitResponse = await bundleReceipt.wait();
        console.log("Resolution:", waitResponse);
        
        if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`Success: Bundle included in block ${targetBlockNumber}`, waitResponse);
            process.exit(0);
        } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`Warning: Bundle not included in block ${targetBlockNumber}`, waitResponse);
        } else if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.error("Error: Nonce too high, exiting", waitResponse);
            process.exit(1);
        } else {
            console.error(`Unexpected waitResponse: ${waitResponse}`, waitResponse);
        }
        
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