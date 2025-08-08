import { formatUnits, formatEther } from "ethers";
import { TransactionEntry } from "./types";
import { erc20Contract, balance, funderAddress, erc20TokenAddress, maxFeePerGas, maxPriorityFeePerGas, compromisedAuthSigner, compromisedAddress, chainId } from "../config";

export const createERC20RecoveryTrx = (amount: bigint): TransactionEntry => {
    console.log("   🪙 Creating ERC20 recovery transaction...");
    
    const transactionData = erc20Contract.interface.encodeFunctionData(
        "transfer",
        [funderAddress, balance]
    );
    
    const gasLimit = 100000n;
    const estimatedGasCost = maxFeePerGas * gasLimit;
    
    console.log(`   📊 Transaction Details:`);
    console.log(`      From: ${compromisedAddress}`);
    console.log(`      To: ${erc20TokenAddress} (ERC20 Contract)`);
    console.log(`      Function: transfer(${funderAddress}, ${balance.toString()})`);
    console.log(`      Token Amount: ${balance.toString()} tokens`);
    console.log(`      Gas Limit: ${gasLimit.toLocaleString()}`);
    console.log(`      Max Fee: ${formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`      Priority Fee: ${formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
    console.log(`      Est. Gas Cost: ${formatEther(estimatedGasCost)} ETH`);
    console.log(`      Purpose: Transfer all ERC20 tokens to funder address`);
    
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
    
    const trx2 = {
        signer: compromisedAuthSigner,
        transaction: recoveryTrx
    }

    console.log(`   ✅ ERC20 recovery transaction created successfully`);
    return trx2;
}
