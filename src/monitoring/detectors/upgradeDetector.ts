import { Interface } from 'ethers';
import { safeAbi } from '../../abi/safeAbi';

export class UpgradeDetector {
    private static readonly UPGRADE_SIGNATURES = new Set([
        '0x3659cfe6', // upgradeTo(address)
        '0x4f1ef286', // upgradeToAndCall(address,bytes)  
        '0x99a88ec4', // ProxyAdmin upgrade(ITransparentUpgradeableProxy,address)
        '0x9623609d', // ProxyAdmin upgradeAndCall(ITransparentUpgradeableProxy,address,bytes)
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

    static isUpgradeTransaction(to: string, data: string, proxyAddress: string, adminAddress?: string, safeAddress?: string): boolean {
        if (!to || !data || data.length < 10) {
            return false;
        }

        const toAddress = to.toLowerCase();
        const proxyAddr = proxyAddress.toLowerCase();
        const adminAddr = adminAddress?.toLowerCase();
        const safeAddr = safeAddress?.toLowerCase();
        
        // Case 1: Direct call to proxy or ProxyAdmin
        const isToProxy = toAddress === proxyAddr;
        const isToAdmin = adminAddr ? toAddress === adminAddr : false;
        if (isToProxy || isToAdmin) {
            const methodSignature = data.slice(0, 10);
            return this.UPGRADE_SIGNATURES.has(methodSignature);
        }

        // Case 2: Safe execTransaction wrapping ProxyAdmin upgrade
        if (safeAddr && toAddress === safeAddr) {
            try {
                const iface = new Interface(safeAbi);
                const decoded = iface.decodeFunctionData('execTransaction', data);
                const innerTo: string = decoded[0];
                const innerData: string = decoded[2];
                const innerToAddr = innerTo.toLowerCase();
                if (adminAddr && innerToAddr === adminAddr && innerData && innerData.length >= 10) {
                    const innerSig = innerData.slice(0, 10);
                    return this.UPGRADE_SIGNATURES.has(innerSig);
                }
            } catch {
                return false;
            }
        }

        return false;
    }

    static extractUpgradeDetails(tx: any, proxyAddress: string, adminAddress?: string, safeAddress?: string): {
        method: string;
        isUpgrade: boolean;
        newImplementation?: string;
    } | null {
        try {
            if (!tx.data || tx.data.length < 10) {
                return null;
            }

            const toAddress = tx.to?.toLowerCase?.() || '';
            const adminAddr = adminAddress?.toLowerCase?.();
            const safeAddr = safeAddress?.toLowerCase?.();

            // If Safe-wrapped, inspect inner call
            if (safeAddr && toAddress === safeAddr) {
                try {
                    const iface = new Interface(safeAbi);
                    const decoded = iface.decodeFunctionData('execTransaction', tx.data);
                    const innerData: string = decoded[2];
                    const innerSig = innerData.slice(0, 10);
                    const map: Record<string, string> = {
                        '0x99a88ec4': 'upgrade',
                        '0x9623609d': 'upgradeAndCall',
                        '0x3659cfe6': 'upgradeTo',
                        '0x4f1ef286': 'upgradeToAndCall'
                    };
                    const upgradeInfo = map[innerSig];
                    if (upgradeInfo) {
                        return {
                            method: upgradeInfo,
                            isUpgrade: true,
                            newImplementation: this.extractImplementationAddress(innerData, innerSig)
                        };
                    }
                } catch {
                    return null;
                }
            } else {
                // Direct call
                const methodSignature = tx.data.slice(0, 10);
                const map: Record<string, string> = {
                    '0x3659cfe6': 'upgradeTo',
                    '0x4f1ef286': 'upgradeToAndCall',
                    '0x8f283970': 'changeAdmin',
                    '0xf851a440': 'admin',
                    '0x5c60da1b': 'implementation',
                    '0x99a88ec4': 'upgrade',
                    '0x9623609d': 'upgradeAndCall'
                };

                const upgradeInfo = map[methodSignature];
                if (upgradeInfo) {
                    return {
                        method: upgradeInfo,
                        isUpgrade: true,
                        newImplementation: this.extractImplementationAddress(tx.data, methodSignature)
                    };
                }
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