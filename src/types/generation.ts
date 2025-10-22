import type { Action, UUID } from '@elizaos/core';

/**
 * Action category: DATA (read-only) or ACTION (write operations)
 */
export type ActionCategory = 'DATA' | 'ACTION';

/**
 * Types of DATA category actions (read-only operations)
 */
export type DataActionType =
  | 'GET_BALANCE'
  | 'GET_PRICE'
  | 'GET_PORTFOLIO'
  | 'GET_TRANSACTIONS'
  | 'GET_NFT'
  | 'GET_MARKET_DATA'
  | 'SEARCH'
  | 'ANALYZE'
  | 'READ';

/**
 * Types of ACTION category actions (write operations)
 */
export type ActionActionType =
  | 'SWAP'
  | 'TRANSFER'
  | 'STAKE'
  | 'UNSTAKE'
  | 'BRIDGE'
  | 'NFT_MINT'
  | 'NFT_TRANSFER'
  | 'LIQUIDITY_ADD'
  | 'LIQUIDITY_REMOVE'
  | 'GOVERNANCE_VOTE';

/**
 * Classification of an action by the LLM
 */
export interface ActionClassification {
  action: Action;
  category: ActionCategory;
  actionType: DataActionType | ActionActionType;
  confidence: number;
  reasoning: string;
  pluginName: string;
}

/**
 * Result from executing a READ-ONLY analysis action
 * (e.g., GET_BALANCE, GET_TOKEN_PRICE)
 */
export interface AnalysisActionResult {
  actionType: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Data collected from a provider during analysis
 */
export interface ProviderDataResult {
  providerName: string;
  data: any;
  timestamp: string;
}

/**
 * Context passed to LLM for generating comprehensive analysis
 */
export interface AnalysisGenerationContext {
  agentId: UUID;

  // Results from executed analysis actions
  analysisResults: AnalysisActionResult[];

  // Data from all available providers
  providerData: ProviderDataResult[];

  // Plugin names that contributed data
  pluginsUsed: string[];

  // Timestamp when analysis started
  timestamp: string;
}
