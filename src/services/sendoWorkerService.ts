import {
  Service,
  IAgentRuntime,
  type UUID,
  logger,
  ModelType,
  type Action,
  type Memory,
  ChannelType,
  createUniqueUuid,
} from '@elizaos/core';
import { eq, desc } from 'drizzle-orm';
import type {
  AnalysisResult,
  RecommendedAction,
  ActionClassification,
  ActionCategorizationResponse,
  ActionActionType,
  DataActionType,
  AnalysisActionResult,
  ProviderDataResult,
} from '../types/index.js';
import {
  actionCategorizationSchema,
  selectRelevantActionsSchema,
  generateAnalysisSchema,
  generateRecommendationSchema,
} from '../types/index.js';
import { analysisResults, recommendedActions } from '../schemas/index.js';
import {
  actionCategorizationPrompt,
  generateDataActionTriggerPrompt,
  selectRelevantDataActionsPrompt,
  generateAnalysisPrompt,
  selectRelevantActionsPrompt,
  generateRecommendationPrompt,
} from '../templates/index.js';
import { getActionResultFromCache, extractErrorMessage } from '../utils/actionResult.js';

export class SendoWorkerService extends Service {
  static serviceType = 'sendo_worker';

  get capabilityDescription(): string {
    return 'Sendo Worker service that manages analysis results and recommended actions';
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[SendoWorkerService] Initializing...');
    this.runtime = runtime;
    logger.info('[SendoWorkerService] Initialized successfully');
  }

  async stop(): Promise<void> {
    logger.info('[SendoWorkerService] Stopping...');
  }

  static async start(runtime: IAgentRuntime): Promise<SendoWorkerService> {
    const service = new SendoWorkerService(runtime);
    await service.initialize(runtime);
    return service;
  }

