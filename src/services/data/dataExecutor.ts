import {
  IAgentRuntime,
  UUID,
  logger,
  ModelType,
  ChannelType,
  type Action,
  type Memory,
} from '@elizaos/core';
import type { AnalysisActionResult } from '../../types/index';
import { generateDataActionTriggerPrompt } from '../../templates/index';
import { getActionResultFromCache, extractErrorMessage } from '../../utils/actionResult';

/**
 * DataExecutor
 *
 * Executes DATA actions with generated trigger messages.
 * Uses the agent's permanent world and tracks room IDs for cleanup.
 */
export class DataExecutor {
  constructor(
    private runtime: IAgentRuntime,
    private getWorldId: () => UUID
  ) {}

  /**
   * Execute DATA actions with generated trigger messages
   * @param dataActions - Array of DATA actions to execute
   * @returns Object with results and room IDs for cleanup
   */
  async execute(
    dataActions: Action[]
  ): Promise<{ results: AnalysisActionResult[]; roomIds: UUID[] }> {
    logger.info('[DataExecutor] Executing DATA actions...');

    if (dataActions.length === 0) {
      logger.warn('[DataExecutor] No DATA actions to execute');
      return { results: [], roomIds: [] };
    }

    // Use agent's permanent world
    const worldId = this.getWorldId();
    const createdRoomIds: UUID[] = [];

    logger.debug(`[DataExecutor] Using agent world ${worldId} for DATA actions`);

    // Execute each action in parallel
    const results = await Promise.all(
      dataActions.map(async (action) => {
        try {
          // Generate trigger message for this action
          const triggerMessage = (await this.runtime.useModel(ModelType.TEXT_SMALL, {
            prompt: generateDataActionTriggerPrompt({ action }),
            temperature: 0.2,
          })) as string;

          logger.debug(`[DataExecutor] Trigger for ${action.name}: "${triggerMessage.trim()}"`);

          // Create message with unique ID for stateCache retrieval
          const messageId = crypto.randomUUID() as UUID;

          // Ensure room exists in database (unique room per action, using agent's world)
          const roomId = crypto.randomUUID() as UUID;
          createdRoomIds.push(roomId); // Track for cleanup

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
              `[DataExecutor] Action ${action.name} completed: success=${actionResult.success}`
            );

            return {
              actionType: action.name,
              success: actionResult.success ?? false,
              data: actionResult.data || actionResult.values || null,
              error: extractErrorMessage(actionResult),
            };
          } else {
            logger.warn(`[DataExecutor] No result found in stateCache for ${action.name}`);
            return {
              actionType: action.name,
              success: false,
              data: null,
              error: 'No result returned from action',
            };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[DataExecutor] Failed to execute ${action.name}: ${errorMessage}`);
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
    logger.info(`[DataExecutor] Executed ${results.length} DATA actions, ${successCount} successful`);

    return { results, roomIds: createdRoomIds };
  }
}
