import {
    simulate,
    useFlashBots,
    balance,
    compromisedAddress,
    funderAddress,
    erc20TokenAddress,
    ETH_AMOUNT_TO_FUND,
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
import { formatEther, formatUnits } from "ethers";
import { updateGasConfig } from "./src/gasController";
import { createActivateTrx } from "./src/createActivateTrx";

console.log("🚀 Starting Flashbots Activate account Recovery Bot");
console.log("This bot will only activate account, that is transfer the WLFI tokens into lockbox. Claim will happen on 1st September 2025.")
console.log("=" .repeat(50));

// Log configuration
console.log("📋 Configuration:");
console.log(`   Mode: ${simulate ? "🧪 SIMULATION" : "⚡ PRODUCTION"}`);
    console.log(`   Builder: 🔥 Flashbots`);
console.log(`   Funder Address: ${funderAddress}`);
console.log(`   Compromised Address: ${compromisedAddress}`);
console.log(`   ERC20 Token: ${erc20TokenAddress}`);
console.log(`   ETH to Fund: ${ETH_AMOUNT_TO_FUND} ETH`);
// Gas price info moved to individual transaction creation functions
console.log(`   $WLFI amount to be sent to lockbox vesting contract: ${balance.toString()} tokens`);
console.log("");

console.log("🔨 Creating bundle transactions...");

// Create transactions with detailed logging
console.log("1️⃣ Creating funding transaction...");
const trx1 = createFundingTrx();

console.log("2️⃣ Creating Activate account transaction...");
const trx2 = createActivateTrx();

console.log("3️⃣ Creating ETH withdrawal transaction...");
const trx3 = await createWithdrawTrx();

console.log("✅ All transactions created successfully");
console.log("");

if (simulate) {
    console.log("🔐 Signing bundle...");
    let signedBundle: any;
    if (trx3.shouldInclude) {
        signedBundle = await signBundle([trx1, trx2, trx3.transaction!]);
    } else {
        signedBundle = await signBundle([trx1, trx2]);
    }
    
    console.log("🧪 Running bundle simulation...");
    await simulateBundle(signedBundle);
} else {
    console.log("🔍 Listening for new blocks...");
    normalProvider.on("block", async (blocknumber) => {
        console.log("⚡ Preparing for production execution...");
        const targetBlockNumber = blocknumber + 1;
        console.log(`🎯 Target block: ${targetBlockNumber}`);
        console.log("");

        const feeData = await normalProvider.getFeeData();

        updateGasConfig(feeData);

        console.log("🔐 Signing bundle...");
        let signedBundle: any;
        if (trx3.shouldInclude) {
            signedBundle = await signBundle([trx1, trx2, trx3.transaction!]);
        } else {
            signedBundle = await signBundle([trx1, trx2]);
        }
        
        console.log("🧪 Running bundle simulation...");
        const simulationResult = await simulateBundle(signedBundle);

        if (simulationResult) {
            console.log("🔥 Simulation success, sending bundle to Flashbots...");
        } else {
            console.log("🚨 Simulation failed, skipping...");
            return;
        }

        console.log("🔥 Sending bundle to Flashbots...");
        await sendBundleToFlashbotsAndMonitor(signedBundle, targetBlockNumber);
    });
}
