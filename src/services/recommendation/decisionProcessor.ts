import { IAgentRuntime, logger, UUID, ChannelType, type Memory } from '@elizaos/core';
import type { RecommendedAction } from '../../types/index';
import { recommendedActions } from '../../schemas/index';
import { eq } from 'drizzle-orm';
import { getActionResultFromCache, extractErrorMessage } from '../../utils/index';

/**
 * DecisionProcessor
 *
 * Processes user decisions (accept/reject) for recommended actions.
 * Handles execution of accepted actions asynchronously.
 */
export class DecisionProcessor {
  constructor(
    private runtime: IAgentRuntime,
    private getDb: () => any,
    private getAgentWorldId: () => UUID,
    private getActionById: (actionId: string) => Promise<RecommendedAction>
  ) {}

  /**
   * Process user decisions on recommended actions
   * @param decisions - Array of actionId + decision (accept/reject)
   * @returns Accepted and rejected actions
   */
  async processDecisions(
    decisions: Array<{ actionId: string; decision: 'accept' | 'reject' }>
  ): Promise<{
    accepted: RecommendedAction[];
    rejected: Array<{ actionId: string; status: string }>;
  }> {
    logger.info(`[DecisionProcessor] Processing ${decisions.length} decisions...`);

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
            logger.info(`[DecisionProcessor] Action ${actionId} accepted and executing`);
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
          logger.info(`[DecisionProcessor] Action ${actionId} rejected`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[DecisionProcessor] Failed to process decision for ${actionId}: ${errorMessage}`);
        // Continue processing other decisions
      }
    }

    logger.info(
      `[DecisionProcessor] Decisions processed: ${accepted.length} accepted, ${rejected.length} rejected`
    );

    return { accepted, rejected };
  }

  /**
   * Execute one or more recommended actions asynchronously
   * Changes status to "executing" immediately and processes actions in background
   * @param actionIds - Array of action IDs to execute
   * @returns Array of actions with status updated to "executing"
   */
  private async executeActions(actionIds: string[]): Promise<RecommendedAction[]> {
    logger.info(`[DecisionProcessor] Starting execution of ${actionIds.length} actions...`);

    if (actionIds.length === 0) {
      logger.warn('[DecisionProcessor] No actions to execute');
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

        logger.debug(`[DecisionProcessor] Action ${actionId} status → executing`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[DecisionProcessor] Failed to update ${actionId}: ${errorMessage}`);
      }
    }

    // 2. Launch execution asynchronously (don't await)
    this.processExecutingActions(actionIds).catch((error) => {
      logger.error('[DecisionProcessor] Action execution error:', error);
    });

    logger.info(`[DecisionProcessor] ${executingActions.length} actions marked as executing`);
    return executingActions;
  }

  /**
   * Process executing actions and update database with results
   * Called by executeActions() - runs asynchronously
   * @param actionIds - Array of action IDs to process
   */
  private async processExecutingActions(actionIds: string[]): Promise<void> {
    logger.info(`[DecisionProcessor] Processing ${actionIds.length} executing actions...`);

    // Process each action in parallel
    await Promise.all(
      actionIds.map(async (actionId) => {
        try {
          // 1. Get action from database
          const recommendedAction = await this.getActionById(actionId);

          logger.debug(
            `[DecisionProcessor] Processing action ${actionId}: ${recommendedAction.actionType}`
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
          const roomId = crypto.randomUUID() as UUID;

          // Use agent's permanent world
          const actionWorldId = this.getAgentWorldId();

          // Ensure room exists in database (required for memory storage)
          await this.runtime.ensureRoomExists({
            id: roomId,
            source: 'sendo-worker',
            type: ChannelType.API,
            worldId: actionWorldId,
          });

          const memory: Memory = {
            id: messageId,
            entityId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            roomId,
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

              logger.info(`[DecisionProcessor] ✅ Action ${actionId} completed successfully`);
            } else {
              // Action executed but failed (e.g., insufficient funds, swap failed)
              const errorMessage = extractErrorMessage(actionResult, 'Action execution failed');
              await db
                .update(recommendedActions)
                .set({
                  status: 'failed',
                  error: errorMessage,
                  errorType: 'execution',
                  executedAt,
                })
                .where(eq(recommendedActions.id, actionId));

              logger.warn(`[DecisionProcessor] ⚠️ Action ${actionId} failed: ${errorMessage}`);
            }
          } else {
            // No result - mark as failed (action was executed but returned nothing)
            await db
              .update(recommendedActions)
              .set({
                status: 'failed',
                error: 'No result returned from action',
                errorType: 'execution',
                executedAt,
              })
              .where(eq(recommendedActions.id, actionId));

            logger.warn(`[DecisionProcessor] ⚠️ Action ${actionId} failed: no result`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[DecisionProcessor] Action ${actionId} execution error: ${errorMessage}`);

          try {
            // Determine error type: 'initialization' if action not found, otherwise 'technical'
            const errorType = errorMessage.includes('not found') ? 'initialization' : 'technical';

            // Mark as failed
            const db = this.getDb();
            await db
              .update(recommendedActions)
              .set({
                status: 'failed',
                error: errorMessage,
                errorType,
                executedAt: new Date(),
              })
              .where(eq(recommendedActions.id, actionId));
          } catch (dbError) {
            logger.error(`[DecisionProcessor] Failed to update error status: ${dbError}`);
          }
        }
      })
    );

    logger.info(`[DecisionProcessor] Finished processing ${actionIds.length} actions`);
  }
}
