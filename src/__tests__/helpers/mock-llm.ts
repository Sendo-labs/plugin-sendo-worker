/**
 * LLM Mock Helper
 *
 * Provides robust LLM mocking based on prompt templates instead of pattern matching.
 */

import type { IAgentRuntime, Action } from '@elizaos/core';
import {
  getCategorizationResponse,
  getTriggerMessage,
  getRecommendation,
  relevantActionsFixtures,
  analysisFixtures,
} from '../fixtures/llm-responses.js';

/**
 * Mock LLM options
 */
export interface MockLLMOptions {
  /** Use fixtures for all responses (default: true) */
  useFixtures?: boolean;
  /** Log prompts for debugging (default: false) */
  logPrompts?: boolean;
  /** Custom response overrides */
  overrides?: {
    categorization?: (action: Action) => any;
    triggerMessage?: (action: Action) => string;
    recommendation?: (action: Action) => any;
    analysis?: () => any;
    relevantActions?: () => any;
  };
}

/**
 * Extract action name from prompt (tries multiple formats)
 */
function extractActionName(prompt: string): string | null {
  // Try **Action Name:** format first
  let match = prompt.match(/\*\*Action Name:\*\*\s*([A-Z_a-z]+)/);
  if (match) return match[1];

  // Try **Name:** format
  match = prompt.match(/\*\*Name:\*\*\s*([A-Z_a-z]+)/);
  if (match) return match[1];

  return null;
}

/**
 * Setup LLM mock on a runtime
 *
 * This replaces runtime.useModel() with a mock that returns appropriate responses
 * based on the prompt type (detected via template patterns).
 */
