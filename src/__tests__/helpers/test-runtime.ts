/**
 * Test Runtime Helper for Sendo Worker Plugin
 *
 * Creates REAL AgentRuntime instances with:
 * - Real action execution (not mocked)
 * - Real state management via processActions
 * - Test actions that return predictable data
 * - In-memory database for isolation
 */

import {
  AgentRuntime,
  type IAgentRuntime,
  type Character,
  type ActionResult,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

export interface TestRuntimeConfig {
  testId?: string;
  withDataActions?: boolean;
  withActionActions?: boolean;
  withProviders?: boolean;
  useRealLLM?: boolean; // Set to true to use OpenRouter instead of mocks
  limitActions?: number; // Limit number of actions to reduce LLM costs (default: all)
}

/**
 * Create a test runtime with real AgentRuntime
 * Uses actual runtime with controlled test actions
 *
 * Set USE_REAL_LLM=true or config.useRealLLM=true to use real OpenRouter API calls.
 * Make sure OPENROUTER_API_KEY is set in your environment.
 */
export async function createTestRuntime(config: TestRuntimeConfig = {}): Promise<IAgentRuntime> {
  const testId = config.testId || `test-${uuidv4().slice(0, 8)}`;
  const useRealLLM = config.useRealLLM || process.env.USE_REAL_LLM === 'true';

  logger.info(`[TestRuntime] Creating test runtime: ${testId}`);
  if (useRealLLM) {
    logger.info(`[TestRuntime] 🌐 Real LLM mode enabled - will use OpenRouter`);
  }

  // Create test character
  const character: Character = {
    name: `TestAgent-${testId}`,
    bio: 'Test agent for sendo-worker plugin',
    settings: {
      secrets: {},
      voice: { model: 'en_US-male-medium' },
      PGLITE_DATA_DIR: '.eliza-test', // Shared test DB (cleaned between runs)
    },
  };

  // Import SQL plugin for database adapter
  const sqlPlugin = await import('@elizaos/plugin-sql');

  // Import sendo-worker plugin for schema
  const sendoWorkerPlugin = await import('../../index');

  // Prepare plugins list
  const plugins: any[] = [
    sqlPlugin.default, // Required for database adapter
    sendoWorkerPlugin.default, // Required for schema tables
  ];

  // Add OpenRouter and OpenAI plugins if using real LLM
  // IMPORTANT: OpenRouter MUST be loaded BEFORE OpenAI to take priority for LLM calls
  if (useRealLLM) {
    try {
      // OpenRouter for LLM (MUST BE FIRST)
      const openrouterPlugin = await import('@elizaos/plugin-openrouter');
      plugins.push(openrouterPlugin.default);
      logger.info(`[TestRuntime] ✅ OpenRouter plugin loaded (for LLM)`);

      // OpenAI for embeddings (loaded after OpenRouter)
      const openaiPlugin = await import('@elizaos/plugin-openai');
      plugins.push(openaiPlugin.default);
      logger.info(`[TestRuntime] ✅ OpenAI plugin loaded (for embeddings)`);
    } catch (error) {
      logger.error(`[TestRuntime] ❌ Failed to load LLM plugins: ${error}`);
      throw new Error(
        'OpenRouter and OpenAI plugins are required for real LLM tests. Install with: bun add -d @elizaos/plugin-openrouter @elizaos/plugin-openai'
      );
    }
  }

  // Create REAL AgentRuntime with plugins
  const runtime = new AgentRuntime({
    character,
    plugins,
  });

  // Register test actions (real actions with predictable data)
  if (config.withDataActions) {
    registerTestDataActions(runtime, config.limitActions);
  }

  if (config.withActionActions) {
    registerTestActionActions(runtime, config.limitActions);
  }

  // Register test providers
  if (config.withProviders) {
    registerTestProviders(runtime);
  }

  // Initialize runtime
  await runtime.initialize();

  const actionCount = Array.from(runtime.actions.values()).length;
  logger.info(`[TestRuntime] Runtime ${runtime.agentId} ready with ${actionCount} actions`);

  return runtime;
}

/**
 * Helper to create a simple test action
 */
function createTestAction(
  name: string,
  description: string,
  category: 'DATA' | 'ACTION',
  mockData: any
) {
  return {
    name,
    description,
    similes: [],
    examples: [],
    validate: async () => true,
    handler: async (_runtime: any, _message: any, _state: any, _options: any, callback: any): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: mockData,
        values: { executed: true, category },
        text: `${name} executed successfully`,
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  };
}

/**
 * Register test DATA actions
 * Return predictable data for analysis testing
 * Based on real ElizaOS plugin patterns
 */
function registerTestDataActions(runtime: IAgentRuntime, limit?: number): void {
  // Wallet balance action (simulates plugin-wallet)
  runtime.registerAction({
    name: 'GET_WALLET_BALANCE',
    description: 'Get wallet balance and token holdings for the connected wallet',
    similes: ['CHECK_BALANCE', 'WALLET_STATUS', 'MY_HOLDINGS', 'SHOW_BALANCE'],
    examples: [
      [
        { content: { text: 'What is my wallet balance?' } } as any,
        { content: { text: 'Your wallet has 100.5 SOL and 5000 USDC' } } as any,
      ],
      [
        { content: { text: 'Check my holdings' } } as any,
        { content: { text: 'Total portfolio value: $15,050' } } as any,
      ],
    ],
    validate: async () => true,
    handler: async (_runtime, _message, _state, _options, callback): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: {
          address: '0xABC123',
          balances: [
            { token: 'SOL', amount: 100.5, usd: 10050 },
            { token: 'USDC', amount: 5000, usd: 5000 },
          ],
          totalUsd: 15050,
          lastUpdated: new Date().toISOString(),
        },
        values: {
          solBalance: 100.5,
          usdcBalance: 5000,
          totalValue: 15050,
        },
        text: 'Wallet balance: 100.5 SOL ($10,050), 5000 USDC ($5,000). Total portfolio value: $15,050',
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  });

  // Market data action (simulates plugin-market)
  runtime.registerAction({
    name: 'GET_MARKET_DATA',
    description: 'Get current market conditions and price trends',
    similes: ['MARKET_STATUS', 'PRICE_TRENDS', 'MARKET_ANALYSIS', 'CHECK_MARKET'],
    examples: [
      [
        { content: { text: 'What are the market conditions?' } } as any,
        { content: { text: 'Market is bullish with strong upward momentum' } } as any,
      ],
      [
        { content: { text: 'Check SOL price' } } as any,
        { content: { text: 'SOL is at $100, up 15.5% in 24h' } } as any,
      ],
    ],
    validate: async () => true,
    handler: async (_runtime, _message, _state, _options, callback): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: {
          sentiment: 'bullish',
          solPrice: 100,
          solChange24h: 15.5,
          volume24h: 1200000000,
          timestamp: new Date().toISOString(),
        },
        values: {
          sentiment: 'bullish',
          priceChange: 15.5,
          trending: 'up',
        },
        text: 'Market sentiment: Bullish. SOL: $100 (+15.5% 24h). Volume: $1.2B. Strong upward momentum.',
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  });

  // Risk assessment action (simulates plugin-risk)
  runtime.registerAction({
    name: 'ASSESS_PORTFOLIO_RISK',
    description: 'Assess portfolio risk level and provide recommendations',
    similes: ['RISK_ANALYSIS', 'CHECK_RISK', 'PORTFOLIO_SAFETY', 'RISK_CHECK'],
    examples: [
      [
        { content: { text: 'Assess my portfolio risk' } } as any,
        { content: { text: 'Your portfolio has medium risk due to high SOL exposure' } } as any,
      ],
      [
        { content: { text: 'How risky is my portfolio?' } } as any,
        { content: { text: 'Risk level: 60/100 (Medium)' } } as any,
      ],
    ],
    validate: async () => true,
    handler: async (_runtime, _message, _state, _options, callback): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: {
          riskLevel: 'medium',
          riskScore: 0.6,
          volatility: 0.35,
          diversification: 0.65,
          warnings: ['High exposure to SOL (66% of portfolio)', 'Limited stablecoin allocation'],
          recommendations: ['Consider rebalancing to 50/50', 'Increase stablecoin holdings'],
        },
        values: {
          riskScore: 0.6,
          volatilityLevel: 'medium',
          needsRebalancing: true,
        },
        text: 'Risk level: Medium (60/100). Volatility: 35%. Diversification: 65%. Warning: High exposure to SOL. Consider rebalancing.',
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  });

  // Add more varied DATA actions using helper
  const additionalDataActions = [
    // Wallet & Portfolio
    createTestAction('GET_TOKEN_HOLDINGS', 'Get all SPL token holdings', 'DATA', {
      tokens: [
        { mint: 'SOL', amount: 100.5, usd: 10050 },
        { mint: 'USDC', amount: 5000, usd: 5000 },
        { mint: 'JUP', amount: 1250, usd: 625 },
      ],
    }),
    createTestAction('GET_TRANSACTION_HISTORY', 'Get recent transaction history', 'DATA', {
      transactions: [
        { type: 'swap', from: 'SOL', to: 'USDC', amount: 10, timestamp: Date.now() },
        { type: 'transfer', token: 'SOL', amount: 5, timestamp: Date.now() - 3600000 },
      ],
    }),
    createTestAction('GET_NFT_PORTFOLIO', 'Get NFT collection', 'DATA', {
      nfts: [
        { collection: 'Mad Lads', count: 8, floor: 85 },
        { collection: 'Tensorians', count: 5, floor: 12 },
      ],
    }),
    createTestAction('GET_PORTFOLIO_VALUE', 'Calculate total portfolio value', 'DATA', {
      totalUsd: 15050,
      breakdown: { liquid: 15050, staked: 0, lp: 0 },
    }),

    // Market & Price Data
    createTestAction('GET_TOKEN_PRICE', 'Get current token price', 'DATA', {
      token: 'SOL',
      price: 150,
      change24h: 5.2,
    }),
    createTestAction('GET_PRICE_HISTORY', 'Get historical price data', 'DATA', {
      prices: [140, 145, 148, 150],
      timestamps: ['1h', '2h', '3h', '4h'],
    }),
    createTestAction('GET_DEX_LIQUIDITY', 'Check DEX liquidity', 'DATA', {
      pools: [
        { dex: 'Orca', pair: 'SOL/USDC', tvl: 12000000 },
        { dex: 'Raydium', pair: 'SOL/USDC', tvl: 8500000 },
      ],
    }),
    createTestAction('GET_TRADING_VOLUME', 'Get 24h trading volume', 'DATA', {
      volume24h: 1200000000,
      volumeChange: 15.5,
    }),

    // DeFi Positions
    createTestAction('GET_STAKING_POSITIONS', 'Get staking positions', 'DATA', {
      positions: [
        { validator: 'Marinade', amount: 50, apy: 6.2, rewards: 0.15 },
        { validator: 'Jito', amount: 30, apy: 7.1, rewards: 0.08 },
      ],
    }),
    createTestAction('GET_LENDING_POSITIONS', 'Get lending positions', 'DATA', {
      supplied: [{ protocol: 'MarginFi', asset: 'SOL', amount: 10, apy: 4.2 }],
      borrowed: [{ protocol: 'Solend', asset: 'USDC', amount: 500, apr: 8.5 }],
      healthFactor: 1.85,
    }),
    createTestAction('GET_LP_POSITIONS', 'Get liquidity positions', 'DATA', {
      positions: [
        { pool: 'SOL/USDC', dex: 'Orca', value: 2400, apy: 18.5, il: -2.1 },
        { pool: 'JUP/SOL', dex: 'Raydium', value: 800, apy: 35.2, il: -8.5 },
      ],
    }),
    createTestAction('GET_YIELD_OPPORTUNITIES', 'Scan yield farming opportunities', 'DATA', {
      opportunities: [
        { protocol: 'Kamino', pool: 'USDC', apy: 12.5, risk: 'low' },
        { protocol: 'Meteora', pool: 'SOL/USDC', apy: 35.0, risk: 'medium' },
      ],
    }),

    // Risk & Analytics
    createTestAction('CALCULATE_IMPERMANENT_LOSS', 'Calculate IL for LP positions', 'DATA', {
      pools: [
        { pair: 'SOL/USDC', currentIL: -2.1, projectedIL: -5.0 },
        { pair: 'JUP/SOL', currentIL: -8.5, projectedIL: -12.0 },
      ],
    }),
    createTestAction('ANALYZE_WALLET_HEALTH', 'Evaluate wallet health', 'DATA', {
      healthScore: 78,
      diversification: 0.65,
      riskLevel: 'medium',
      warnings: ['High SOL exposure'],
    }),
    createTestAction('GET_GAS_ESTIMATES', 'Estimate transaction costs', 'DATA', {
      swap: 0.00001,
      stake: 0.00005,
      addLiquidity: 0.00006,
    }),
  ];

  // Apply limit if specified (useful for reducing LLM costs in real tests)
  const actionsToRegister = limit ? additionalDataActions.slice(0, Math.max(0, limit - 3)) : additionalDataActions;
  actionsToRegister.forEach((action) => runtime.registerAction(action));

  logger.info(`[TestRuntime] Registered ${3 + actionsToRegister.length} DATA actions`);
}

/**
 * Register test ACTION actions
 * Simulate on-chain operations
 */
function registerTestActionActions(runtime: IAgentRuntime, limit?: number): void {
  // Swap action (simulates plugin-swap)
  runtime.registerAction({
    name: 'EXECUTE_SWAP',
    description: 'Execute token swap on decentralized exchange',
    similes: ['SWAP_TOKENS', 'TRADE_TOKENS', 'EXCHANGE', 'CONVERT_TOKENS'],
    examples: [
      [
        { content: { text: 'Swap 10 SOL for USDC' } } as any,
        { content: { text: 'Swapped 10 SOL for 995 USDC successfully' } } as any,
      ],
      [
        { content: { text: 'Exchange SOL to USDC' } } as any,
        { content: { text: 'Trade executed. Fee: 5 USDC' } } as any,
      ],
    ],
    validate: async () => true,
    handler: async (_runtime, _message, _state, _options, callback): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: {
          txHash: '0xabc123def456',
          fromToken: 'SOL',
          toToken: 'USDC',
          amountIn: 10,
          amountOut: 995,
          fee: 5,
          slippage: 0.5,
          timestamp: new Date().toISOString(),
        },
        values: {
          executed: true,
          profit: 995,
          netAmount: 990,
        },
        text: 'Swap executed successfully: 10 SOL → 995 USDC. Fee: 5 USDC. Net: 990 USDC. Tx: 0xabc123',
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  });

  // Rebalance action (simulates plugin-portfolio)
  runtime.registerAction({
    name: 'REBALANCE_PORTFOLIO',
    description: 'Rebalance portfolio to target allocation',
    similes: ['REBALANCE', 'ADJUST_ALLOCATION', 'REALLOCATE', 'OPTIMIZE_PORTFOLIO'],
    examples: [
      [
        { content: { text: 'Rebalance my portfolio to 50/50' } } as any,
        { content: { text: 'Portfolio rebalanced successfully' } } as any,
      ],
      [
        { content: { text: 'Adjust my allocation' } } as any,
        { content: { text: 'Rebalanced to 50% SOL / 50% USDC' } } as any,
      ],
    ],
    validate: async () => true,
    handler: async (_runtime, _message, _state, _options, callback): Promise<ActionResult> => {
      const result: ActionResult = {
        success: true,
        data: {
          trades: [
            { action: 'sell', token: 'SOL', amount: 25, usdValue: 2500 },
            { action: 'buy', token: 'USDC', amount: 2500, usdValue: 2500 },
          ],
          newAllocation: {
            SOL: { amount: 75.5, percentage: 50, usd: 7550 },
            USDC: { amount: 7500, percentage: 50, usd: 7500 },
          },
          totalValue: 15050,
        },
        values: {
          rebalanced: true,
          tradesExecuted: 2,
        },
        text: 'Portfolio rebalanced successfully to 50% SOL / 50% USDC. Executed 2 trades. New balance: 75.5 SOL, 7500 USDC.',
      };

      if (callback) {
        await callback({
          text: result.text || '',
          data: result.data,
          ...result.values,
        });
      }
      return result;
    },
  });

  // Add more varied ACTION actions using helper
  const additionalActionActions = [
    // Trading actions
    createTestAction('SWAP_VIA_JUPITER', 'Swap via Jupiter aggregator', 'ACTION', {
      txHash: '0xjupiter123',
      route: ['SOL', 'JUP'],
      amountIn: 10,
      amountOut: 111,
    }),
    createTestAction('LIMIT_ORDER_CREATE', 'Create limit order', 'ACTION', {
      orderId: 'limit-123',
      side: 'buy',
      price: 140,
      amount: 5,
    }),
    createTestAction('DCA_ORDER_CREATE', 'Setup DCA order', 'ACTION', {
      dcaId: 'dca-456',
      frequency: 'weekly',
      amount: 100,
    }),

    // Portfolio management
    createTestAction('STOP_LOSS_SET', 'Set stop-loss order', 'ACTION', {
      orderId: 'sl-789',
      triggerPrice: 130,
      amount: 5,
    }),
    createTestAction('TAKE_PROFIT_SET', 'Set take-profit order', 'ACTION', {
      orderId: 'tp-012',
      triggerPrice: 180,
      amount: 5,
    }),
    createTestAction('AUTO_COMPOUND_REWARDS', 'Enable auto-compound', 'ACTION', {
      enabled: true,
      protocols: ['marinade', 'orca'],
      frequency: 'daily',
    }),

    // Staking actions
    createTestAction('STAKE_SOL', 'Stake SOL with validator', 'ACTION', {
      txHash: '0xstake123',
      amount: 5,
      validator: 'marinade',
      mSolReceived: 5,
    }),
    createTestAction('UNSTAKE_SOL', 'Unstake SOL', 'ACTION', {
      txHash: '0xunstake456',
      amount: 2,
      cooldownDays: 3,
    }),
    createTestAction('CLAIM_STAKING_REWARDS', 'Claim staking rewards', 'ACTION', {
      txHash: '0xclaim789',
      rewards: 0.15,
      autoRestaked: true,
    }),
    createTestAction('CHANGE_VALIDATOR', 'Switch validator', 'ACTION', {
      txHash: '0xswitch012',
      from: 'validator-a',
      to: 'jito',
      amount: 3,
    }),

    // DeFi Lending
    createTestAction('SUPPLY_COLLATERAL', 'Supply collateral to lending', 'ACTION', {
      txHash: '0xsupply345',
      protocol: 'marginfi',
      asset: 'SOL',
      amount: 3,
    }),
    createTestAction('BORROW_ASSET', 'Borrow from lending protocol', 'ACTION', {
      txHash: '0xborrow678',
      protocol: 'marginfi',
      asset: 'USDC',
      amount: 200,
    }),
    createTestAction('REPAY_LOAN', 'Repay loan', 'ACTION', {
      txHash: '0xrepay901',
      protocol: 'solend',
      asset: 'USDC',
      amount: 100,
    }),
    createTestAction('WITHDRAW_COLLATERAL', 'Withdraw collateral', 'ACTION', {
      txHash: '0xwithdraw234',
      protocol: 'marginfi',
      asset: 'SOL',
      amount: 2,
    }),

    // Liquidity provision
    createTestAction('ADD_LIQUIDITY', 'Add liquidity to pool', 'ACTION', {
      txHash: '0xadd567',
      dex: 'orca',
      pool: 'SOL-USDC',
      amountA: 2,
      amountB: 300,
      lpTokens: 10.5,
    }),
    createTestAction('REMOVE_LIQUIDITY', 'Remove liquidity from pool', 'ACTION', {
      txHash: '0xremove890',
      dex: 'raydium',
      pool: 'BONK-SOL',
      percentage: 100,
    }),
    createTestAction('CLAIM_LP_FEES', 'Claim LP fees', 'ACTION', {
      txHash: '0xclaimfees123',
      fees: { SOL: 0.08, USDC: 12 },
      rewards: { ORCA: 15 },
    }),
    createTestAction('MIGRATE_LIQUIDITY', 'Migrate LP position', 'ACTION', {
      txHash: '0xmigrate456',
      fromDex: 'orca',
      toDex: 'raydium',
      pool: 'SOL-USDC',
    }),

    // NFT operations
    createTestAction('LIST_NFT_FOR_SALE', 'List NFT on marketplace', 'ACTION', {
      txHash: '0xlist789',
      marketplace: 'tensor',
      nftMint: 'nft123',
      price: 0.5,
    }),
    createTestAction('BUY_NFT', 'Buy NFT from marketplace', 'ACTION', {
      txHash: '0xbuy012',
      marketplace: 'tensor',
      nftMint: 'madlads1337',
      price: 85,
    }),
    createTestAction('CANCEL_NFT_LISTING', 'Cancel NFT listing', 'ACTION', {
      txHash: '0xcancel345',
      marketplace: 'magic-eden',
      nftMint: 'tensorian9876',
    }),
    createTestAction('MAKE_NFT_OFFER', 'Make offer on NFT', 'ACTION', {
      txHash: '0xoffer678',
      marketplace: 'tensor',
      nftMint: 'smb442',
      offerPrice: 75,
    }),

    // Advanced DeFi
    createTestAction('FLASH_LOAN_ARBITRAGE', 'Execute flash loan arb', 'ACTION', {
      txHash: '0xflash901',
      borrowed: 10000,
      profit: 125,
    }),
    createTestAction('LEVERAGE_POSITION', 'Open leveraged position', 'ACTION', {
      txHash: '0xlev234',
      protocol: 'drift',
      asset: 'SOL',
      leverage: 3,
      collateral: 1000,
    }),
    createTestAction('CLOSE_LEVERAGE', 'Close leveraged position', 'ACTION', {
      txHash: '0xclose567',
      protocol: 'drift',
      pnl: 150,
    }),
    createTestAction('HEDGE_POSITION', 'Hedge with derivatives', 'ACTION', {
      txHash: '0xhedge890',
      protocol: 'zeta',
      position: 'short-JUP-2x',
      amount: 5,
    }),
  ];

  // Apply limit if specified (useful for reducing LLM costs in real tests)
  const actionsToRegister = limit ? additionalActionActions.slice(0, Math.max(0, limit - 2)) : additionalActionActions;
  actionsToRegister.forEach((action) => runtime.registerAction(action));

  logger.info(`[TestRuntime] Registered ${2 + actionsToRegister.length} ACTION actions`);
}

/**
 * Register test providers
 */
function registerTestProviders(runtime: IAgentRuntime): void {
  runtime.registerProvider({
    name: 'walletContext',
    description: 'Provides wallet context information',
    get: async () => ({
      text: 'Current wallet: 0xABC123 on Solana mainnet',
      data: {
        address: '0xABC123',
        network: 'solana-mainnet',
        connected: true,
        balance: 100.5,
      },
      values: {
        isConnected: true,
        hasBalance: true,
      },
    }),
  });

  runtime.registerProvider({
    name: 'timeContext',
    description: 'Provides current time and market hours',
    get: async () => ({
      text: 'Current time: 2025-01-20 10:00 UTC (Market hours)',
      data: {
        timestamp: Date.now(),
        timezone: 'UTC',
        marketOpen: true,
        hour: 10,
      },
      values: {
        hour: 10,
        isMarketHours: true,
      },
    }),
  });

  logger.info('[TestRuntime] Registered 2 providers');
}

/**
 * Cleanup test runtime
 */
export async function cleanupTestRuntime(runtime: IAgentRuntime): Promise<void> {
  logger.info(`[TestRuntime] Cleaning up runtime ${runtime.agentId}`);

  const adapter = (runtime as any).adapter;
  if (adapter && typeof adapter.close === 'function') {
    await adapter.close();
  }

  // Cleanup shared test DB directory
  const fs = await import('fs');
  const path = await import('path');
  const testDbPath = path.join(process.cwd(), '.eliza-test');
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { recursive: true, force: true });
    logger.info('[TestRuntime] Removed test DB directory');
  }

  logger.info('[TestRuntime] Cleanup complete');
}
