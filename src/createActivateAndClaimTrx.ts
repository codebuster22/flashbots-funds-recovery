import { formatUnits, formatEther } from "ethers";
import { TransactionEntry } from "./types";
import { wlfiContract, erc20TokenAddress, compromisedAuthSigner, compromisedAddress, chainId, activateAccountSignature } from "../config";
import { getGasInfo } from "./gasController";

export const createActivateAndClaimTrx = (): TransactionEntry => {
    console.log("   🪙 Creating Activate and Claim transaction...");
    
    const { maxFeePerGas, maxPriorityFeePerGas } = getGasInfo(); // 1.0x multiplier for Bundle1
    const transactionData = wlfiContract.interface.encodeFunctionData(
        "activateAccountAndClaimVest",
        [activateAccountSignature]
    );
    
    const gasLimit = 100000n;
    const estimatedGasCost = maxFeePerGas * gasLimit;
    
    console.log(`   📊 Transaction Details:`);
    console.log(`      From: ${compromisedAddress}`);
    console.log(`      To: ${erc20TokenAddress} (WLFI Contract)`);
    console.log(`      Function: activateAccountAndClaimVest(${activateAccountSignature})`);
    console.log(`      Gas Limit: ${gasLimit.toLocaleString()}`);
    console.log(`      Max Fee: ${formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`      Priority Fee: ${formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
    console.log(`      Est. Gas Cost: ${formatEther(estimatedGasCost)} ETH`);
    console.log(`      Purpose: Activate and claim vested WLFI tokens`);
    
    const recoveryTrx = {
        chainId: chainId,
        type: 2,
        value: 0,
        to: erc20TokenAddress,
        data: transactionData,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: gasLimit
    }
    
    const trx = {
        signer: compromisedAuthSigner,
        transaction: recoveryTrx
    }

    console.log(`   ✅ Activate and claim transaction created successfully`);
    return trx;
}
