import { IAgentRuntime, logger, ModelType, type Action } from '@elizaos/core';
import type {
  ActionClassification,
  ActionCategorizationResponse,
  DataActionType,
  ActionActionType,
} from '../../types/index';
import { actionCategorizationSchema } from '../../types/index';
import { actionCategorizationPrompt } from '../../templates/index';

/**
 * ActionCategorizer
 *
 * Categorizes actions into DATA (retrieval) or ACTION (execution) types using LLM.
 */
export class ActionCategorizer {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Categorize all available actions
   * @returns Grouped actions and classifications
   */
  async categorize(): Promise<{
    dataActions: Map<string, Action[]>;
    actionActions: Map<ActionActionType, Action[]>;
    classifications: ActionClassification[];
  }> {
    logger.info('[ActionCategorizer] Categorizing all available actions...');

    // Get all actions from runtime
    const allActions = Array.from(this.runtime.actions.values());
    logger.info(`[ActionCategorizer] Found ${allActions.length} actions to categorize`);

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
      `[ActionCategorizer] Categorization complete: ${dataActions.size} DATA types, ${actionActions.size} ACTION types`
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
}
