import { logger, UUID } from '@elizaos/core';
import { eq, desc } from 'drizzle-orm';
import { analysisResults, recommendedActions } from '../../schemas/index';
import type { AnalysisResult, RecommendedAction } from '../../types/index';

// Priority mappings
const PRIORITY_VALUES = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

const PRIORITY_NAMES = {
  3: 'high',
  2: 'medium',
  1: 'low',
} as const;

/**
 * AnalysisRepository
 *
 * Handles all database operations for analyses and recommended actions.
 * Provides CRUD operations with proper type conversion between DB and application types.
 */
export class AnalysisRepository {
  constructor(private getDb: () => any) {}

  /**
   * Save analysis and recommendations to database
   * @param analysis - The analysis result
   * @param recommendations - Array of recommended actions
   */
  async saveAnalysis(
    analysis: AnalysisResult,
    recommendations: RecommendedAction[]
  ): Promise<void> {
    const db = this.getDb();

    // 1. Insert analysis result
    await db.insert(analysisResults).values({
      id: analysis.id,
      agentId: analysis.agentId,
      analysis: analysis.analysis,
      pluginsUsed: analysis.pluginsUsed,
      executionTimeMs: analysis.executionTimeMs,
      createdAt: new Date(analysis.createdAt),
    });

    // 2. Insert recommended actions
    if (recommendations.length > 0) {
      // Filter out any null/undefined recommendations
      const validRecs = recommendations.filter((rec) => rec != null && rec.confidence != null);

      if (validRecs.length > 0) {
        await db.insert(recommendedActions).values(
          validRecs.map((rec) => ({
            id: rec.id,
            analysisId: analysis.id,
            actionType: rec.actionType,
            pluginName: rec.pluginName,
            priority: PRIORITY_VALUES[rec.priority],
            reasoning: rec.reasoning,
            confidence: rec.confidence.toString(),
            triggerMessage: rec.triggerMessage,
            params: rec.params ?? null,
            estimatedImpact: rec.estimatedImpact ?? null,
            status: rec.status,
            createdAt: new Date(rec.createdAt),
          }))
        );
      }
    }

    logger.info(
      `[AnalysisRepository] Saved analysis ${analysis.id} with ${recommendations.length} recommendations`
    );
  }

  /**
   * Get a single analysis by ID with its recommended actions
   * @param analysisId - The analysis UUID
   * @returns The analysis result with actions, or null if not found
   */
  async getAnalysisResult(
    analysisId: UUID
  ): Promise<(AnalysisResult & { recommendedActions: RecommendedAction[] }) | null> {
    logger.info(`[AnalysisRepository] Getting analysis ${analysisId}`);

    const db = this.getDb();
    const results = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.id, analysisId))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

    // Also fetch the recommended actions for this analysis
    const actions = await db
      .select()
      .from(recommendedActions)
      .where(eq(recommendedActions.analysisId, analysisId));

    const recommendedActionsList: RecommendedAction[] = actions.map((action: any) => ({
      id: action.id as UUID,
      analysisId: action.analysisId as UUID,
      actionType: action.actionType,
      pluginName: action.pluginName,
      priority: PRIORITY_NAMES[action.priority as keyof typeof PRIORITY_NAMES] || 'medium',
      reasoning: action.reasoning,
      confidence: parseFloat(action.confidence),
      triggerMessage: action.triggerMessage,
      params: action.params as Record<string, any>,
      estimatedImpact: action.estimatedImpact,
      status: action.status as 'pending' | 'rejected' | 'executing' | 'completed' | 'failed',
      executedAt: action.executedAt?.toISOString() ?? undefined,
      error: action.error ?? undefined,
      errorType: action.errorType ?? undefined,
      createdAt: action.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    return {
      id: row.id as UUID,
      agentId: row.agentId as UUID,
      timestamp: row.createdAt?.toISOString() ?? new Date().toISOString(),
      analysis: row.analysis as any,
      pluginsUsed: row.pluginsUsed ?? [],
      executionTimeMs: row.executionTimeMs ?? 0,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      recommendedActions: recommendedActionsList,
    };
  }

  /**
   * Get all analyses for an agent (limited to most recent)
   * @param agentId - The agent UUID
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of analysis results
   */
  async getAnalysesByAgentId(agentId: UUID, limit: number = 10): Promise<AnalysisResult[]> {
    logger.info(`[AnalysisRepository] Getting analyses for agent ${agentId}`);

    const db = this.getDb();
    const results = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.agentId, agentId))
      .orderBy(desc(analysisResults.createdAt))
      .limit(limit);

    return results.map((row: any) => ({
      id: row.id as UUID,
      agentId: row.agentId as UUID,
      timestamp: row.createdAt?.toISOString() ?? new Date().toISOString(),
      analysis: row.analysis as any,
      pluginsUsed: row.pluginsUsed ?? [],
      executionTimeMs: row.executionTimeMs ?? 0,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  /**
   * Get all actions for an analysis, sorted by priority and confidence
   * @param analysisId - The analysis UUID
   * @returns Array of recommended actions
   */
  async getActionsByAnalysisId(analysisId: UUID): Promise<RecommendedAction[]> {
    logger.info(`[AnalysisRepository] Getting actions for analysis ${analysisId}`);

    const db = this.getDb();
    const results = await db
      .select()
      .from(recommendedActions)
      .where(eq(recommendedActions.analysisId, analysisId))
      .orderBy(desc(recommendedActions.priority), desc(recommendedActions.confidence));

    return results.map((row: any) => ({
      id: row.id,
      analysisId: row.analysisId as UUID,
      actionType: row.actionType,
      pluginName: row.pluginName,
      priority: PRIORITY_NAMES[row.priority as keyof typeof PRIORITY_NAMES] || 'medium',
      reasoning: row.reasoning,
      confidence: parseFloat(row.confidence ?? '0'),
      triggerMessage: row.triggerMessage,
      params: row.params as any,
      estimatedImpact: row.estimatedImpact ?? undefined,
      status: row.status as any,
      decidedAt: row.decidedAt?.toISOString(),
      executedAt: row.executedAt?.toISOString(),
      result: row.result as any,
      error: row.error ?? undefined,
      errorType: row.errorType ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  /**
   * Get a specific action by ID
   * @param actionId - The action ID
   * @returns The recommended action
   * @throws {Error} If action not found
   */
  async getActionById(actionId: string): Promise<RecommendedAction> {
    logger.info(`[AnalysisRepository] Getting action ${actionId}`);

    const db = this.getDb();
    const results = await db
      .select()
      .from(recommendedActions)
      .where(eq(recommendedActions.id, actionId))
      .limit(1);

    if (results.length === 0) {
      throw new Error('Action not found');
    }

    const row = results[0];
    return {
      id: row.id,
      analysisId: row.analysisId as UUID,
      actionType: row.actionType,
      pluginName: row.pluginName,
      priority: PRIORITY_NAMES[row.priority as keyof typeof PRIORITY_NAMES] || 'medium',
      reasoning: row.reasoning,
      confidence: parseFloat(row.confidence ?? '0'),
      triggerMessage: row.triggerMessage,
      params: row.params as any,
      estimatedImpact: row.estimatedImpact ?? undefined,
      status: row.status as any,
      decidedAt: row.decidedAt?.toISOString(),
      executedAt: row.executedAt?.toISOString(),
      result: row.result as any,
      error: row.error ?? undefined,
      errorType: row.errorType ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
