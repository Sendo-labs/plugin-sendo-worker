import type { ActionResult, IAgentRuntime, UUID } from '@elizaos/core';

/**
 * Retrieve ActionResult from runtime using the official getActionResults method
 * Returns the first action result for the given message ID
 */
export function getActionResultFromCache(
  runtime: IAgentRuntime,
  messageId: UUID
): ActionResult | null {
  const actionResults = runtime.getActionResults(messageId);
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
