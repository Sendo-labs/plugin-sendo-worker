import { logger, type IAgentRuntime, type Service } from '@elizaos/core';

/**
 * Interface for Solana service with wallet creation and balance checking
 */
interface ISolanaService extends Service {
  createWallet(): Promise<{ publicKey: string; privateKey: string }>;
  getBalance(assetAddress: string, owner?: string): Promise<number>;
}

/**
 * Ensure Solana wallet exists for the agent
 * Creates a new wallet if none exists
 *
 * @param runtime - The agent runtime
 * @returns Public key of the wallet (existing or newly created)
 * @throws Error if SOLANA_SERVICE is not available
 */
export async function ensureSolanaWallet(runtime: IAgentRuntime): Promise<string> {
  // Check if wallet already configured
  const publicKey = runtime.getSetting('SOLANA_PUBLIC_KEY');
  const privateKey = runtime.getSetting('SOLANA_PRIVATE_KEY');

  if (publicKey && privateKey) {
    logger.debug(`[WalletUtils] ✅ Solana wallet already configured: ${publicKey}`);
    return publicKey;
  }

  // No wallet - need to create one
  logger.warn('[WalletUtils] ⚠️  No Solana wallet found, creating one...');

  // Get Solana service
  const solanaService = runtime.getService<ISolanaService>('chain_solana');
  if (!solanaService) {
    logger.error('[WalletUtils] ❌ Solana service not found!');
    logger.error('[WalletUtils] Make sure @elizaos/plugin-solana is loaded');
    throw new Error('Solana service required but not available');
  }

  // Create wallet using Solana service
  try {
    const wallet = await solanaService.createWallet();
    logger.info(`[WalletUtils] 🎉 Created Solana wallet: ${wallet.publicKey}`);

    // Set in runtime (memory)
    runtime.setSetting('SOLANA_PUBLIC_KEY', wallet.publicKey, false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', wallet.privateKey, true); // encrypted

    // Persist to database (CRUCIAL!)
    // IAgentRuntime extends IDatabaseAdapter, so updateAgent is available directly
    await runtime.updateAgent(runtime.agentId, {
      settings: {
        secrets: runtime.character.secrets || {},
        ...(runtime.character.settings || {}),
      },
      updatedAt: Date.now(),
    });

    logger.info('[WalletUtils] ✅ Wallet persisted to database');
    logger.info('[WalletUtils] 💰 Fund this wallet to enable operations:');
    logger.info(`[WalletUtils] ${wallet.publicKey}`);

    return wallet.publicKey;
  } catch (error) {
    logger.error('[WalletUtils] ❌ Failed to create wallet:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Get wallet public key if exists
 *
 * @param runtime - The agent runtime
 * @returns Public key or null if no wallet configured
 */
export function getWalletPublicKey(runtime: IAgentRuntime): string | null {
  return runtime.getSetting('SOLANA_PUBLIC_KEY');
}

/**
 * Check if agent has a wallet configured
 *
 * @param runtime - The agent runtime
 * @returns True if wallet is configured
 */
export function hasWallet(runtime: IAgentRuntime): boolean {
  const publicKey = runtime.getSetting('SOLANA_PUBLIC_KEY');
  const privateKey = runtime.getSetting('SOLANA_PRIVATE_KEY');
  return !!(publicKey && privateKey);
}

/**
 * Check if wallet has sufficient balance for operations
 * Minimum balance: 0.01 SOL (for transaction fees)
 *
 * @param runtime - The agent runtime
 * @returns Object with hasBalance boolean and current balance in SOL
 */
export async function checkWalletBalance(
  runtime: IAgentRuntime
): Promise<{ hasBalance: boolean; balance: number; publicKey: string }> {
  const publicKey = getWalletPublicKey(runtime);

  if (!publicKey) {
    throw new Error('No wallet configured');
  }

  // Get Solana service to check balance
  const solanaService = runtime.getService<ISolanaService>('chain_solana');
  if (!solanaService) {
    throw new Error('Solana service required but not available');
  }

  try {
    // Get SOL balance using Solana service
    // 'SOL' is the native token identifier
    const balance = await solanaService.getBalance('SOL', publicKey);
    const minimumBalance = 0.01; // 0.01 SOL minimum for operations

    return {
      hasBalance: balance >= minimumBalance,
      balance,
      publicKey,
    };
  } catch (error) {
    logger.error('[WalletUtils] Failed to check wallet balance:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}