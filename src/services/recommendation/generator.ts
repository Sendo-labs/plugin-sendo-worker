import { IAgentRuntime, logger, ModelType, UUID, type Action } from '@elizaos/core';
import type { ActionActionType, RecommendedAction } from '../../types/index';
import {
  selectRelevantActionsSchema,
  generateRecommendationSchema,
} from '../../types/index';
import {
  selectRelevantActionsPrompt,
  generateRecommendationPrompt,
} from '../../templates/index';

/**
 * RecommendationGenerator
 *
 * Generates action recommendations based on analysis results.
 * Uses double parallel processing: by action type, then by individual action.
 */
export class RecommendationGenerator {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Generate recommendations based on analysis and available ACTION actions
   * @param analysisId - ID of the analysis these recommendations belong to
   * @param analysis - Generated analysis
   * @param actionActions - Map of ACTION category actions grouped by type
   * @returns Array of recommended actions ready to save
   */
  async generate(
    analysisId: UUID,
    analysis: {
      walletOverview: string;
      marketConditions: string;
      riskAssessment: string;
      opportunities: string;
    },
    actionActions: Map<ActionActionType, Action[]>
  ): Promise<RecommendedAction[]> {
    logger.info('[RecommendationGenerator] Generating recommendations...');

    // Process each action type in parallel
    const allRecommendations = await Promise.all(
      Array.from(actionActions.entries()).map(async ([actionType, actions]) => {
        try {
          // 1. Select relevant actions for this type
          const selection = await this.runtime.useModel(ModelType.OBJECT_SMALL, {
            prompt: selectRelevantActionsPrompt({
              analysis,
              actionType,
              actions,
            }),
            schema: selectRelevantActionsSchema,
            temperature: 0.3,
          });

          // 2. Filter selected actions
          const selectedActions = actions.filter((action) =>
            selection.relevantActions.includes(action.name)
          );

          logger.debug(
            `[RecommendationGenerator] Selected ${selectedActions.length}/${actions.length} ${actionType} actions`
          );

          if (selectedActions.length === 0) {
            return [];
          }

          // 3. Generate recommendations for each selected action in parallel
          const recommendations = await Promise.all(
            selectedActions.map(async (action) => {
              try {
                const pluginName = this.extractPluginName(action);

                const recommendation = await this.runtime.useModel(ModelType.OBJECT_SMALL, {
                  prompt: generateRecommendationPrompt({
                    analysis,
                    action,
                    pluginName,
                  }),
                  schema: generateRecommendationSchema,
                  temperature: 0.2,
                });

                // Transform params from key-value array to object for frontend
                let parsedParams: Record<string, any> | undefined;
                if (
                  recommendation.params &&
                  Array.isArray(recommendation.params) &&
                  recommendation.params.length > 0
                ) {
                  parsedParams = recommendation.params.reduce(
                    (acc: Record<string, any>, { key, value }: { key: string; value: any }) => {
                      acc[key] = value;
                      return acc;
                    },
                    {} as Record<string, any>
                  );
                }

                // Build complete RecommendedAction
                return {
                  id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  analysisId,
                  actionType: recommendation.actionType,
                  pluginName: recommendation.pluginName,
                  priority: recommendation.priority as 'high' | 'medium' | 'low',
                  reasoning: recommendation.reasoning,
                  confidence: recommendation.confidence,
                  triggerMessage: recommendation.triggerMessage,
                  params: parsedParams,
                  estimatedImpact: recommendation.estimatedImpact,
                  status: 'pending' as const,
                  createdAt: new Date().toISOString(),
                } as RecommendedAction;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(
                  `[RecommendationGenerator] Failed to generate recommendation for ${action.name}: ${errorMessage}`
                );
                // Log full error for debugging
                if (error instanceof Error && error.stack) {
                  logger.error(`[RecommendationGenerator] Stack trace: ${error.stack}`);
                }
                logger.error(`[RecommendationGenerator] Full error object: ${JSON.stringify(error, null, 2)}`);
                return null;
              }
            })
          );

          return recommendations.filter((r): r is RecommendedAction => r !== null);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            `[RecommendationGenerator] Failed to process ${actionType} actions: ${errorMessage}`
          );
          return [];
        }
      })
    );

    // Flatten all recommendations
    const finalRecommendations = allRecommendations.flat();

    logger.info(`[RecommendationGenerator] Generated ${finalRecommendations.length} recommendations`);
    return finalRecommendations;
  }

  /**
   * Extract plugin name from action
   * @param action - The action
   * @returns Plugin name or 'unknown'
   */
  private extractPluginName(action: Action): string {
    // Try to extract from action metadata
    if ((action as any).plugin) {
      return (action as any).plugin;
    }

    // Fallback: try to extract from action name if it has a prefix
    const nameParts = action.name.split(':');
    if (nameParts.length > 1) {
      return nameParts[0];
    }

    return 'unknown';
  }
}
