/**
 * API request/response types for plugin-sendo-worker routes
 *
 * All routes follow ElizaOS standard response format:
 * - Success: { success: true, data: {...} }
 * - Error: { success: false, error: { code, message, details? } }
 */

import type { AnalysisResult, RecommendedAction, ActionDecision } from './index.js';

// ============================================
// GET /analysis?limit=10
// ============================================
export interface GetAnalysesData {
  analyses: AnalysisResult[];
  count: number;
  limit: number;
}

// ============================================
// GET /analysis/:analysisId
// ============================================
export interface GetAnalysisByIdData {
  analysis: AnalysisResult & {
    recommendedActions: RecommendedAction[];
  };
}

// ============================================
// POST /analysis
// ============================================
export interface RunAnalysisData {
  message: string;
  analysis: AnalysisResult & {
    recommendedActions: RecommendedAction[];
  };
}

// ============================================
// GET /analysis/:analysisId/actions
// ============================================
export interface GetAnalysisActionsData {
  actions: RecommendedAction[];
}

// ============================================
// GET /action/:actionId
// ============================================
export interface GetActionData {
  action: RecommendedAction;
}

// ============================================
// POST /actions/decide
// ============================================
export interface DecideActionsRequestBody {
  decisions: ActionDecision[];
}

export interface DecideActionsData {
  processed: number;
  accepted: RecommendedAction[];
  rejected: Array<{
    actionId: string;
    status: 'rejected';
  }>;
}
