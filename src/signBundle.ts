import { BundleItemInput, TransactionEntry } from "./types";
import { flashbotsProvider } from "../config";

export const signBundle = async (items: BundleItemInput[]) => {
    console.log("🔐 Signing bundle transactions...");
    console.log(`   📝 Items to process: ${items.length}`);
    
    try {
        const signedBundle = await flashbotsProvider.signBundle(items as any);
        
        console.log("✅ Bundle signed successfully!");
        console.log(`   📦 Signed transactions: ${signedBundle.length}`);
        
        // Log each signed transaction hash for tracking
        signedBundle.forEach((tx: string, index: number) => {
            const txHash = tx.slice(0, 10) + "..." + tx.slice(-8);
            console.log(`   Transaction ${index + 1}: ${txHash}`);
        });
        
        return signedBundle;
        
    } catch (error: any) {
        console.log("❌ Failed to sign bundle!");
        console.log(`   Error: ${error.message}`);
        throw error;
    }
}