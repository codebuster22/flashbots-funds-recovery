import { parseUnits, formatUnits } from 'ethers';
import { AlertLogger } from './monitoring/alertLogger';
import { GasMode, TransactionType, GasConfiguration } from './monitoring/safe/safeApiTypes';
import { 
    baseGasPrice as configBaseGasPrice, 
    tip as configTip 
} from '../config';

export class GasController {
    private currentMode: GasMode = 'normal';
    private aggressiveMultiplier: number = 2.0;
    private emergencyMultiplier: number = 2.5;

    constructor(
        aggressiveMultiplier: number = 2.0,
        emergencyMultiplier: number = 2.5
    ) {
        this.aggressiveMultiplier = aggressiveMultiplier;
        this.emergencyMultiplier = emergencyMultiplier;
    }

    setMode(mode: GasMode): void {
        if (this.currentMode !== mode) {
            const oldMode = this.currentMode;
            this.currentMode = mode;
            
            AlertLogger.logInfo(`🔥 Gas Mode Changed: ${oldMode.toUpperCase()} → ${mode.toUpperCase()}`);
            
            if (mode === 'aggressive') {
                AlertLogger.logInfo(`⚡ Aggressive Mode: ${this.aggressiveMultiplier}x gas multiplier activated`);
            } else {
                AlertLogger.logInfo('🔄 Normal Mode: Standard gas pricing restored');
            }
        }
    }

    getCurrentMode(): GasMode {
        return this.currentMode;
    }

    calculateGas(transactionType: TransactionType): GasConfiguration {
        let multiplier = 1.0;

        // Determine multiplier based on mode and transaction type
        switch (this.currentMode) {
            case 'aggressive':
                multiplier = transactionType === 'emergency' ? 
                    this.emergencyMultiplier : 
                    this.aggressiveMultiplier;
                break;
            case 'normal':
                multiplier = transactionType === 'emergency' ? 1.25 : 1.0;
                break;
        }

        // Calculate gas prices with multiplier
        const enhancedBaseGasPrice = this.multiplyGasPrice(configBaseGasPrice, multiplier);
        const enhancedTip = this.multiplyGasPrice(configTip, multiplier);
        
        const maxFeePerGas = enhancedBaseGasPrice * 3n + enhancedTip;
        const maxPriorityFeePerGas = enhancedTip;

        const config: GasConfiguration = {
            mode: this.currentMode,
            multiplier,
            maxFeePerGas,
            maxPriorityFeePerGas
        };

        // Log gas configuration
        this.logGasConfiguration(transactionType, config);

        return config;
    }

    private multiplyGasPrice(originalPrice: bigint, multiplier: number): bigint {
        const multipliedValue = Number(originalPrice) * multiplier;
        return BigInt(Math.floor(multipliedValue));
    }

    private logGasConfiguration(transactionType: TransactionType, config: GasConfiguration): void {
        AlertLogger.logInfo(`⛽ Gas Configuration (${transactionType.toUpperCase()}):`);
        AlertLogger.logInfo(`   Mode: ${config.mode.toUpperCase()}`);
        AlertLogger.logInfo(`   Multiplier: ${config.multiplier}x`);
        AlertLogger.logInfo(`   Max Fee: ${formatUnits(config.maxFeePerGas, 'gwei')} gwei`);
        AlertLogger.logInfo(`   Priority Fee: ${formatUnits(config.maxPriorityFeePerGas, 'gwei')} gwei`);
    }

    // Get gas for Bundle1 (continuous submission)
    getBundle1Gas(): GasConfiguration {
        return this.calculateGas('bundle1');
    }

    // Get gas for Bundle2 (upgrade-triggered)
    getBundle2Gas(): GasConfiguration {
        return this.calculateGas('bundle2');
    }

    // Get gas for emergency replacement
    getEmergencyGas(): GasConfiguration {
        return this.calculateGas('emergency');
    }

    // Compare gas prices
    isHigherGasThan(ourConfig: GasConfiguration, theirMaxFee: bigint, theirPriority: bigint): boolean {
        const ourTotal = ourConfig.maxFeePerGas;
        const theirTotal = theirMaxFee;
        
        return ourTotal > theirTotal;
    }

    // Calculate competitive gas against another transaction
    calculateCompetitiveGas(
        hackerMaxFee: bigint, 
        hackerPriority: bigint,
        competitiveMultiplier: number = 1.25
    ): GasConfiguration {
        const baseMultiplier = this.currentMode === 'aggressive' ? this.aggressiveMultiplier : 1.0;
        const totalMultiplier = baseMultiplier * competitiveMultiplier;

        const competitiveMaxFee = this.multiplyGasPrice(hackerMaxFee, totalMultiplier);
        const competitivePriority = this.multiplyGasPrice(hackerPriority, totalMultiplier);

        AlertLogger.logInfo(`💰 Competitive Gas Calculation:`);
        AlertLogger.logInfo(`   Base Mode: ${this.currentMode} (${baseMultiplier}x)`);
        AlertLogger.logInfo(`   Competitive Multiplier: ${competitiveMultiplier}x`);
        AlertLogger.logInfo(`   Total Multiplier: ${totalMultiplier}x`);
        AlertLogger.logInfo(`   Hacker: ${formatUnits(hackerMaxFee, 'gwei')} gwei`);
        AlertLogger.logInfo(`   Ours: ${formatUnits(competitiveMaxFee, 'gwei')} gwei`);

        return {
            mode: this.currentMode,
            multiplier: totalMultiplier,
            maxFeePerGas: competitiveMaxFee,
            maxPriorityFeePerGas: competitivePriority
        };
    }

    // Get current multipliers for external use
    getMultipliers(): {
        current: number;
        aggressive: number;
        emergency: number;
    } {
        return {
            current: this.currentMode === 'aggressive' ? this.aggressiveMultiplier : 1.0,
            aggressive: this.aggressiveMultiplier,
            emergency: this.emergencyMultiplier
        };
    }

    // Update multipliers
    updateMultipliers(aggressive: number, emergency: number): void {
        this.aggressiveMultiplier = aggressive;
        this.emergencyMultiplier = emergency;
        
        AlertLogger.logInfo(`🔧 Gas multipliers updated:`);
        AlertLogger.logInfo(`   Aggressive: ${aggressive}x`);
        AlertLogger.logInfo(`   Emergency: ${emergency}x`);
    }

    // Get status information
    getStatus(): {
        mode: GasMode;
        multipliers: {
            current: number;
            aggressive: number;
            emergency: number;
        };
        currentGas: {
            bundle1: GasConfiguration;
            bundle2: GasConfiguration;
            emergency: GasConfiguration;
        };
    } {
        return {
            mode: this.currentMode,
            multipliers: this.getMultipliers(),
            currentGas: {
                bundle1: this.getBundle1Gas(),
                bundle2: this.getBundle2Gas(),
                emergency: this.getEmergencyGas()
            }
        };
    }
}