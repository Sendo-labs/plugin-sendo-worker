import type { UUID } from '@elizaos/core';

/**
 * Represents a recommended action from an analysis
 */
export interface RecommendedAction {
  id: string;
  analysisId: UUID;

  // Type and source
  actionType: string; // Example: "SWAP_TOKEN"
  pluginName: string; // Example: "plugin-swap"

  // Priority and confidence
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  confidence: number; // 0-1

  // ⭐ Message that triggers the action
  triggerMessage: string;

  // Optional parameters
  params?: Record<string, any>;

  // UI metadata
  estimatedImpact?: string;
  estimatedGas?: string;

  // State and execution
  status: 'pending' | 'accepted' | 'rejected' | 'executing' | 'completed' | 'failed';
  decidedAt?: string;
  executedAt?: string;

  // Result (saved by Frontend)
  result?: {
    text: string;
    data?: any;
    timestamp: string;
  };
  error?: string;

  createdAt: string;
}

/**
 * Represents a user decision on an action
 */
export interface ActionDecision {
  actionId: string;
  decision: 'accept' | 'reject';
}

/**
 * Result data for updating an action after execution
 */
export interface ActionResultUpdate {
  status: 'executing' | 'completed' | 'failed';
  result?: {
    text: string;
    data?: any;
    timestamp: string;
  };
  error?: string;
}
