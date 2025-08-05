import { ethers, parseUnits } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { erc20Abi } from "./erc20Abi";
import dotenv from "dotenv";
import type { TransactionRequest } from "ethers";

dotenv.config();

const normalRpc = process.env.NORMAL_RPC;
const ETH_AMOUNT_TO_FUND = process.env.ETH_AMOUNT_TO_FUND || "0.001";
const baseGasPrice = parseUnits(process.env.BASE_GAS_PRICE as string, "gwei") || parseUnits("10", "gwei");
const flashbotsRpc = process.env.FLASHBOTS_RPC;
const funderKey = process.env.FUNDER_PRIVATE_KEY;
const compromisedKey = process.env.COMPROMISED_PRIVATE_KEY;
const erc20TokenAddress = process.env.ERC20_TOKEN_ADDRESS;

if (!funderKey || !compromisedKey) {
    throw new Error("FUNDER_PRIVATE_KEY and COMPROMISED_PRIVATE_KEY must be set");
}

if (!erc20TokenAddress) {
    throw new Error("ERC20_TOKEN_ADDRESS must be set");
}

const normalProvider = new ethers.JsonRpcProvider(normalRpc);

const funderAuthSigner = new ethers.Wallet(funderKey);
const compromisedAuthSigner = new ethers.Wallet(compromisedKey);

const erc20Contract = new ethers.Contract(erc20TokenAddress, erc20Abi, normalProvider);

// check balance
const balance = await erc20Contract.balanceOf(funderAuthSigner.address);

const compromisedAddress = compromisedAuthSigner.address;
const funderAddress = funderAuthSigner.address;

const flashbotsProvider = await FlashbotsBundleProvider.create(
    normalProvider,
    funderAuthSigner
);

// trx 1: fund ETH to compromised address
// Get current gas price and multiply by 3 for all transactions
const txGasPrice = baseGasPrice * 3n;

const ethAmountToSend = parseUnits(ETH_AMOUNT_TO_FUND, "ether"); // Set X value in ETH here

const fundEthPopulatedTx = await funderAuthSigner.populateTransaction({
    to: compromisedAddress,
    value: ethAmountToSend,
    gasPrice: txGasPrice
});

const trx1 = {
    signer: funderAuthSigner,
    transaction: fundEthPopulatedTx
}

// trx 2: send ERC20 to compromised address

const populatedTransaction = await erc20Contract.transfer?.populateTransaction(
    compromisedAddress,
    balance,
    { gasPrice: txGasPrice }
) as TransactionRequest;

console.log(populatedTransaction);

const trx2 = {
    signer: compromisedAuthSigner,
    transaction: populatedTransaction
}

// trx 3: send remaining ETH back to funder address
const compromisedEthBalance = await normalProvider.getBalance(compromisedAddress);

// Estimate gas for sending ETH back to funder
const gasLimit = 21000n; // Standard ETH transfer

// Calculate max amount to send (subtract gas cost)
const maxEthToSendBack = compromisedEthBalance - (txGasPrice * gasLimit);

const sendEthBackPopulatedTx = await compromisedAuthSigner.populateTransaction({
    to: funderAddress,
    value: maxEthToSendBack,
    gasPrice: txGasPrice
});

const trx3 = {
    signer: compromisedAuthSigner,
    transaction: sendEthBackPopulatedTx
}

const signedBundle = await flashbotsProvider.signBundle([
    trx1,
    trx2,
    trx3
  ]);

const simulation = await flashbotsProvider.simulate(signedBundle, "latest");
console.log(simulation);


// keep the bundle valid for next 10 blocks
const currentBlockNumber = await normalProvider.getBlockNumber();
const targetBlockNumber = currentBlockNumber + 10;

// const bundleReceipt = await flashbotsProvider.sendRawBundle(
//     signedBundle, // bundle we signed above
//     targetBlockNumber
// ); // bundle is valid for the next 10 blocks

// console.log(bundleReceipt);
