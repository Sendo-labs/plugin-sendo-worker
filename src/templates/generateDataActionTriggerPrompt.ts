import type { Action } from '@elizaos/core';

export interface GenerateDataActionTriggerPromptParams {
  action: Action;
}

/**
 * Prompt for generating a trigger message for a DATA action
 * (simpler than full recommendation - just needs to trigger the action)
 */
export const generateDataActionTriggerPrompt = ({
  action,
}: GenerateDataActionTriggerPromptParams): string => {
  const examplesText =
    action.examples && action.examples.length > 0
      ? `\n## Example Messages\n\n${action.examples
          .slice(0, 3)
          .map(
            (conversation, idx) =>
              `Example ${idx + 1}:\n${conversation
                .map((msg) => `  ${msg.name}: "${msg.content.text}"`)
                .join('\n')}`
          )
          .join('\n\n')}`
      : '';

  return `Generate a trigger message for a data collection action.

## Action Details

**Name:** ${action.name}

**Description:** ${action.description}
${action.similes ? `\n**Alternative names:** ${action.similes.join(', ')}` : ''}
${examplesText}

## Task

Generate a simple message that will trigger this data collection action.

- Match the example message patterns above
- Keep it natural and concise
- This is for automated data collection, not user-facing

Return ONLY the trigger message as plain text, nothing else.`;
};
