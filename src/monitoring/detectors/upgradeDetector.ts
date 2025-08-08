import { Interface } from 'ethers';

export class UpgradeDetector {
    private static readonly UPGRADE_SIGNATURES = new Set([
        '0x3659cfe6', // upgradeTo(address)
        '0x4f1ef286', // upgradeToAndCall(address,bytes)  
        '0x52d1902d', // proxiableUUID()
        '0x8f283970', // changeAdmin(address)
        '0xf851a440', // admin()
        '0x5c60da1b', // implementation()
    ]);

    private static readonly UPGRADE_FUNCTION_NAMES = new Set([
        'upgradeTo',
        'upgradeToAndCall',
        'upgrade',
        'updateImplementation',
        'setImplementation',
        'changeAdmin',
    ]);

    static isUpgradeTransaction(to: string, data: string, proxyAddress: string, adminAddress?: string): boolean {
        if (!to || !data || data.length < 10) {
            return false;
        }

        const toAddress = to.toLowerCase();
        const proxyAddr = proxyAddress.toLowerCase();
        
        // Check if transaction is to the proxy contract
        if (toAddress !== proxyAddr) {
            // Or check if it's to the admin address (for some proxy patterns)
            if (!adminAddress || toAddress !== adminAddress.toLowerCase()) {
                return false;
            }
        }

        const methodSignature = data.slice(0, 10);
        return this.UPGRADE_SIGNATURES.has(methodSignature);
    }

    static extractUpgradeDetails(tx: any, proxyAddress: string): {
        method: string;
        isUpgrade: boolean;
        newImplementation?: string;
    } | null {
        try {
            if (!tx.data || tx.data.length < 10) {
                return null;
            }

            const methodSignature = tx.data.slice(0, 10);
            
            // Basic signature detection
            const upgradeInfo = {
                '0x3659cfe6': 'upgradeTo',
                '0x4f1ef286': 'upgradeToAndCall',
                '0x8f283970': 'changeAdmin',
                '0xf851a440': 'admin',
                '0x5c60da1b': 'implementation',
            }[methodSignature];

            if (upgradeInfo) {
                return {
                    method: upgradeInfo,
                    isUpgrade: true,
                    newImplementation: this.extractImplementationAddress(tx.data, methodSignature)
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    private static extractImplementationAddress(data: string, signature: string): string | undefined {
        try {
            // For upgradeTo and upgradeToAndCall, the first parameter is the new implementation
            if (signature === '0x3659cfe6' || signature === '0x4f1ef286') {
                // Extract first 32 bytes after signature (address is last 20 bytes)
                const addressHex = '0x' + data.slice(34, 74);
                return addressHex;
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    static serializeTransaction(tx: any): string {
        try {
            const serialized = {
                to: tx.to,
                from: tx.from,
                data: tx.data,
                value: tx.value?.toString() || '0',
                gasLimit: tx.gasLimit?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                maxFeePerGas: tx.maxFeePerGas?.toString(),
                maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
                nonce: tx.nonce,
                type: tx.type || 2,
                chainId: tx.chainId || 1
            };

            return JSON.stringify(serialized);
        } catch (error) {
            throw new Error(`Failed to serialize transaction: ${error}`);
        }
    }
}