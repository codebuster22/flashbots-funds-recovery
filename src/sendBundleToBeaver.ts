import axios from "axios";
import { beaverRpcUrl } from "../config";

export const sendBundleToBeaver = async (signedBundle: Array<string>, targetBlockNumber: bigint) => {
    // use beaverbuild
    const payload = {
        id: 1,
        jsonrpc: "2.0",
        method: "eth_sendBundle",
        params: [
            {
                txs: signedBundle,
                blockNumber: '0x' + targetBlockNumber.toString(16),
            }
        ]
    }

    try {
        const response = await axios.post(beaverRpcUrl, payload, {
            headers: {
                "Content-Type": "application/json",
            }
        });

        const data = response.data;
        console.log("Bundle sent successfully");
        console.log(data);
    } catch (error) {
        console.error("Error sending bundle:", error);
        throw error;
    }
}