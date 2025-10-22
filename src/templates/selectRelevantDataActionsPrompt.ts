import type { Action } from '@elizaos/core';
import type { ProviderDataResult } from '../types/generation.js';

export interface SelectRelevantDataActionsPromptParams {
  providerData: ProviderDataResult[];
  dataActions: Action[];
}

/**
 * Prompt for selecting relevant DATA actions based on provider context
 */
export const selectRelevantDataActionsPrompt = ({
  providerData,
  dataActions,
}: SelectRelevantDataActionsPromptParams): string => {
  return `You are an AI agent determining which data collection actions are relevant based on available provider context.

## Provider Context

${providerData
  .map(
    (provider) => `
### ${provider.providerName}
**Data:** ${JSON.stringify(provider.data, null, 2)}
**Collected at:** ${provider.timestamp}
`
  )
  .join('\n')}

## Your Task

Review the available DATA collection actions below and determine which ones are **relevant and useful** based on the provider context above.

## Available DATA Actions

${dataActions
  .map(
    (action, idx) => `
### ${idx + 1}. ${action.name}
**Description:** ${action.description}
${action.similes ? `**Also known as:** ${action.similes.join(', ')}` : ''}
${
  action.examples && action.examples.length > 0
    ? `**Example usage:**\n${action.examples[0]
        .map((msg) => `  ${msg.name}: "${msg.content.text}"`)
        .join('\n')}`
    : ''
}
`
  )
  .join('\n')}

## Selection Criteria

Consider a DATA action relevant if:
- The provider context indicates data that this action can enrich or complement
- The action can provide missing information needed for analysis
- The action's scope aligns with what the providers show (e.g., if wallet has NFTs, include NFT actions)
- The action can help validate or cross-reference provider data

Do NOT select actions that:
- Request data already fully available in provider context
- Are not applicable to the current state (e.g., NFT queries when no NFTs exist)
- Would be redundant with provider information

## Response Format

Return a JSON object with:
{
  "relevantActions": ["ACTION_NAME_1", "ACTION_NAME_2", ...],
  "reasoning": "Brief explanation of why these DATA actions are relevant based on the provider context"
}

If no actions are relevant (all needed data is in providers), return an empty array with reasoning.`;
};