  /**
   * Get the Drizzle database instance from runtime
   */
  private getDb(): any {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error('Database not available in runtime');
    }
    return db;
  }

  // ============================================
  // DYNAMIC ANALYSIS METHODS
  // ============================================

  /**
   * Categorize all available actions into DATA and ACTION categories
   * Each action is processed in parallel with LLM
   * @returns Object with categorized actions grouped by type
   */
  async categorizeActions(): Promise<{
    dataActions: Map<string, Action[]>;
    actionActions: Map<ActionActionType, Action[]>;
    classifications: ActionClassification[];
  }> {
    logger.info('[SendoWorkerService] Categorizing all available actions...');

    // Get all actions from runtime
    const allActions = Array.from(this.runtime.actions.values());
    logger.info(`[SendoWorkerService] Found ${allActions.length} actions to categorize`);

    // Process each action in parallel
    const classifications = await Promise.all(
      allActions.map((action) => this.categorizeAction(action))
    );

    // Group actions by category and type
    const dataActions = new Map<string, Action[]>();
    const actionActions = new Map<ActionActionType, Action[]>();

    for (const classification of classifications) {
      if (classification.category === 'DATA') {
        const typeActions = dataActions.get(classification.actionType) || [];
        typeActions.push(classification.action);
        dataActions.set(classification.actionType, typeActions);
      } else if (classification.category === 'ACTION') {
        const actionType = classification.actionType as ActionActionType;
        const typeActions = actionActions.get(actionType) || [];
        typeActions.push(classification.action);
        actionActions.set(actionType, typeActions);
      }
    }

    logger.info(
      `[SendoWorkerService] Categorization complete: ${dataActions.size} DATA types, ${actionActions.size} ACTION types`
    );

    return { dataActions, actionActions, classifications };
  }

  /**
   * Categorize a single action using LLM
   * @param action - The action to categorize
   * @returns Classification result
   */
  private async categorizeAction(action: Action): Promise<ActionClassification> {
    const response = (await this.runtime.useModel(ModelType.OBJECT_SMALL, {
      prompt: actionCategorizationPrompt({ action }),
      schema: actionCategorizationSchema,
      temperature: 0.1,
    })) as ActionCategorizationResponse;

    // Extract plugin name from action
    const pluginName = this.extractPluginName(action);

    return {
      action,
      category: response.category,
      actionType: response.actionType as DataActionType | ActionActionType,
      confidence: response.confidence,
      reasoning: response.reasoning,
      pluginName,
    };
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

  /**
   * Collect data from all available providers via composeState
   * @returns Array of provider data results
   */
  async collectProviderData(): Promise<ProviderDataResult[]> {
    logger.info('[SendoWorkerService] Collecting data from providers...');

    // Create a minimal memory for state composition
    const memory: Memory = {
      id: crypto.randomUUID() as UUID,
      entityId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId: crypto.randomUUID() as UUID,
      content: { text: 'Collecting provider data for analysis' },
      createdAt: Date.now(),
    };

    // Compose state - this automatically calls all non-private, non-dynamic providers
    const state = await this.runtime.composeState(memory);

    // Extract provider data from state.data.providers
    const providers = state.data?.providers || {};
    const timestamp = new Date().toISOString();

    const results: ProviderDataResult[] = Object.entries(providers).map(
      ([name, providerResult]) => ({
        providerName: name,
        data: providerResult,
        timestamp,
      })
    );

    logger.info(`[SendoWorkerService] Collected data from ${results.length} providers`);
    return results;
  }

  /**
   * Select relevant DATA actions based on provider data
   * Groups actions by type and selects relevant ones for each type in parallel
   * @param dataActions - Map of DATA actions grouped by type
   * @param providerData - Provider data results
   * @returns Array of relevant DATA actions
   */
  async selectRelevantDataActions(
    dataActions: Map<string, Action[]>,
    providerData: ProviderDataResult[]
  ): Promise<Action[]> {
    logger.info('[SendoWorkerService] Selecting relevant DATA actions...');

    // Process each data action type in parallel
    const selections = await Promise.all(
      Array.from(dataActions.entries()).map(async ([type, actions]) => {
        try {
          const response = await this.runtime.useModel(ModelType.OBJECT_SMALL, {
            prompt: selectRelevantDataActionsPrompt({
              providerData,
              dataActions: actions,
            }),
            schema: selectRelevantActionsSchema,
            temperature: 0.3,
          });

          // Filter selected actions
          const selectedActions = actions.filter((action) =>
            response.relevantActions.includes(action.name)
          );

          logger.debug(
            `[SendoWorkerService] Selected ${selectedActions.length}/${actions.length} ${type} actions`
          );

          return selectedActions;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            `[SendoWorkerService] Failed to select ${type} actions: ${errorMessage}`
          );
          return [];
        }
      })
    );

    // Flatten all selected actions
    const relevantActions = selections.flat();

    logger.info(
      `[SendoWorkerService] Selected ${relevantActions.length} relevant DATA actions`
    );
    return relevantActions;
  }

  /**
   * Execute DATA actions with generated trigger messages
   * @param dataActions - Array of DATA actions to execute
   * @returns Array of action execution results
   */
  async executeAnalysisActions(dataActions: Action[]): Promise<AnalysisActionResult[]> {
    logger.info('[SendoWorkerService] Executing DATA actions...');

    if (dataActions.length === 0) {
      logger.warn('[SendoWorkerService] No DATA actions to execute');
      return [];
    }

    // Create a stable worldId for all actions (agent + month)
    // This allows grouping all analyses from the same agent in the same month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const worldId = createUniqueUuid(
      this.runtime,
      `sendo-worker-${monthKey}`
    );

    // Execute each action in parallel
    const results = await Promise.all(
      dataActions.map(async (action) => {
        try {
          // Generate trigger message for this action
          const triggerMessage = (await this.runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: generateDataActionTriggerPrompt({ action }),
            temperature: 0.2,
          })) as string;

          logger.debug(`[SendoWorkerService] Trigger for ${action.name}: "${triggerMessage.trim()}"`);

          // Create message with unique ID for stateCache retrieval
          const messageId = crypto.randomUUID() as UUID;

          // Ensure room exists in database (unique room per action, shared worldId)
          const roomId = crypto.randomUUID() as UUID;
          await this.runtime.ensureRoomExists({
            id: roomId,
            source: 'sendo-worker',
            type: ChannelType.API,
            worldId,
          });

          const memory: Memory = {
            id: messageId,
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
            content: {
              text: triggerMessage.trim(),
            },
            createdAt: Date.now(),
          };

          // Create responses array with the action to execute
          const responses: Memory[] = [
            {
              id: crypto.randomUUID() as UUID,
              entityId: this.runtime.agentId,
              agentId: this.runtime.agentId,
              roomId: memory.roomId,
              content: {
                text: triggerMessage.trim(),
                actions: [action.name],
              },
              createdAt: Date.now(),
            },
          ];

          // Process the action - this awaits until action completes
          await this.runtime.processActions(memory, responses);

          // Retrieve results from stateCache using helper
          const actionResult = getActionResultFromCache(this.runtime, messageId);

          if (actionResult) {
            logger.debug(
              `[SendoWorkerService] Action ${action.name} completed: success=${actionResult.success}`
            );

            return {
              actionType: action.name,
              success: actionResult.success ?? false,
              data: actionResult.data || actionResult.values || null,
              error: extractErrorMessage(actionResult),
            };
          } else {
            logger.warn(`[SendoWorkerService] No result found in stateCache for ${action.name}`);
            return {
              actionType: action.name,
              success: false,
              data: null,
              error: 'No result returned from action',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[SendoWorkerService] Failed to execute ${action.name}: ${errorMessage}`);
          return {
            actionType: action.name,
            success: false,
            data: null,
            error: errorMessage,
          };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    logger.info(
      `[SendoWorkerService] Executed ${results.length} DATA actions, ${successCount} successful`
    );

    return results;
  }

  /**
   * Generate comprehensive analysis using LLM
   * @param analysisResults - Results from executed DATA actions
   * @param providerData - Data collected from providers
   * @returns Analysis with four sections
   */
  async generateAnalysis(
    analysisResults: AnalysisActionResult[],
    providerData: ProviderDataResult[]
  ): Promise<{
    walletOverview: string;
    marketConditions: string;
    riskAssessment: string;
    opportunities: string;
  }> {
    logger.info('[SendoWorkerService] Generating analysis with LLM...');

    // Extract plugin names from successful results
    const pluginsUsed = [
      ...new Set([
        ...analysisResults.filter((r) => r.success).map((r) => r.actionType.split(':')[0] || 'unknown'),
        ...providerData.map((p) => p.providerName),
      ]),
    ];

    const analysis = await this.runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: generateAnalysisPrompt({
        analysisResults,
        providerData,
        pluginsUsed,
      }),
      schema: generateAnalysisSchema,
      temperature: 0.7,
    });

    logger.info('[SendoWorkerService] Analysis generated successfully');
    return analysis;
  }

  /**
   * Generate recommendations based on analysis and available ACTION actions
   * Uses double parallel processing: by action type, then by individual action
   * @param analysisId - ID of the analysis these recommendations belong to
   * @param analysis - Generated analysis
   * @param actionActions - Map of ACTION category actions grouped by type
   * @returns Array of recommended actions ready to save
   */
  async generateRecommendations(
    analysisId: UUID,
    analysis: {
      walletOverview: string;
      marketConditions: string;
      riskAssessment: string;
      opportunities: string;
    },
    actionActions: Map<ActionActionType, Action[]>
  ): Promise<RecommendedAction[]> {
    logger.info('[SendoWorkerService] Generating recommendations...');

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
            `[SendoWorkerService] Selected ${selectedActions.length}/${actions.length} ${actionType} actions`
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
                  params: recommendation.params,
                  estimatedImpact: recommendation.estimatedImpact,
                  estimatedGas: recommendation.estimatedGas,
                  status: 'pending' as const,
                  createdAt: new Date().toISOString(),
                } as RecommendedAction;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error(
                  `[SendoWorkerService] Failed to generate recommendation for ${action.name}: ${errorMessage}`
                );
                return null;
              }
            })
          );

          return recommendations.filter((r): r is RecommendedAction => r !== null);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(
            `[SendoWorkerService] Failed to process ${actionType} actions: ${errorMessage}`
          );
          return [];
        }
      })
    );

    // Flatten all recommendations
    const finalRecommendations = allRecommendations.flat();

    logger.info(`[SendoWorkerService] Generated ${finalRecommendations.length} recommendations`);
    return finalRecommendations;
  }

  /**
   * Main orchestrator method that runs the complete analysis workflow
   * @param agentId - The agent UUID
   * @param shouldPersist - Whether to save results to database (default: true)
   * @returns Complete analysis result with recommendations
   */
  async runAnalysis(agentId: UUID, shouldPersist: boolean = true): Promise<AnalysisResult> {
    const startTime = Date.now();
    logger.info(`[SendoWorkerService] Starting analysis for agent ${agentId}...`);

    try {
      // 1. Categorize all available actions
      logger.info('[SendoWorkerService] Step 1/6: Categorizing actions...');
      const { dataActions, actionActions, classifications } = await this.categorizeActions();
      logger.info(
        `[SendoWorkerService] Categorized ${classifications.length} actions: ${dataActions.size} DATA types, ${actionActions.size} ACTION types`
      );

      // 2. Collect provider data
      logger.info('[SendoWorkerService] Step 2/6: Collecting provider data...');
      const providerData = await this.collectProviderData();
      logger.info(`[SendoWorkerService] Collected data from ${providerData.length} providers`);

      // 3. Select relevant DATA actions
      logger.info('[SendoWorkerService] Step 3/6: Selecting relevant DATA actions...');
      const relevantDataActions = await this.selectRelevantDataActions(dataActions, providerData);
      logger.info(`[SendoWorkerService] Selected ${relevantDataActions.length} relevant DATA actions`);

      // 4. Execute DATA actions
      logger.info('[SendoWorkerService] Step 4/6: Executing DATA actions...');
      const analysisResults = await this.executeAnalysisActions(relevantDataActions);
      const successfulResults = analysisResults.filter((r) => r.success);
      logger.info(
        `[SendoWorkerService] Executed ${analysisResults.length} actions, ${successfulResults.length} successful`
      );

      // 5. Generate analysis
      logger.info('[SendoWorkerService] Step 5/6: Generating analysis...');
      const analysis = await this.generateAnalysis(analysisResults, providerData);
      logger.info('[SendoWorkerService] Analysis generated successfully');

      // 6. Generate recommendations
      logger.info('[SendoWorkerService] Step 6/6: Generating recommendations...');

      // Create analysis ID for recommendations
      const analysisId = crypto.randomUUID() as UUID;
      const recommendations = await this.generateRecommendations(
        analysisId,
        analysis,
        actionActions
      );
      logger.info(`[SendoWorkerService] Generated ${recommendations.length} recommendations`);

      // Build final result
      const pluginsUsed = [
        ...new Set([
          ...analysisResults.filter((r) => r.success).map((r) => r.actionType.split(':')[0] || 'unknown'),
          ...providerData.map((p) => p.providerName),
        ]),
      ];

      const executionTimeMs = Date.now() - startTime;

      const result: AnalysisResult = {
        id: analysisId,
        agentId,
        timestamp: new Date().toISOString(),
        analysis,
        pluginsUsed,
        executionTimeMs,
        createdAt: new Date().toISOString(),
      };

      // 7. Save to database if requested
      if (shouldPersist) {
        logger.info('[SendoWorkerService] Saving analysis to database...');
        await this.saveAnalysis(result, recommendations);
        logger.info('[SendoWorkerService] Analysis saved successfully');
      }

      logger.info(
        `[SendoWorkerService] ✅ Analysis completed in ${executionTimeMs}ms with ${recommendations.length} recommendations`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[SendoWorkerService] ❌ Analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Save analysis and recommendations to database
   * @param analysis - The analysis result
   * @param recommendations - Array of recommended actions
   */
  private async saveAnalysis(
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
      await db.insert(recommendedActions).values(
        recommendations.map((rec) => ({
          id: rec.id,
          analysisId: analysis.id,
          actionType: rec.actionType,
          pluginName: rec.pluginName,
          priority: rec.priority,
          reasoning: rec.reasoning,
          confidence: rec.confidence.toString(),
          triggerMessage: rec.triggerMessage,
          params: rec.params ?? null,
          estimatedImpact: rec.estimatedImpact ?? null,
          estimatedGas: rec.estimatedGas ?? null,
          status: rec.status,
          createdAt: new Date(rec.createdAt),
        }))
      );
    }

    logger.info(
      `[SendoWorkerService] Saved analysis ${analysis.id} with ${recommendations.length} recommendations`
    );
  }

  // ============================================
  // DECISION & EXECUTION METHODS
  // ============================================

  /**
   * Process decision for one or more actions (accept/reject)
   * - Accept: Executes the action immediately (async)
   * - Reject: Updates status to "rejected" without execution
   * @param decisions - Array of { actionId, decision: 'accept' | 'reject' }
   * @returns Object with accepted and rejected actions
   */
  async processDecisions(
    decisions: Array<{ actionId: string; decision: 'accept' | 'reject' }>
  ): Promise<{
    accepted: RecommendedAction[];
    rejected: Array<{ actionId: string; status: string }>;
  }> {
    logger.info(`[SendoWorkerService] Processing ${decisions.length} decisions...`);

    const accepted: RecommendedAction[] = [];
    const rejected: Array<{ actionId: string; status: string }> = [];
    const db = this.getDb();

    for (const { actionId, decision } of decisions) {
      try {
        if (decision === 'accept') {
          // Accept → Execute the action
          const executingActions = await this.executeActions([actionId]);
          if (executingActions.length > 0) {
            accepted.push(executingActions[0]);
            logger.info(`[SendoWorkerService] Action ${actionId} accepted and executing`);
          }
        } else if (decision === 'reject') {
          // Reject → Just update status
          await db
            .update(recommendedActions)
            .set({
              status: 'rejected',
              decidedAt: new Date(),
            })
            .where(eq(recommendedActions.id, actionId));

          rejected.push({ actionId, status: 'rejected' });
          logger.info(`[SendoWorkerService] Action ${actionId} rejected`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[SendoWorkerService] Failed to process decision for ${actionId}: ${errorMessage}`);
        // Continue processing other decisions
      }
    }

    logger.info(
      `[SendoWorkerService] Decisions processed: ${accepted.length} accepted, ${rejected.length} rejected`
    );

    return { accepted, rejected };
  }

  /**
   * Execute one or more recommended actions asynchronously
   * Changes status to "executing" immediately and processes actions in background
   * Called internally by processDecisions() when decision is "accept"
   * @param actionIds - Array of action IDs to execute
   * @returns Array of actions with status updated to "executing"
   */
  private async executeActions(actionIds: string[]): Promise<RecommendedAction[]> {
    logger.info(`[SendoWorkerService] Starting execution of ${actionIds.length} actions...`);

    if (actionIds.length === 0) {
      logger.warn('[SendoWorkerService] No actions to execute');
      return [];
    }

    const db = this.getDb();
    const executingActions: RecommendedAction[] = [];

    // 1. Update all actions to "executing" status immediately
    for (const actionId of actionIds) {
      try {
        const action = await this.getActionById(actionId);

        await db
          .update(recommendedActions)
          .set({
            status: 'executing',
            decidedAt: new Date(),
          })
          .where(eq(recommendedActions.id, actionId));

        executingActions.push({
          ...action,
          status: 'executing',
          decidedAt: new Date().toISOString(),
        });

        logger.debug(`[SendoWorkerService] Action ${actionId} status → executing`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[SendoWorkerService] Failed to update ${actionId}: ${errorMessage}`);
      }
    }

    // 2. Launch execution asynchronously (don't await)
    this.processExecutingActions(actionIds).catch((error) => {
      logger.error('[SendoWorkerService] Action execution error:', error);
    });

    logger.info(`[SendoWorkerService] ${executingActions.length} actions marked as executing`);
    return executingActions;
  }

  /**
   * Process executing actions and update database with results
   * Called by executeActions() - runs asynchronously
   * @param actionIds - Array of action IDs to process
   */
  private async processExecutingActions(actionIds: string[]): Promise<void> {
    logger.info(`[SendoWorkerService] Processing ${actionIds.length} executing actions...`);

    // Process each action in parallel
    await Promise.all(
      actionIds.map(async (actionId) => {
        try {
          // 1. Get action from database
          const recommendedAction = await this.getActionById(actionId);

          logger.debug(
            `[SendoWorkerService] Processing action ${actionId}: ${recommendedAction.actionType}`
          );

          // 2. Find the actual Action from runtime
          const action = Array.from(this.runtime.actions.values()).find(
            (a) => a.name === recommendedAction.actionType
          );

          if (!action) {
            throw new Error(`Action ${recommendedAction.actionType} not found in runtime`);
          }

          // 3. Create memory with unique ID to trigger the action
          const messageId = crypto.randomUUID() as UUID;
          const memory: Memory = {
            id: messageId,
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId: crypto.randomUUID() as UUID,
            content: {
              text: recommendedAction.triggerMessage,
            },
            createdAt: Date.now(),
          };

          // Create responses array with the action to execute
          const responses: Memory[] = [
            {
              id: crypto.randomUUID() as UUID,
              entityId: this.runtime.agentId,
              agentId: this.runtime.agentId,
              roomId: memory.roomId,
              content: {
                text: recommendedAction.triggerMessage,
                actions: [action.name],
              },
              createdAt: Date.now(),
            },
          ];

          // 4. Process the action - this awaits until action completes
          await this.runtime.processActions(memory, responses);

          // 5. Retrieve results from stateCache using helper
          const actionResult = getActionResultFromCache(this.runtime, messageId);

          const executedAt = new Date();
          const db = this.getDb();

          // 6. Update database with result
          if (actionResult) {
            if (actionResult.success) {
              // Success - extract result from ActionResult
              const resultData = {
                text: actionResult.text || JSON.stringify(actionResult.data || actionResult.values),
                data: actionResult.data || actionResult.values || undefined,
                timestamp: executedAt.toISOString(),
              };

              await db
                .update(recommendedActions)
                .set({
                  status: 'completed',
                  result: resultData,
                  error: null,
                  executedAt,
                })
                .where(eq(recommendedActions.id, actionId));

              logger.info(`[SendoWorkerService] ✅ Action ${actionId} completed successfully`);
            } else {
              // Action failed
              const errorMessage = extractErrorMessage(actionResult, 'Action execution failed');
              await db
                .update(recommendedActions)
                .set({
                  status: 'failed',
                  error: errorMessage,
                  executedAt,
                })
                .where(eq(recommendedActions.id, actionId));

              logger.warn(`[SendoWorkerService] ⚠️ Action ${actionId} failed: ${errorMessage}`);
            }
          } else {
            // No result - mark as failed
            await db
              .update(recommendedActions)
              .set({
                status: 'failed',
                error: 'No result returned from action',
                executedAt,
              })
              .where(eq(recommendedActions.id, actionId));

            logger.warn(`[SendoWorkerService] ⚠️ Action ${actionId} failed: no result`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[SendoWorkerService] ❌ Action ${actionId} failed: ${errorMessage}`);

          // Update database with error
          const db = this.getDb();
          await db
            .update(recommendedActions)
            .set({
              status: 'failed',
              error: errorMessage,
              executedAt: new Date(),
            })
            .where(eq(recommendedActions.id, actionId));
        }
      })
    );

    logger.info('[SendoWorkerService] Action processing completed');
  }

  // ============================================
  // READ METHODS
  // ============================================

  /**
   * Get all analyses for an agent (limited to 10 most recent)
   * @param agentId - The agent UUID
   * @returns Array of analysis results
   */
  async getAnalysesByAgentId(agentId: UUID): Promise<AnalysisResult[]> {
    logger.info(`[SendoWorkerService] Getting analyses for agent ${agentId}`);

    const db = this.getDb();
    const results = await db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.agentId, agentId))
      .orderBy(desc(analysisResults.createdAt))
      .limit(10);

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
    logger.info(`[SendoWorkerService] Getting actions for analysis ${analysisId}`);

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
      priority: row.priority as 'high' | 'medium' | 'low',
      reasoning: row.reasoning,
      confidence: parseFloat(row.confidence ?? '0'),
      triggerMessage: row.triggerMessage,
      params: row.params as any,
      estimatedImpact: row.estimatedImpact ?? undefined,
      estimatedGas: row.estimatedGas ?? undefined,
      status: row.status as any,
      decidedAt: row.decidedAt?.toISOString(),
      executedAt: row.executedAt?.toISOString(),
      result: row.result as any,
      error: row.error ?? undefined,
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
    logger.info(`[SendoWorkerService] Getting action ${actionId}`);

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
      priority: row.priority as 'high' | 'medium' | 'low',
      reasoning: row.reasoning,
      confidence: parseFloat(row.confidence ?? '0'),
      triggerMessage: row.triggerMessage,
      params: row.params as any,
      estimatedImpact: row.estimatedImpact ?? undefined,
      estimatedGas: row.estimatedGas ?? undefined,
      status: row.status as any,
      decidedAt: row.decidedAt?.toISOString(),
      executedAt: row.executedAt?.toISOString(),
      result: row.result as any,
      error: row.error ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

}

export default SendoWorkerService;
