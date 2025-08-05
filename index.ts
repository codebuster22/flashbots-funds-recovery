import { ethers, parseUnits } from "ethers";
import { FlashbotsBundleProvider, FlashbotsTransaction, FlashbotsTransactionResponse } from "@flashbots/ethers-provider-bundle";
import { erc20Abi } from "./erc20Abi";
import dotenv from "dotenv";
import type { TransactionRequest } from "ethers";

dotenv.config();

const normalRpc = process.env.NORMAL_RPC;
const ETH_AMOUNT_TO_FUND = process.env.ETH_AMOUNT_TO_FUND || "0.001";
const baseGasPrice = parseUnits(process.env.BASE_GAS_PRICE as string, "gwei") || parseUnits("4", "gwei");
const tip = parseUnits(process.env.TIP_IN_GWEI as string, "gwei") || parseUnits("4", "gwei");
const flashbotsRpc = process.env.FLASHBOTS_RPC;
const funderKey = process.env.FUNDER_PRIVATE_KEY;
const compromisedKey = process.env.COMPROMISED_PRIVATE_KEY;
const erc20TokenAddress = process.env.ERC20_TOKEN_ADDRESS;
const simulate = process.env.SIMULATE === "true";

if (!funderKey || !compromisedKey) {
    throw new Error("FUNDER_PRIVATE_KEY and COMPROMISED_PRIVATE_KEY must be set");
}

if (!erc20TokenAddress) {
    throw new Error("ERC20_TOKEN_ADDRESS must be set");
}

const normalProvider = new ethers.JsonRpcProvider(normalRpc);

const funderAuthSigner = new ethers.Wallet(funderKey, normalProvider);
const compromisedAuthSigner = new ethers.Wallet(compromisedKey, normalProvider);

const erc20Contract = new ethers.Contract(erc20TokenAddress, erc20Abi, normalProvider);

const compromisedAddress = compromisedAuthSigner.address;
const funderAddress = funderAuthSigner.address;
// check balance
const balance = await erc20Contract.balanceOf(compromisedAddress);

const flashbotsProvider = await FlashbotsBundleProvider.create(
    normalProvider,
    funderAuthSigner
);

// Get nonces for each signer
const funderNonce = await normalProvider.getTransactionCount(funderAddress);
const compromisedNonce = await normalProvider.getTransactionCount(compromisedAddress);

// trx 1: fund ETH to compromised address
// Get current gas price and multiply by 3 for all transactions
const maxFeePerGas = baseGasPrice * 3n + tip;
const maxPriorityFeePerGas = tip;

const ethAmountToSend = parseUnits(ETH_AMOUNT_TO_FUND, "ether"); // Set X value in ETH here

const fundEthPopulatedTx = await funderAuthSigner.populateTransaction({
    to: compromisedAddress,
    value: ethAmountToSend,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    chainId: 1,
    nonce: funderNonce,
    type: 2
});
delete fundEthPopulatedTx.gasPrice;

console.log(`Sending ${ethAmountToSend} ETH to compromised address`);

const trx1 = {
    signer: funderAuthSigner,
    transaction: fundEthPopulatedTx
}

// trx 2: send ERC20 to compromised address

const populatedTransaction = await erc20Contract.transfer?.populateTransaction(
    compromisedAddress,
    balance,
    { maxFeePerGas: maxFeePerGas, maxPriorityFeePerGas: maxPriorityFeePerGas, chainId: 1, nonce: compromisedNonce, type: 2 }
) as TransactionRequest;
delete populatedTransaction.gasPrice;

console.log(populatedTransaction);

console.log(`Sending ${balance} ERC20 tokens (${erc20TokenAddress}) to funder address from compromised address`);

const trx2 = {
    signer: compromisedAuthSigner,
    transaction: populatedTransaction
}

// trx 3: send remaining ETH back to funder address
const compromisedEthBalance = await normalProvider.getBalance(compromisedAddress);

// Estimate gas for sending ETH back to funder
const gasLimit = 21000n; // Standard ETH transfer

// Calculate max amount to send (subtract gas cost)
const maxEthToSendBack = compromisedEthBalance - (maxFeePerGas * gasLimit);

const sendEthBackPopulatedTx = await compromisedAuthSigner.populateTransaction({
    to: funderAddress,
    value: maxEthToSendBack,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    chainId: 1,
    nonce: compromisedNonce + 1,  // Increment nonce for second transaction from compromised address
    type: 2
});
delete sendEthBackPopulatedTx.gasPrice;

console.log(`Sending ${maxEthToSendBack} ETH back to funder address`);

const trx3 = {
    signer: compromisedAuthSigner,
    transaction: sendEthBackPopulatedTx
}

const signedBundle = await flashbotsProvider.signBundle([
    trx1,
    trx2,
    // trx3
  ]);

if (simulate) {
    const simulation = await flashbotsProvider.simulate(signedBundle, "latest");
    console.log(simulation);
} else {
    // keep the bundle valid for next 50 blocks
    const currentBlockNumber = await normalProvider.getBlockNumber();
    const targetBlockNumber = currentBlockNumber + 50;

    console.log("Sending bundle...");
    
    const bundleReceipt = await flashbotsProvider.sendRawBundle(
        signedBundle, // bundle we signed above
        targetBlockNumber
    ) as FlashbotsTransactionResponse; // bundle is valid for the next 50 blocks
    
    console.log("Bundle sent successfully");
    console.log(bundleReceipt.bundleHash);

    console.log("monitoring bundle status...");
    
    // Monitor bundle stats
    let included = false;
    let checkCount = 0;
    const maxChecks = 100; // Check for up to 100 blocks (~20 minutes)
    
    while (!included && checkCount < maxChecks) {
        try {
            await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds (1 block)
            checkCount++;
            
            const bundleStats = await flashbotsProvider.getBundleStats(
                bundleReceipt.bundleHash,
                targetBlockNumber
            );
            
            console.log(`Check ${checkCount}: Bundle stats:`, bundleStats);
            
            // Check if bundle was included
            if (bundleStats && bundleStats.isSimulated && bundleStats.isSentToMiners) {
                console.log("Bundle was simulated and sent to miners");
                
                // Try to wait for resolution with shorter timeout
                try {
                    const resolution = await Promise.race([
                        bundleReceipt.wait(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Continue monitoring")), 5000))
                    ]);
                    
                    if (resolution === 0) {
                        console.log("Bundle included in a block!");
                        included = true;
                        break;
                    } else if (resolution === 1) {
                        console.log("Blocks passed without inclusion");
                    } else if (resolution === 2) {
                        console.log("Account nonce too high");
                        break;
                    }
                } catch (e) {
                    // Continue monitoring
                }
            }
            
        } catch (error) {
            console.log(`Error checking bundle stats: ${error.message}`);
        }
    }
    
    if (!included && checkCount >= maxChecks) {
        console.log("Stopped monitoring after maximum checks. Bundle may still be pending.");
    }

}
