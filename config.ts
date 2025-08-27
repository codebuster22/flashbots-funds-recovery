import { erc20Abi } from "./src/abi/erc20Abi";
import dotenv from "dotenv";
import { parseUnits } from "ethers";
import { ethers } from "ethers";
import { FlashbotsBundleProvider, FlashbotsTransaction, FlashbotsTransactionResponse } from "@flashbots/ethers-provider-bundle";
import { z } from "zod";
import { wlfiAbi } from "./src/abi/wlfiAbi";
import { lockboxAbi } from "./src/abi/lockboxAbi";

dotenv.config();

const envSchema = z.object({
    NORMAL_RPC: z.string(),
    WEBSOCKET_RPC: z.string().optional(),
    CHAIN_ID: z.string().optional().default("1"),
    ETH_AMOUNT_TO_FUND: z.string().default("0.001"),
    BASE_GAS_PRICE: z.string().default("4"),
    TIP_IN_GWEI: z.string().default("4"),
    FLASHBOTS_RPC: z.string().optional(),
    FUNDER_PRIVATE_KEY: z.string().min(1, "FUNDER_PRIVATE_KEY must be set"),
    COMPROMISED_PRIVATE_KEY: z.string().min(1, "COMPROMISED_PRIVATE_KEY must be set"),
    ERC20_TOKEN_ADDRESS: z.string().min(1, "ERC20_TOKEN_ADDRESS must be set"),
    PROXY_CONTRACT_ADDRESS: z.string().optional(),
    PROXY_ADMIN_ADDRESS: z.string().min(1, "PROXY_ADMIN_ADDRESS must be set for three-phase system"),
    SAFE_ADDRESS: z.string().min(1, "SAFE_ADDRESS must be set for three-phase system"),
    SAFE_API_BASE_URL: z.string().optional().default("https://safe-transaction-mainnet.safe.global"),
    SIMULATE: z.string().optional().default("false"),
    USE_FLASHBOTS: z.string().optional().default("true"),
    BEAVER_RPC_URL: z.string().optional().default("https://rpc.beaverbuild.org/"),
    ALCHEMY_API_KEY: z.string().optional(),
    UPPER_BOUND_GAS_PRICE: z.string().default("100"),
    UPPER_BOUND_MAX_FEE_PER_GAS: z.string().default("100"),
    UPPER_BOUND_MAX_PRIORITY_FEE: z.string().default("50"),
    WEBHOOK_URL: z.string().optional(),
    CONSECUTIVE_SKIP_THRESHOLD: z.string().default("5"),
    ACTIVATE_ACCOUNT_SIGNATURE: z.string().min(1, "ACTIVATE_ACCOUNT_SIGNATURE must be set"),
    LOCKBOX_VESTING_CONTRACT_ADDRESS: z.string().default("0x38F7e36eC57263e470a3c5761f3Ff4b94b0FDB2E"),
});

const env = envSchema.parse(process.env);

const normalRpc = env.NORMAL_RPC;
const websocketRpc = env.WEBSOCKET_RPC || env.NORMAL_RPC.replace('https://', 'wss://').replace('http://', 'ws://');
const chainId = Number.parseInt(env.CHAIN_ID, 10);
const ETH_AMOUNT_TO_FUND = env.ETH_AMOUNT_TO_FUND;
const baseGasPrice = parseUnits(env.BASE_GAS_PRICE, "gwei");
const tip = parseUnits(env.TIP_IN_GWEI, "gwei");
const upperBoundGasPrice = parseUnits(env.UPPER_BOUND_GAS_PRICE, "gwei");
const upperBoundMaxFeePerGas = parseUnits(env.UPPER_BOUND_MAX_FEE_PER_GAS, "gwei");
const upperBoundMaxPriorityFee = parseUnits(env.UPPER_BOUND_MAX_PRIORITY_FEE, "gwei");
const webhookUrl = env.WEBHOOK_URL;
const consecutiveSkipThreshold = parseInt(env.CONSECUTIVE_SKIP_THRESHOLD);
const flashbotsRpc = env.FLASHBOTS_RPC;
const funderKey = env.FUNDER_PRIVATE_KEY;
const compromisedKey = env.COMPROMISED_PRIVATE_KEY;
const erc20TokenAddress = env.ERC20_TOKEN_ADDRESS;
const proxyContractAddress = env.PROXY_CONTRACT_ADDRESS || erc20TokenAddress;
const proxyAdminAddress = env.PROXY_ADMIN_ADDRESS;
const safeAddress = env.SAFE_ADDRESS;
const safeApiBaseUrl = env.SAFE_API_BASE_URL;
const simulate = env.SIMULATE === "true";
const useFlashBots = env.USE_FLASHBOTS === "true";
const beaverRpcUrl = env.BEAVER_RPC_URL;
const alchemyApiKey = env.ALCHEMY_API_KEY;
const activateAccountSignature = env.ACTIVATE_ACCOUNT_SIGNATURE;
const lockboxVestingContractAddress = env.LOCKBOX_VESTING_CONTRACT_ADDRESS;

const normalProvider = new ethers.JsonRpcProvider(normalRpc);

const authSigner = ethers.Wallet.createRandom();
const funderAuthSigner = new ethers.Wallet(funderKey, normalProvider);
const compromisedAuthSigner = new ethers.Wallet(compromisedKey, normalProvider);

const erc20Contract = new ethers.Contract(erc20TokenAddress, erc20Abi, compromisedAuthSigner);
const wlfiContract = new ethers.Contract(erc20TokenAddress, wlfiAbi, compromisedAuthSigner);
const lockboxVestingContract = new ethers.Contract(lockboxVestingContractAddress, lockboxAbi, compromisedAuthSigner);

const compromisedAddress = compromisedAuthSigner.address;
const funderAddress = funderAuthSigner.address;

console.log("🔍 Checking ERC20 token balance...");
const balance = await (erc20Contract as any).balanceOf(compromisedAddress);
console.log(`💰 Found ${balance.toString()} tokens in compromised wallet`);

console.log("🔍 Checking claimable balance...");
const claimableBalance = await (lockboxVestingContract as any).claimable(compromisedAddress);
console.log(`💰 Found ${claimableBalance.toString()} tokens in compromised wallet`);

const flashbotsProvider = await FlashbotsBundleProvider.create(
    normalProvider,
    authSigner,
    flashbotsRpc
);

// Gas calculations moved to gasController.ts

export {
    simulate,
    chainId,
    // Gas exports removed - use getGasInfo() from gasController
    beaverRpcUrl,
    alchemyApiKey,
    useFlashBots,
    flashbotsProvider,
    erc20TokenAddress,
    proxyContractAddress,
    proxyAdminAddress,
    safeAddress,
    safeApiBaseUrl,
    compromisedAuthSigner,
    normalProvider,
    balance,
    funderAddress,
    erc20Contract,
    funderAuthSigner,
    compromisedAddress,
    ETH_AMOUNT_TO_FUND,
    baseGasPrice,
    tip,
    upperBoundGasPrice,
    upperBoundMaxFeePerGas,
    upperBoundMaxPriorityFee,
    websocketRpc,
    webhookUrl,
    consecutiveSkipThreshold,
    wlfiContract,
    activateAccountSignature,
    claimableBalance
}