import {
  Service,
  IAgentRuntime,
  type UUID,
  logger,
  createUniqueUuid,
} from '@elizaos/core';
import type {
  AnalysisResult,
  RecommendedAction,
  ActionActionType,
} from '../types/index';
import { WorldManager } from '../utils/worldManager';
import { ProviderCollector, DataSelector, DataExecutor } from './data';
import { ActionCategorizer, AnalysisGenerator } from './analysis';
import { RecommendationGenerator, DecisionProcessor } from './recommendation';
import { AnalysisRepository } from './persistence';

/**
 * SendoWorkerService
 *
 * Main orchestrator service for the Sendo Worker plugin.
 * Manages the complete analysis workflow from data collection to action recommendations.
 */
export class SendoWorkerService extends Service {
  static serviceType = 'sendo_worker';

  // Module instances
  private worldManager!: WorldManager;
  private providerCollector!: ProviderCollector;
  private dataSelector!: DataSelector;
  private dataExecutor!: DataExecutor;
  private actionCategorizer!: ActionCategorizer;
  private analysisGenerator!: AnalysisGenerator;
  private recommendationGenerator!: RecommendationGenerator;
  private decisionProcessor!: DecisionProcessor;
  private repository!: AnalysisRepository;

  get capabilityDescription(): string {
    return 'Sendo Worker service that manages analysis results and recommended actions';
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[SendoWorkerService] Initializing...');
    this.runtime = runtime;

    // Initialize all module instances
    this.worldManager = new WorldManager(runtime);
    this.providerCollector = new ProviderCollector(runtime);
    this.dataSelector = new DataSelector(runtime);
    this.dataExecutor = new DataExecutor(runtime, this.getAgentWorldId.bind(this));
    this.actionCategorizer = new ActionCategorizer(runtime);
    this.analysisGenerator = new AnalysisGenerator(runtime);
    this.recommendationGenerator = new RecommendationGenerator(runtime);
    this.decisionProcessor = new DecisionProcessor(
      runtime,
      this.getDb.bind(this),
      this.getAgentWorldId.bind(this),
      this.getActionById.bind(this)
    );
    this.repository = new AnalysisRepository(this.getDb.bind(this));

    // Ensure agent's permanent world exists
    await this.worldManager.ensureAgentWorldExists();

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

  /**
   * Get the permanent worldId for this agent
   */
  private getAgentWorldId(): UUID {
    return createUniqueUuid(
      this.runtime,
      `sendo-agent-${this.runtime.agentId}`
    ) as UUID;
  }

  // ============================================
  // MAIN WORKFLOW METHOD
  // ============================================

  /**
   * Main orchestrator method that runs the complete analysis workflow
   * @param agentId - The agent UUID
   * @returns Complete analysis result with recommendations
   */
  async runAnalysis(
    agentId: UUID
  ): Promise<AnalysisResult & { recommendedActions: RecommendedAction[] }> {
    const startTime = Date.now();
    logger.info(`[SendoWorkerService] Starting analysis for agent ${agentId}...`);

    try {
      // 1. Categorize all available actions
      logger.info('[SendoWorkerService] Step 1: Categorizing actions...');
      const { dataActions, actionActions } = await this.actionCategorizer.categorize();

      // 2. Collect provider data
      logger.info('[SendoWorkerService] Step 2: Collecting provider data...');
      const providerData = await this.providerCollector.collect();

      // 3. Select relevant DATA actions
      logger.info('[SendoWorkerService] Step 3: Selecting DATA actions...');
      const selectedDataActions = await this.dataSelector.select(dataActions, providerData);

      // 4. Execute DATA actions
      logger.info('[SendoWorkerService] Step 4: Executing DATA actions...');
      const { results: dataResults, roomIds: createdRoomIds } = await this.dataExecutor.execute(
        selectedDataActions
      );

      // 5. Generate analysis from DATA results
      logger.info('[SendoWorkerService] Step 5: Generating analysis...');
      const analysis = await this.analysisGenerator.generate(dataResults, providerData);

      // 6. Generate recommendations from ACTION actions
      logger.info('[SendoWorkerService] Step 6: Generating recommendations...');
      const analysisId = crypto.randomUUID() as UUID;
      const recommendations = await this.recommendationGenerator.generate(
        analysisId,
        analysis,
        actionActions
      );

      // 7. Build result object
      const pluginsUsed = [
        ...new Set([
          ...dataResults.filter((r) => r.success).map((r) => r.actionType.split(':')[0] || 'unknown'),
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

      // 8. Save to database
      logger.info('[SendoWorkerService] Saving analysis to database...');
      await this.repository.saveAnalysis(result, recommendations);
      logger.info('[SendoWorkerService] Analysis saved successfully');

      logger.info(
        `[SendoWorkerService] ✅ Analysis completed in ${executionTimeMs}ms with ${recommendations.length} recommendations`
      );

      // 9. Cleanup temporary rooms
      try {
        await this.worldManager.cleanupAnalysisRooms(createdRoomIds);
      } catch (cleanupError: any) {
        // Non-critical error, just log it
        logger.warn('[SendoWorkerService] Failed to cleanup rooms:', cleanupError.message);
      }

      return {
        ...result,
        recommendedActions: recommendations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[SendoWorkerService] ❌ Analysis failed: ${errorMessage}`);
      throw error;
    }
  }

  // ============================================
  // DECISION & EXECUTION METHODS
  // ============================================

  /**
   * Process decision for one or more actions (accept/reject)
   * @param decisions - Array of { actionId, decision: 'accept' | 'reject' }
   * @returns Object with accepted and rejected actions
   */
  async processDecisions(
    decisions: Array<{ actionId: string; decision: 'accept' | 'reject' }>
  ): Promise<{
    accepted: RecommendedAction[];
    rejected: Array<{ actionId: string; status: string }>;
  }> {
    return this.decisionProcessor.processDecisions(decisions);
  }

  // ============================================
  // READ METHODS (Delegated to Repository)
  // ============================================

  /**
   * Get a single analysis by ID
   * @param analysisId - The analysis UUID
   * @returns The analysis result, or null if not found
   */
  async getAnalysisResult(
    analysisId: UUID
  ): Promise<(AnalysisResult & { recommendedActions: RecommendedAction[] }) | null> {
    return this.repository.getAnalysisResult(analysisId);
  }

  /**
   * Get all analyses for an agent (limited to 10 most recent)
   * @param agentId - The agent UUID
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of analysis results
   */
  async getAnalysesByAgentId(agentId: UUID, limit: number = 10): Promise<AnalysisResult[]> {
    return this.repository.getAnalysesByAgentId(agentId, limit);
  }

  /**
   * Get all actions for an analysis, sorted by priority and confidence
   * @param analysisId - The analysis UUID
   * @returns Array of recommended actions
   */
  async getActionsByAnalysisId(analysisId: UUID): Promise<RecommendedAction[]> {
    return this.repository.getActionsByAnalysisId(analysisId);
  }

  /**
   * Get a specific action by ID
   * @param actionId - The action ID
   * @returns The recommended action
   * @throws {Error} If action not found
   */
  async getActionById(actionId: string): Promise<RecommendedAction> {
    return this.repository.getActionById(actionId);
  }
}

export default SendoWorkerService;
