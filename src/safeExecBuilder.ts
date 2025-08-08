import { Interface, Wallet, ZeroAddress, getBytes, hexlify, parseUnits } from 'ethers';
import axios from 'axios';
import { safeAbi } from './abi/safeAbi';
import { SafeTransaction, SafeConfirmation } from './monitoring/safe/safeApiTypes';
import { chainId, funderAuthSigner } from '../config';

type GasOverrides = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasLimit?: bigint;
};

const safeIface = new Interface(safeAbi);

function sortConfirmationsByOwner(confirmations: SafeConfirmation[]): SafeConfirmation[] {
  return [...confirmations].sort((a, b) => a.owner.toLowerCase().localeCompare(b.owner.toLowerCase()));
}

function concatSignatures(confirmations: SafeConfirmation[]): string {
  const sigs = confirmations.map((c) => c.signature);
  // Signatures are already 65-byte hex strings (0x + r(32) + s(32) + v(1))
  return '0x' + sigs.map((s) => s.replace(/^0x/, '')).join('');
}

export async function buildSafeExecRawFromApi(
  proposal: SafeTransaction | undefined,
  safeAddress: string,
  gas: GasOverrides,
  safeApiBaseUrl?: string
): Promise<string> {
  if (!proposal) throw new Error('Missing Safe proposal for exec build');

  const confirmations = sortConfirmationsByOwner(proposal.confirmations || []);
  if (confirmations.length < proposal.confirmationsRequired) {
    throw new Error('Not enough confirmations to execute');
  }

  const signatures = concatSignatures(confirmations);

  const to = proposal.to;
  const value = BigInt(proposal.value || '0');
  const data = proposal.data || '0x';
  const operation = Number(proposal.operation || 0);
  const safeTxGas = BigInt(proposal.safeTxGas || '0');
  const baseGas = BigInt(proposal.baseGas || '0');
  const gasPrice = BigInt(proposal.gasPrice || '0');
  const gasToken = proposal.gasToken || ZeroAddress;
  const refundReceiver = proposal.refundReceiver || ZeroAddress;

  const execData = safeIface.encodeFunctionData('execTransaction', [
    to,
    value,
    data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    signatures
  ]);

  // Fetch current nonce for funder wallet (required for pre-signed transactions)
  const nonce = await funderAuthSigner.provider!.getTransactionCount(funderAuthSigner.address, 'pending');
  
  const tx = {
    chainId: chainId,
    type: 2,
    to: safeAddress,
    value: 0n,
    data: execData,
    maxFeePerGas: gas.maxFeePerGas,
    maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
    gasLimit: gas.gasLimit ?? BigInt(300000),
    nonce: nonce
  } as const;

  const signed = await funderAuthSigner.signTransaction(tx);
  return signed;
}

export async function fetchLatestConfirmedUpgradeProposal(
  safeAddress: string,
  proxyAdminAddress: string,
  safeApiBaseUrl?: string
): Promise<SafeTransaction | null> {
  const baseUrl = safeApiBaseUrl || 'https://safe-transaction-mainnet.safe.global';
  const apiUrl = `${baseUrl}/api/v2/safes/${safeAddress}/multisig-transactions/`; // Preserve checksum for Safe API
  const params = { limit: 50, ordering: '-nonce' } as any;

  const resp = await axios.get(apiUrl, { params });
  const results: SafeTransaction[] = resp.data?.results || [];

  const isUpgrade = (tx: SafeTransaction) => {
    const toOk = tx.to?.toLowerCase() === proxyAdminAddress.toLowerCase();
    const method = tx.dataDecoded?.method;
    const methodOk = method ? ['upgrade', 'upgradeAndCall'].includes(method) : false;
    if (toOk && methodOk) return true;
    if (!toOk || !tx.data || tx.data.length < 10) return false;
    const sig = tx.data.slice(0, 10);
    const PROXY_ADMIN_UPGRADE_SIGS = new Set([
      '0x99a88ec4', // upgrade(ITransparentUpgradeableProxy,address)
      '0x9623609d'  // upgradeAndCall(ITransparentUpgradeableProxy,address,bytes)
    ]);
    return PROXY_ADMIN_UPGRADE_SIGS.has(sig);
  };

  // Choose the most recent confirmed (>= required) and not executed
  for (const tx of results) {
    if (!isUpgrade(tx)) continue;
    if (tx.isExecuted) continue;
    const conf = tx.confirmations?.length || 0;
    const req = tx.confirmationsRequired || 0;
    if (conf >= req && req > 0) {
      return tx;
    }
  }

  return null;
}