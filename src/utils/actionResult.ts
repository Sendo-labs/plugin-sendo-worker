import type { ActionResult, IAgentRuntime, AgentRuntime, UUID } from '@elizaos/core';

/**
 * Retrieve ActionResult from runtime's stateCache
 * The stateCache is not in IAgentRuntime interface but exists on AgentRuntime implementation
 */
export function getActionResultFromCache(
  runtime: IAgentRuntime,
  messageId: UUID
): ActionResult | null {
  // Cast to AgentRuntime to access stateCache (implementation detail)
  const runtimeImpl = runtime as unknown as AgentRuntime;
  const cachedState = runtimeImpl.stateCache?.get(`${messageId}_action_results`);
  const actionResults = (cachedState?.data?.actionResults as ActionResult[]) || [];
  return actionResults.length > 0 ? actionResults[0] : null;
}

/**
 * Extract error message from ActionResult.error
 * Handles Error objects, strings, and undefined
 */
export function extractErrorMessage(
  actionResult: ActionResult | null,
  defaultMessage = 'Action failed'
): string | undefined {
  if (!actionResult) {
    return undefined;
  }

  if (actionResult.error) {
    if (actionResult.error instanceof Error) {
      return actionResult.error.message;
    }
    if (typeof actionResult.error === 'string') {
      return actionResult.error;
    }
    return defaultMessage;
  }

  // If no error but action failed, return default message
  if (!actionResult.success) {
    return defaultMessage;
  }

  return undefined;
}
