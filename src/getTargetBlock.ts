import { normalProvider } from "../config";

export const getTargetBlock = async () => {
    // keep the bundle valid for next 50 blocks
    const currentBlockNumber = await normalProvider.getBlockNumber();
    const targetBlockNumber = currentBlockNumber + 50;
    return targetBlockNumber;
}