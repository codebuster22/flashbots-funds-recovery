import { FeeData } from 'ethers';
import { 
    baseGasPrice, 
    tip 
} from '../config';

let basePrice = baseGasPrice;
let tipPrice = tip;

export function updateGasConfig(feeData: FeeData) {
    console.log('Updating gas config', feeData);
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        basePrice = feeData.maxFeePerGas * 2n;
        tipPrice = feeData.maxPriorityFeePerGas * 2n;
        return;
    }
    if (feeData.maxFeePerGas) {
        basePrice = feeData.maxFeePerGas * 2n;
        tipPrice = feeData.maxFeePerGas;
        return;
    }
    if (feeData.gasPrice) {
        basePrice = feeData.gasPrice;
        tipPrice = feeData.gasPrice * 50n / 100n;
        return;
    }
}

/**
 * Simple gas price calculation function
 * @param multiplier - Multiplier to apply to base gas prices (default: 1.0)
 * @returns Object with maxFeePerGas and maxPriorityFeePerGas
 */
export function getGasInfo(multiplier: bigint = 1n): {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
} {
    // Apply multiplier to base values
    const adjustedBaseGas = basePrice * multiplier;
    const adjustedTip = tipPrice * multiplier;
    
    return {
        maxFeePerGas: adjustedBaseGas + adjustedTip,        // EIP-1559: base + tip
        maxPriorityFeePerGas: adjustedTip                   // EIP-1559: tip only
    };
}