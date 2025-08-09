import { parseUnits, formatEther, formatUnits } from "ethers";
import { TransactionEntry } from "./types";
import { compromisedAddress, ETH_AMOUNT_TO_FUND, funderAuthSigner, funderAddress, chainId } from "../config";
import { getGasInfo } from "./gasController";

export const createFundingTrx = (): TransactionEntry => {
    console.log("   💰 Creating funding transaction...");
    
    const { maxFeePerGas, maxPriorityFeePerGas } = getGasInfo(); // 1.0x multiplier for Bundle1
    const ethAmountToSend = parseUnits(ETH_AMOUNT_TO_FUND, "ether");
    const gasLimit = 21000n;
    const estimatedGasCost = maxFeePerGas * gasLimit;
    
    console.log(`   📊 Transaction Details:`);
    console.log(`      From: ${funderAddress}`);
    console.log(`      To: ${compromisedAddress}`);
    console.log(`      Amount: ${formatEther(ethAmountToSend)} ETH`);
    console.log(`      Gas Limit: ${gasLimit.toLocaleString()}`);
    console.log(`      Max Fee: ${formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`      Priority Fee: ${formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
    console.log(`      Est. Gas Cost: ${formatEther(estimatedGasCost)} ETH`);
    console.log(`      Purpose: Fund compromised wallet for gas fees`);
    
    const fundEthPopulatedTx = {
        to: compromisedAddress,
        value: ethAmountToSend,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        chainId: chainId,
        type: 2,
        gasLimit: gasLimit
    };
    
    const trx1 = {
        signer: funderAuthSigner,
        transaction: fundEthPopulatedTx
    }

    console.log(`   ✅ Funding transaction created successfully`);
    return trx1;
}