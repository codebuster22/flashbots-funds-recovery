import { erc20Abi } from "./src/abi/erc20Abi";
import dotenv from "dotenv";
import { parseUnits } from "ethers";
import { ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsTransaction, FlashbotsTransactionResponse } from "@flashbots/ethers-provider-bundle";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    NORMAL_RPC: z.string(),
    ETH_AMOUNT_TO_FUND: z.string().default("0.001"),
    BASE_GAS_PRICE: z.string().default("4"),
    TIP_IN_GWEI: z.string().default("4"),
    FLASHBOTS_RPC: z.string().optional(),
    FUNDER_PRIVATE_KEY: z.string().min(1, "FUNDER_PRIVATE_KEY must be set"),
    COMPROMISED_PRIVATE_KEY: z.string().min(1, "COMPROMISED_PRIVATE_KEY must be set"),
    ERC20_TOKEN_ADDRESS: z.string().min(1, "ERC20_TOKEN_ADDRESS must be set"),
    SIMULATE: z.string().optional().default("false"),
    USE_FLASHBOTS: z.string().optional().default("false"),
    BEAVER_RPC_URL: z.string().optional().default("https://rpc.beaverbuild.org/"),
});

const env = envSchema.parse(process.env);

const normalRpc = env.NORMAL_RPC;
const ETH_AMOUNT_TO_FUND = env.ETH_AMOUNT_TO_FUND;
const baseGasPrice = parseUnits(env.BASE_GAS_PRICE, "gwei");
const tip = parseUnits(env.TIP_IN_GWEI, "gwei");
const flashbotsRpc = env.FLASHBOTS_RPC;
const funderKey = env.FUNDER_PRIVATE_KEY;
const compromisedKey = env.COMPROMISED_PRIVATE_KEY;
const erc20TokenAddress = env.ERC20_TOKEN_ADDRESS;
const simulate = env.SIMULATE === "true";
const useFlashBots = env.USE_FLASHBOTS === "true";
const beaverRpcUrl = env.BEAVER_RPC_URL;

const normalProvider = new ethers.JsonRpcProvider(normalRpc);

const authSigner = ethers.Wallet.createRandom();
const funderAuthSigner = new ethers.Wallet(funderKey, normalProvider);
const compromisedAuthSigner = new ethers.Wallet(compromisedKey, normalProvider);

const erc20Contract = new ethers.Contract(erc20TokenAddress, erc20Abi, compromisedAuthSigner);

const compromisedAddress = compromisedAuthSigner.address;
const funderAddress = funderAuthSigner.address;

console.log("🔍 Checking ERC20 token balance...");
const balance = await erc20Contract.balanceOf(compromisedAddress);
console.log(`💰 Found ${balance.toString()} tokens in compromised wallet`);

const flashbotsProvider = await FlashbotsBundleProvider.create(
    normalProvider,
    authSigner,
    flashbotsRpc
);

const maxFeePerGas = baseGasPrice * 3n + tip;
const maxPriorityFeePerGas = tip;

export {
    simulate,
    maxPriorityFeePerGas,
    maxFeePerGas,
    beaverRpcUrl,
    useFlashBots,
    flashbotsProvider,
    erc20TokenAddress,
    compromisedAuthSigner,
    normalProvider,
    balance,
    funderAddress,
    erc20Contract,
    funderAuthSigner,
    compromisedAddress,
    ETH_AMOUNT_TO_FUND,
    baseGasPrice,
    tip
}