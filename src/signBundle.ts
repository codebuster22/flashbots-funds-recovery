import { TransactionEntry } from "./types";
import { flashbotsProvider } from "../config";

export const signBundle = async (trxs: TransactionEntry[]) => {
    console.log("🔐 Signing bundle transactions...");
    console.log(`   📝 Transactions to sign: ${trxs.length}`);
    
    try {
        const signedBundle = await flashbotsProvider.signBundle(trxs);
        
        console.log("✅ Bundle signed successfully!");
        console.log(`   📦 Signed transactions: ${signedBundle.length}`);
        
        // Log each signed transaction hash for tracking
        signedBundle.forEach((tx, index) => {
            const txHash = tx.slice(0, 10) + "..." + tx.slice(-8);
            console.log(`   Transaction ${index + 1}: ${txHash}`);
        });
        
        return signedBundle;
        
    } catch (error) {
        console.log("❌ Failed to sign bundle!");
        console.log(`   Error: ${error.message}`);
        throw error;
    }
}