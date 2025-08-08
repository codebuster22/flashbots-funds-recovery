import { formatEther, formatUnits, parseUnits } from "ethers";
import { TransactionEntry } from "./types";
import { normalProvider, compromisedAddress, funderAddress, maxFeePerGas, maxPriorityFeePerGas, compromisedAuthSigner, ETH_AMOUNT_TO_FUND, chainId } from "../config";

export const createWithdrawTrx = async (amount?: bigint): Promise<TransactionEntry> => {
    console.log("   💸 Creating ETH withdrawal transaction...");
    
    let currentBalance = amount;
    if (!currentBalance || currentBalance == undefined) {
        console.log("   📊 Checking compromised wallet balance...");
        currentBalance = await normalProvider.getBalance(compromisedAddress);
        console.log(`   💰 Current balance: ${formatEther(currentBalance)} ETH`);
    }
    
    const gasLimit = 50000n;
    const estimatedGasCost = maxFeePerGas * gasLimit;
    const fundedAmount = parseUnits(ETH_AMOUNT_TO_FUND, "ether");
    
    // Calculate max amount to send back (funded amount + original balance - gas costs for this tx and ERC20 tx)
    const erc20GasCost = maxFeePerGas * 100000n; // ERC20 transfer gas cost
    const totalGasCosts = estimatedGasCost + erc20GasCost;
    const maxEthToSendBack = fundedAmount + currentBalance - totalGasCosts;
    
    console.log(`   📊 Transaction Details:`);
    console.log(`      From: ${compromisedAddress}`);
    console.log(`      To: ${funderAddress}`);
    console.log(`      Original Balance: ${formatEther(currentBalance)} ETH`);
    console.log(`      Funded Amount: ${formatEther(fundedAmount)} ETH`);
    console.log(`      Total Available: ${formatEther(fundedAmount + currentBalance)} ETH`);
    console.log(`      Gas Cost (This TX): ${formatEther(estimatedGasCost)} ETH`);
    console.log(`      Gas Cost (ERC20 TX): ${formatEther(erc20GasCost)} ETH`);
    console.log(`      Total Gas Costs: ${formatEther(totalGasCosts)} ETH`);
    console.log(`      Amount to Return: ${formatEther(maxEthToSendBack)} ETH`);
    console.log(`      Gas Limit: ${gasLimit.toLocaleString()}`);
    console.log(`      Max Fee: ${formatUnits(maxFeePerGas, "gwei")} gwei`);
    console.log(`      Priority Fee: ${formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
    console.log(`      Purpose: Return remaining ETH to funder`);
    
    if (maxEthToSendBack <= 0n) {
        console.log(`   ⚠️  WARNING: Calculated return amount is ${formatEther(maxEthToSendBack)} ETH`);
        console.log(`   ⚠️  This might indicate insufficient funds for gas costs`);
    }
    
    const withdrawTrxData = {
        to: funderAddress,
        value: maxEthToSendBack,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        chainId: chainId,
        type: 2,
        gasLimit: gasLimit
    }
    
    const trx3 = {
        signer: compromisedAuthSigner,
        transaction: withdrawTrxData
    }

    console.log(`   ✅ ETH withdrawal transaction created successfully`);
    return trx3;
}
