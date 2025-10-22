import type { Action } from '@elizaos/core';
import type { ActionActionType } from '../types/generation.js';

export interface SelectRelevantActionsPromptParams {
  analysis: {
    walletOverview: string;
    marketConditions: string;
    riskAssessment: string;
    opportunities: string;
  };
  actionType: ActionActionType;
  actions: Action[];
}

/**
 * Prompt for selecting relevant actions of a specific type based on analysis
 */
export const selectRelevantActionsPrompt = ({
  analysis,
  actionType,
  actions,
}: SelectRelevantActionsPromptParams): string => {
  return `You are an AI agent analyzing which blockchain actions are relevant based on a comprehensive analysis.

## Analysis Summary

**Wallet Overview:** ${analysis.walletOverview}

**Market Conditions:** ${analysis.marketConditions}

**Risk Assessment:** ${analysis.riskAssessment}

**Opportunities:** ${analysis.opportunities}

## Your Task

Review the available ${actionType} actions below and determine which ones are **relevant and potentially beneficial** based on the analysis above.

## Available ${actionType} Actions

${actions
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

Consider an action relevant if:
- It addresses an opportunity mentioned in the analysis
- It mitigates a risk identified in the assessment
- It aligns with current market conditions
- It makes sense given the wallet's current state

Do NOT select actions that:
- Are not supported by the current analysis
- Would increase risk without clear benefit
- Are redundant or unnecessary

## Response Format

Return a JSON object with:
{
  "relevantActions": ["ACTION_NAME_1", "ACTION_NAME_2", ...],
  "reasoning": "Brief explanation of why these ${actionType} actions are relevant based on the analysis"
}

If no actions are relevant, return an empty array with reasoning.`;
};
