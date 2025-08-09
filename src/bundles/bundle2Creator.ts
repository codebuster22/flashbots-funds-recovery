import { TransactionEntry } from '../types';
import { AlertLogger } from '../monitoring/alertLogger';
import {
    compromisedAuthSigner,
    funderAuthSigner,
    erc20TokenAddress,
    ETH_AMOUNT_TO_FUND,
    balance,
    normalProvider
} from '../../config';
import { createFundingTrx } from '../createFundingTrx';
import { createERC20RecoveryTrx } from '../createERC20RecoveryTrx';
import { createWithdrawTrx, WithdrawTrxResult } from '../createWithdrawTrx';

export class Bundle2Creator {

    static async createBundle2WithUpgradeRaw(upgradeRawSignedHex: string): Promise<({ signedTransaction: string } | TransactionEntry)[]> {
        AlertLogger.logInfo('🔨 Creating Bundle2 with upgrade transaction (raw signed hex)...');

        // Create our recovery transactions
        AlertLogger.logInfo('Creating funding transaction...');
        const fundingTx = createFundingTrx();

        AlertLogger.logInfo('Creating ERC20 recovery transaction...');
        const recoveryTx = createERC20RecoveryTrx(balance);

        AlertLogger.logInfo('Creating withdrawal transaction...');
        const withdrawResult = await createWithdrawTrx();

        const bundle2: ({ signedTransaction: string } | TransactionEntry)[] = [
            { signedTransaction: upgradeRawSignedHex }, // First: Safe exec upgrade (raw signed hex)
            fundingTx,           // Second: Fund compromised wallet
            recoveryTx,          // Third: Transfer tokens out
        ];

        if (withdrawResult.shouldInclude) {
            bundle2.push(withdrawResult.transaction!); // Fourth: Return remaining ETH
            AlertLogger.logInfo(`✅ Bundle2 created with ${bundle2.length} transactions`);
            AlertLogger.logInfo('Transaction order: Upgrade → Fund → Recover → Withdraw');
        } else {
            AlertLogger.logInfo(`⚠️ Bundle2 created with ${bundle2.length} transactions (withdrawal excluded: ${withdrawResult.reason})`);
            AlertLogger.logInfo('Transaction order: Upgrade → Fund → Recover');
        }

        return bundle2;
    }
    
    static async createAlternativeBundle2(): Promise<TransactionEntry[]> {
        AlertLogger.logInfo('🔄 Creating alternative Bundle2 (without upgrade transaction)...');
        AlertLogger.logInfo('This bundle assumes tokens are already unlocked');
        
        try {
            const fundingTx = createFundingTrx();
            const recoveryTx = createERC20RecoveryTrx(balance);
            const withdrawResult = await createWithdrawTrx();
            
            const bundle = [fundingTx, recoveryTx];
            if (withdrawResult.shouldInclude) {
                bundle.push(withdrawResult.transaction!);
                AlertLogger.logInfo(`✅ Alternative Bundle2 created with ${bundle.length} transactions (including withdrawal)`);
            } else {
                AlertLogger.logInfo(`⚠️ Alternative Bundle2 created with ${bundle.length} transactions (withdrawal excluded: ${withdrawResult.reason})`);
            }
            
            return bundle;
            
        } catch (error) {
            AlertLogger.logError('Failed to create alternative Bundle2', error as Error);
            throw error;
        }
    }
}