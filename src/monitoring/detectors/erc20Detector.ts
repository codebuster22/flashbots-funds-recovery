import { Interface } from 'ethers';
import { erc20Abi } from '../../abi/erc20Abi';

export class ERC20Detector {
    private static interface = new Interface(erc20Abi);
    
    private static targetMethods = new Set([
        'transfer',
        'transferFrom', 
        'approve',
        'setApproval'
    ]);

    static isERC20Transaction(to: string, data: string, targetTokenAddress: string): boolean {
        return to.toLowerCase() === targetTokenAddress.toLowerCase() && 
               data && data.length > 10;
    }

    static decodeMethodCall(data: string): { methodName: string; methodSignature: string } | null {
        try {
            if (!data || data.length < 10) {
                return null;
            }

            const methodSignature = data.slice(0, 10);
            const decoded = this.interface.parseTransaction({ data });
            
            if (!decoded) {
                return null;
            }

            const methodName = decoded.name;
            
            if (this.targetMethods.has(methodName)) {
                return {
                    methodName,
                    methodSignature
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}