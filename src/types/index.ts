/**
 * Type definitions for plugin-sendo-worker
 */

// Analysis results
export type {
  AnalysisResult,
} from './analysis.js';

// Actions and recommendations
export type {
  RecommendedAction,
  ActionDecision,
} from './actions.js';

// Analysis generation workflow
export type {
  ActionCategory,
  DataActionType,
  ActionActionType,
  ActionClassification,
  AnalysisActionResult,
  ProviderDataResult,
  AnalysisGenerationContext,
} from './generation.js';

// Schemas for LLM validation
export {
  actionCategorizationSchema,
  selectRelevantActionsSchema,
  generateRecommendationSchema,
  generateAnalysisSchema,
} from './schemas.js';
export type {
  ActionCategorizationResponse,
  SelectRelevantActionsResponse,
  GenerateRecommendationResponse,
  GenerateAnalysisResponse,
} from './schemas.js';

// API types
export type {
  GetAnalysesData,
  GetAnalysisByIdData,
  RunAnalysisData,
  GetAnalysisActionsData,
  GetActionData,
  DecideActionsRequestBody,
  DecideActionsData,
} from './api.js';
