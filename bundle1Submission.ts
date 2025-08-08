import {
    simulate,
    useFlashBots,
    balance,
    compromisedAddress,
    funderAddress,
    erc20TokenAddress,
    ETH_AMOUNT_TO_FUND,
    tip,
    baseGasPrice,
    flashbotsProvider,
    normalProvider,
} from "./config";
import { createFundingTrx } from "./src/createFundingTrx";
import { createERC20RecoveryTrx } from "./src/createERC20RecoveryTrx";
import { createWithdrawTrx } from "./src/createWithdrawTrx";
import { signBundle } from "./src/signBundle";
import { simulateBundle } from "./src/simulateBundle";
import { sendBundleToFlashbotsAndMonitor } from "./src/sendBundleToFlashbotsAndMonitor";
import { sendBundleToBeaver } from "./src/sendBundleToBeaver";
import { getTargetBlock } from "./src/getTargetBlock";
import { formatEther, formatUnits } from "ethers";

console.log("🚀 Starting Flashbots Fund Recovery Bot");
console.log("=" .repeat(50));

// Log configuration
console.log("📋 Configuration:");
console.log(`   Mode: ${simulate ? "🧪 SIMULATION" : "⚡ PRODUCTION"}`);
    console.log(`   Builder: 🔥 Flashbots`);
console.log(`   Funder Address: ${funderAddress}`);
console.log(`   Compromised Address: ${compromisedAddress}`);
console.log(`   ERC20 Token: ${erc20TokenAddress}`);
console.log(`   ETH to Fund: ${ETH_AMOUNT_TO_FUND} ETH`);
console.log(`   Base Gas Price: ${formatUnits(baseGasPrice, "gwei")} gwei`);
console.log(`   Priority Fee: ${formatUnits(tip, "gwei")} gwei`);
console.log(`   ERC20 Balance to Recover: ${balance.toString()} tokens`);
console.log("");

console.log("🔨 Creating bundle transactions...");

// Create transactions with detailed logging
console.log("1️⃣ Creating funding transaction...");
const trx1 = createFundingTrx();

console.log("2️⃣ Creating ERC20 recovery transaction...");
const trx2 = createERC20RecoveryTrx(balance);

console.log("3️⃣ Creating ETH withdrawal transaction...");
const trx3 = await createWithdrawTrx();

console.log("✅ All transactions created successfully");
console.log("");

if (simulate) {
    console.log("🔐 Signing bundle...");
    const signedBundle = await signBundle([trx1, trx2, trx3]);
    
    console.log("🧪 Running bundle simulation...");
    await simulateBundle(signedBundle);
} else {
    console.log("🔍 Listening for new blocks...");
    normalProvider.on("block", async (blocknumber) => {
        console.log("⚡ Preparing for production execution...");
        const targetBlockNumber = blocknumber + 1;
        console.log(`🎯 Target block: ${targetBlockNumber}`);
        console.log("");

        console.log("🔐 Signing bundle...");
        const signedBundle = await signBundle([trx1, trx2, trx3]);
        
        console.log("🧪 Running bundle simulation...");
        const simulationResult = await simulateBundle(signedBundle);

        console.log("🔥 Sending bundle to Flashbots...");
        await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
    });
}
