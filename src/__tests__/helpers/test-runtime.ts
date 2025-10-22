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
}

/**
 * Create a test runtime with real AgentRuntime
 * Uses actual runtime with controlled test actions
 */
export async function createTestRuntime(config: TestRuntimeConfig = {}): Promise<IAgentRuntime> {
  const testId = config.testId || `test-${uuidv4().slice(0, 8)}`;

  logger.info(`[TestRuntime] Creating test runtime: ${testId}`);

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

  // Create REAL AgentRuntime with SQL plugin and sendo-worker plugin
  const runtime = new AgentRuntime({
    character,
    plugins: [
      sqlPlugin.default, // Required for database adapter
      sendoWorkerPlugin.default, // Required for schema tables
    ],
  });

  // Register test actions (real actions with predictable data)
  if (config.withDataActions) {
    registerTestDataActions(runtime);
  }

  if (config.withActionActions) {
    registerTestActionActions(runtime);
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
 * Register test DATA actions
 * Return predictable data for analysis testing
 * Based on real ElizaOS plugin patterns
 */
function registerTestDataActions(runtime: IAgentRuntime): void {
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

  logger.info('[TestRuntime] Registered 3 DATA actions');
}

/**
 * Register test ACTION actions
 * Simulate on-chain operations
 */
function registerTestActionActions(runtime: IAgentRuntime): void {
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

  logger.info('[TestRuntime] Registered 2 ACTION actions');
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
