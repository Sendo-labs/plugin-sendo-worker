/**
 * LLM Response Fixtures
 *
 * Provides predefined LLM responses based on prompt templates.
 * This is more robust than pattern matching on action names.
 */

import type { Action } from '@elizaos/core';

/**
 * Action categorization responses
 * Maps action names to their expected categorization
 */
export const actionCategorizationFixtures: Record<string, {
  category: 'DATA' | 'ACTION';
  actionType: string;
  confidence: number;
  reasoning: string;
}> = {
  // DATA actions
  'GET_WALLET_BALANCE': {
    category: 'DATA',
    actionType: 'wallet_balance',
    confidence: 0.95,
    reasoning: 'Retrieves wallet balance information - pure data query with no state changes',
  },
  'GET_MARKET_DATA': {
    category: 'DATA',
    actionType: 'market_data',
    confidence: 0.90,
    reasoning: 'Fetches market data and prices - read-only operation',
  },
  'ASSESS_PORTFOLIO_RISK': {
    category: 'DATA',
    actionType: 'risk_assessment',
    confidence: 0.85,
    reasoning: 'Analyzes portfolio risk - computational analysis without blockchain interaction',
  },

  // ACTION actions
  'EXECUTE_SWAP': {
    category: 'ACTION',
    actionType: 'swap',
    confidence: 0.95,
    reasoning: 'Executes token swap - modifies blockchain state',
  },
  'REBALANCE_PORTFOLIO': {
    category: 'ACTION',
    actionType: 'rebalance',
    confidence: 0.90,
    reasoning: 'Rebalances portfolio allocation - executes multiple swaps',
  },
};

/**
 * Relevant actions selection responses
 * Maps context to selected action names
 */
export const relevantActionsFixtures = {
  // When provider data shows low SOL balance
  lowSolBalance: {
    relevantActions: ['GET_WALLET_BALANCE', 'GET_MARKET_DATA'],
    reasoning: 'Need balance and market data to assess situation',
  },

  // When provider data shows high USDC balance
  highUsdcBalance: {
    relevantActions: ['GET_MARKET_DATA', 'ASSESS_PORTFOLIO_RISK'],
    reasoning: 'Need market data and risk assessment for investment decisions',
  },

  // Default - select all DATA actions
  default: {
    relevantActions: ['GET_WALLET_BALANCE', 'GET_MARKET_DATA', 'ASSESS_PORTFOLIO_RISK'],
    reasoning: 'Comprehensive analysis requires all available data',
  },
};

/**
 * Analysis generation responses
 */
export const analysisFixtures = {
  default: {
    walletOverview: 'Wallet holds 10 SOL and 500 USDC across Solana mainnet',
    marketConditions: 'SOL trading at $150 with bullish sentiment',
    riskAssessment: 'Medium risk - concentrated position in SOL',
    opportunities: 'Consider diversifying into USDC or staking SOL for yield',
  },

  bullMarket: {
    walletOverview: 'Wallet holds 10 SOL and 500 USDC, total value ~$2000',
    marketConditions: 'Strong bull market - SOL up 20% this week, high volume',
    riskAssessment: 'Low risk - favorable market conditions',
    opportunities: 'Good time to stake SOL or enter leveraged positions',
  },

  bearMarket: {
    walletOverview: 'Wallet holds 10 SOL and 500 USDC, total value declining',
    marketConditions: 'Bear market - SOL down 15%, low liquidity',
    riskAssessment: 'High risk - market downturn, consider reducing exposure',
    opportunities: 'Move to stablecoins or exit positions to preserve capital',
  },
};

/**
 * Recommendation generation responses
 */
export const recommendationFixtures: Record<string, {
  actionType: string;
  pluginName: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  confidence: number;
  triggerMessage: string;
  params: Record<string, any>;
  estimatedImpact: string;
  estimatedGas: string;
}> = {
  'EXECUTE_SWAP': {
    actionType: 'EXECUTE_SWAP',
    pluginName: 'plugin-swap',
    priority: 'high',
    reasoning: 'High USDC allocation should be balanced with SOL exposure',
    confidence: 0.85,
    triggerMessage: 'Swap 250 USDC to SOL at current market price',
    params: {
      from: 'USDC',
      to: 'SOL',
      amount: 250,
      slippage: 0.01,
    },
    estimatedImpact: 'Increase SOL holdings by ~1.67 SOL',
    estimatedGas: '~0.00001 SOL',
  },

  'REBALANCE_PORTFOLIO': {
    actionType: 'REBALANCE_PORTFOLIO',
    pluginName: 'plugin-portfolio',
    priority: 'medium',
    reasoning: 'Portfolio drift detected - rebalance to target 50/50 allocation',
    confidence: 0.75,
    triggerMessage: 'Rebalance portfolio to 50% SOL / 50% USDC',
    params: {
      targetAllocation: {
        SOL: 0.5,
        USDC: 0.5,
      },
    },
    estimatedImpact: 'Restore target allocation',
    estimatedGas: '~0.00002 SOL',
  },
};

/**
 * Trigger message generation responses
 */
export const triggerMessageFixtures: Record<string, string> = {
  'GET_WALLET_BALANCE': 'Get current wallet balance for SOL and USDC',
  'GET_MARKET_DATA': 'Fetch latest market data for SOL',
  'ASSESS_PORTFOLIO_RISK': 'Assess current portfolio risk level',
  'EXECUTE_SWAP': 'Swap 250 USDC to SOL',
  'REBALANCE_PORTFOLIO': 'Rebalance portfolio to target allocation',
};

/**
 * Helper to get categorization response for an action
 */
export function getCategorizationResponse(action: Action) {
  const fixture = actionCategorizationFixtures[action.name];

  if (fixture) {
    return fixture;
  }

  // Fallback based on action name patterns
  if (action.name.includes('GET_') || action.name.includes('ASSESS_')) {
    return {
      category: 'DATA' as const,
      actionType: 'unknown_data',
      confidence: 0.7,
      reasoning: 'Action appears to be data retrieval based on name',
    };
  }

  if (action.name.includes('EXECUTE_') || action.name.includes('REBALANCE_')) {
    return {
      category: 'ACTION' as const,
      actionType: 'unknown_action',
      confidence: 0.7,
      reasoning: 'Action appears to execute operations based on name',
    };
  }

  // Ultimate fallback
  return {
    category: 'DATA' as const,
    actionType: 'unknown',
    confidence: 0.5,
    reasoning: 'Unable to categorize action - defaulting to DATA',
  };
}

/**
 * Helper to get trigger message for an action
 */
export function getTriggerMessage(action: Action): string {
  return triggerMessageFixtures[action.name] || `Execute ${action.name}`;
}

/**
 * Helper to get recommendation for an action
 */
export function getRecommendation(action: Action) {
  const fixture = recommendationFixtures[action.name];

  if (fixture) {
    return fixture;
  }

  // Fallback recommendation
  return {
    actionType: action.name,
    pluginName: 'unknown',
    priority: 'medium' as const,
    reasoning: `Generated recommendation for ${action.name}`,
    confidence: 0.7,
    triggerMessage: `Execute ${action.name}`,
    params: {},
    estimatedImpact: 'Unknown impact',
    estimatedGas: 'Unknown',
  };
}
