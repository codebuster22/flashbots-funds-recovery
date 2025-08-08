import { TransactionEntry } from '../types';
import { AlertLogger } from '../monitoring/alertLogger';
import {
    compromisedAuthSigner,
    funderAuthSigner,
    erc20TokenAddress,
    ETH_AMOUNT_TO_FUND,
    maxFeePerGas,
    maxPriorityFeePerGas,
    balance,
    normalProvider
} from '../../config';
import { createFundingTrx } from '../createFundingTrx';
import { createERC20RecoveryTrx } from '../createERC20RecoveryTrx';
import { createWithdrawTrx } from '../createWithdrawTrx';

export class Bundle2Creator {
    
    static async createBundle2WithUpgrade(upgradeTransactionHex: string): Promise<TransactionEntry[]> {
        AlertLogger.logInfo('🔨 Creating Bundle2 with upgrade transaction...');
        
        try {
            // Parse the upgrade transaction from hex
            const upgradeTransaction = await this.parseUpgradeTransaction(upgradeTransactionHex);
            
            // Create our recovery transactions
            AlertLogger.logInfo('Creating funding transaction...');
            const fundingTx = createFundingTrx();
            
            AlertLogger.logInfo('Creating ERC20 recovery transaction...');
            const recoveryTx = createERC20RecoveryTrx(balance);
            
            AlertLogger.logInfo('Creating withdrawal transaction...');
            const withdrawTx = await createWithdrawTrx();
            
            // Create Bundle2 with upgrade transaction first
            const bundle2: TransactionEntry[] = [
                upgradeTransaction,  // First: Enable token transfers
                fundingTx,          // Second: Fund compromised wallet
                recoveryTx,         // Third: Transfer tokens out
                withdrawTx          // Fourth: Return remaining ETH
            ];
            
            AlertLogger.logInfo(`✅ Bundle2 created with ${bundle2.length} transactions`);
            AlertLogger.logInfo('Transaction order: Upgrade → Fund → Recover → Withdraw');
            
            return bundle2;
            
        } catch (error) {
            AlertLogger.logError('Failed to create Bundle2', error as Error);
            throw error;
        }
    }
    
    private static async parseUpgradeTransaction(upgradeTransactionHex: string): Promise<TransactionEntry> {
        try {
            AlertLogger.logInfo('📄 Parsing upgrade transaction from mempool data...');
            
            const txData = JSON.parse(upgradeTransactionHex);
            
            // Get current nonce for the upgrade transaction sender
            const upgradeNonce = await normalProvider.getTransactionCount(txData.from);
            
            const upgradeTransaction: TransactionEntry = {
                signer: funderAuthSigner, // We can't sign for the original sender, this is a limitation
                transaction: {
                    chainId: txData.chainId || 1,
                    type: txData.type || 2,
                    value: BigInt(txData.value || '0'),
                    to: txData.to,
                    data: txData.data,
                    maxFeePerGas: BigInt(txData.maxFeePerGas || maxFeePerGas.toString()),
                    maxPriorityFeePerGas: BigInt(txData.maxPriorityFeePerGas || maxPriorityFeePerGas.toString()),
                    gasLimit: BigInt(txData.gasLimit || '200000') // Default gas limit for proxy upgrades
                }
            };
            
            AlertLogger.logInfo('⚠️  WARNING: Upgrade transaction parsing completed');
            AlertLogger.logInfo('⚠️  NOTE: Original upgrade transaction cannot be directly included');
            AlertLogger.logInfo('⚠️  This is a template - actual implementation requires different approach');
            
            return upgradeTransaction;
            
        } catch (error) {
            throw new Error(`Failed to parse upgrade transaction: ${error}`);
        }
    }
    
    static async createAlternativeBundle2(): Promise<TransactionEntry[]> {
        AlertLogger.logInfo('🔄 Creating alternative Bundle2 (without upgrade transaction)...');
        AlertLogger.logInfo('This bundle assumes tokens are already unlocked');
        
        try {
            const fundingTx = createFundingTrx();
            const recoveryTx = createERC20RecoveryTrx(balance);
            const withdrawTx = await createWithdrawTrx();
            
            return [fundingTx, recoveryTx, withdrawTx];
            
        } catch (error) {
            AlertLogger.logError('Failed to create alternative Bundle2', error as Error);
            throw error;
        }
    }
}