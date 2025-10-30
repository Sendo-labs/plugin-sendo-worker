import { IAgentRuntime, logger, ModelType, type Action } from '@elizaos/core';
import type { ProviderDataResult } from '../../types/index';
import { selectRelevantActionsSchema } from '../../types/index';
import { selectRelevantDataActionsPrompt } from '../../templates/index';

/**
 * DataSelector
 *
 * Selects relevant DATA actions based on provider data using LLM.
 * Groups actions by type and processes them in parallel.
 */
export class DataSelector {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Select relevant DATA actions based on provider data
   * Groups actions by type and selects relevant ones for each type in parallel
   * @param dataActions - Map of DATA actions grouped by type
   * @param providerData - Provider data results
   * @returns Array of relevant DATA actions
   */
  async select(
    dataActions: Map<string, Action[]>,
    providerData: ProviderDataResult[]
  ): Promise<Action[]> {
    logger.info('[DataSelector] Selecting relevant DATA actions...');

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
            `[DataSelector] Selected ${selectedActions.length}/${actions.length} ${type} actions`
          );

          return selectedActions;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[DataSelector] Failed to select ${type} actions: ${errorMessage}`);
          return [];
        }
      })
    );

    // Flatten all selected actions
    const relevantActions = selections.flat();

    logger.info(`[DataSelector] Selected ${relevantActions.length} relevant DATA actions`);
    return relevantActions;
  }
}