export function setupLLMMock(runtime: IAgentRuntime, options: MockLLMOptions = {}) {
  const { useFixtures = true, logPrompts = false, overrides = {} } = options;

  runtime.useModel = ((modelType: any, params: any) => {
    const prompt = params.prompt || '';

    if (logPrompts) {
      console.log(`[LLM Mock] Model: ${modelType}, Prompt length: ${prompt.length}`);
      console.log(`[LLM Mock] Prompt preview: ${prompt.substring(0, 500)}...`);
    }

    // Detect prompt type by content

    // 1. Action Categorization
    if (
      prompt.includes('action classifier') ||
      prompt.includes('Categorize this action') ||
      prompt.includes('DATA or ACTION') ||
      (prompt.includes('Main Categories') && prompt.includes('category'))
    ) {
      const actionName = extractActionName(prompt);
      if (actionName) {
        const mockAction = { name: actionName } as Action;

        if (overrides.categorization) {
          return Promise.resolve(overrides.categorization(mockAction));
        }

        if (useFixtures) {
          return Promise.resolve(getCategorizationResponse(mockAction));
        }
      }

      // Fallback
      return Promise.resolve({
        category: 'DATA',
        actionType: 'unknown',
        confidence: 0.5,
        reasoning: 'Mock fallback',
      });
    }

    // 2. Trigger Message Generation
    if (
      prompt.includes('Generate a trigger message') ||
      prompt.includes('trigger this action') ||
      prompt.includes('natural language trigger')
    ) {
      const actionName = extractActionName(prompt);
      if (actionName) {
        const mockAction = { name: actionName } as Action;

        if (overrides.triggerMessage) {
          return Promise.resolve(overrides.triggerMessage(mockAction));
        }

        if (useFixtures) {
          return Promise.resolve(getTriggerMessage(mockAction));
        }
      }

      return Promise.resolve('Execute action');
    }

    // 3. Relevant Actions Selection
    if (
      prompt.includes('Select relevant') ||
      prompt.includes('which actions are relevant') ||
      prompt.includes('analyzing which blockchain actions') ||
      prompt.includes('determine which DATA actions') ||
      prompt.includes('determining which data collection actions')
    ) {
      if (overrides.relevantActions) {
        return Promise.resolve(overrides.relevantActions());
      }

      if (useFixtures) {
        // Check if this is for ACTION actions (contains action names like SWAP, REBALANCE, EXECUTE)
        if (
          prompt.includes('SWAP') ||
          prompt.includes('REBALANCE') ||
          prompt.includes('EXECUTE_') ||
          prompt.includes('TRANSFER')
        ) {
          // Return ACTION action names - select REBALANCE_PORTFOLIO by default
          return Promise.resolve({
            relevantActions: ['REBALANCE_PORTFOLIO'],
            reasoning: 'Portfolio rebalancing recommended based on analysis',
          });
        }

        // For DATA actions, check for context clues
        if (prompt.includes('DeFi') || prompt.includes('staking') || prompt.includes('lending')) {
          return Promise.resolve(relevantActionsFixtures.defiAnalysis);
        }
        if (prompt.includes('risk') || prompt.includes('health')) {
          return Promise.resolve(relevantActionsFixtures.riskFocused);
        }
        if (prompt.includes('NFT') || prompt.includes('nft')) {
          return Promise.resolve(relevantActionsFixtures.nftAnalysis);
        }
        if (prompt.includes('trading') || prompt.includes('price') || prompt.includes('liquidity')) {
          return Promise.resolve(relevantActionsFixtures.tradingOpportunities);
        }

        // Default - basic analysis
        return Promise.resolve(relevantActionsFixtures.default);
      }

      return Promise.resolve({ relevantActions: [], reasoning: 'Mock' });
    }

    // 4. Analysis Generation
    if (
      prompt.includes('Generate a comprehensive analysis') ||
      prompt.includes('walletOverview') ||
      prompt.includes('marketConditions')
    ) {
      if (overrides.analysis) {
        return Promise.resolve(overrides.analysis());
      }

      if (useFixtures) {
        // Check for market condition hints
        if (prompt.includes('bull') || prompt.includes('up') || prompt.includes('+')) {
          return Promise.resolve(analysisFixtures.bullMarket);
        }
        if (prompt.includes('bear') || prompt.includes('down') || prompt.includes('-')) {
          return Promise.resolve(analysisFixtures.bearMarket);
        }
        return Promise.resolve(analysisFixtures.default);
      }

      return Promise.resolve({
        walletOverview: 'Mock wallet',
        marketConditions: 'Mock market',
        riskAssessment: 'Mock risk',
        opportunities: 'Mock opportunities',
      });
    }

    // 5. Recommendation Generation
    if (
      prompt.includes('Generate a recommendation') ||
      prompt.includes('should the agent') ||
      prompt.includes('Generate a complete recommendation') ||
      prompt.includes('generating a specific action recommendation')
    ) {
      const actionName = extractActionName(prompt);
      if (actionName) {
        const mockAction = { name: actionName } as Action;

        if (overrides.recommendation) {
          return Promise.resolve(overrides.recommendation(mockAction));
        }

        if (useFixtures) {
          return Promise.resolve(getRecommendation(mockAction));
        }
      }

      return Promise.resolve({
        actionType: 'UNKNOWN',
        pluginName: 'unknown',
        priority: 'medium',
        reasoning: 'Mock',
        confidence: 0.5,
        triggerMessage: 'Mock action',
        params: {},
        estimatedImpact: 'Unknown',
        estimatedGas: 'Unknown',
      });
    }

    // Fallback - return empty string for TEXT models, empty object for OBJECT models
    if (logPrompts) {
      console.warn(`[LLM Mock] Unrecognized prompt type - using fallback`);
    }

    return Promise.resolve(modelType.includes('TEXT') ? '' : {});
  }) as any;

  return runtime;
}

/**
 * Create a basic LLM mock that just returns reasonable defaults
 * Useful for tests that don't care about LLM responses
 */
export function createBasicLLMMock(runtime: IAgentRuntime) {
  runtime.useModel = (() => {
    return Promise.resolve({});
  }) as any;

  return runtime;
}
