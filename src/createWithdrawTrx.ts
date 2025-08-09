import { formatEther, formatUnits, parseUnits } from "ethers";
import { TransactionEntry } from "./types";
import { normalProvider, compromisedAddress, funderAddress, compromisedAuthSigner, ETH_AMOUNT_TO_FUND, chainId } from "../config";
import { getGasInfo } from "./gasController";

export interface WithdrawTrxResult {
    transaction: TransactionEntry | null;
    shouldInclude: boolean;
    calculatedAmount: bigint;
    reason?: string;
}

export const createWithdrawTrx = async (amount?: bigint): Promise<WithdrawTrxResult> => {
    console.log("   💸 Creating ETH withdrawal transaction...");
    
    let currentBalance = amount;
    if (!currentBalance || currentBalance == undefined) {
        console.log("   📊 Checking compromised wallet balance...");
        currentBalance = await normalProvider.getBalance(compromisedAddress);
        console.log(`   💰 Current balance: ${formatEther(currentBalance)} ETH`);
    }
    
    const { maxFeePerGas, maxPriorityFeePerGas } = getGasInfo(); // 1.0x multiplier for Bundle1
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
        console.log(`   ⚠️  This indicates insufficient funds for gas costs - excluding withdrawal transaction`);
        console.log(`   🚫 Withdrawal transaction will be excluded from bundle`);
        
        return {
            transaction: null,
            shouldInclude: false,
            calculatedAmount: maxEthToSendBack,
            reason: `Insufficient funds: calculated amount ${formatEther(maxEthToSendBack)} ETH <= 0`
        };
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
    return {
        transaction: trx3,
        shouldInclude: true,
        calculatedAmount: maxEthToSendBack,
        reason: undefined
    };
}
