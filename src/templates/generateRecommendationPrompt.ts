import type { Action } from '@elizaos/core';

export interface GenerateRecommendationPromptParams {
  analysis: {
    walletOverview: string;
    marketConditions: string;
    riskAssessment: string;
    opportunities: string;
  };
  action: Action;
  pluginName: string;
}

/**
 * Prompt for generating a complete RecommendedAction for a single action
 */
export const generateRecommendationPrompt = ({
  analysis,
  action,
  pluginName,
}: GenerateRecommendationPromptParams): string => {
  const examplesText =
    action.examples && action.examples.length > 0
      ? `\n## Example Messages That Trigger This Action\n\n${action.examples
          .slice(0, 3)
          .map(
            (conversation, idx) =>
              `Example ${idx + 1}:\n${conversation
                .map((msg) => `  ${msg.name}: "${msg.content.text}"`)
                .join('\n')}`
          )
          .join('\n\n')}`
      : '';

  return `You are generating a specific action recommendation based on analysis results.

## Analysis Context

**Wallet Overview:** ${analysis.walletOverview}

**Market Conditions:** ${analysis.marketConditions}

**Risk Assessment:** ${analysis.riskAssessment}

**Opportunities:** ${analysis.opportunities}

## Action to Recommend

**Action Name:** ${action.name}

**Description:** ${action.description}
${action.similes ? `\n**Alternative names:** ${action.similes.join(', ')}` : ''}
${examplesText}

## Your Task

Generate a complete recommendation for this specific action based on the analysis above.

### Requirements

1. **Priority:** "high", "medium", or "low" based on urgency and impact

2. **Reasoning:** Explain WHY this action is recommended (2-3 sentences)
   - Reference specific points from the analysis
   - Mention the expected benefit

3. **Confidence:** Rate 0.0 to 1.0 based on how well this addresses the analysis

4. **Trigger Message:** 🚨 **CRITICAL** 🚨
   - Must closely match the example message patterns above
   - Use the same structure, keywords, and format
   - Only replace specific values (amounts, tokens) with data from analysis
   - This exact message will be used to trigger the action

5. **Parameters:** Relevant key-value pairs (tokens, amounts, addresses, etc.)

6. **Estimated Impact:** Expected outcome in 1 sentence

7. **Estimated Gas:** Rough estimate or "Not applicable"

## Response Format

{
  "actionType": "${action.name}",
  "pluginName": "${pluginName}",
  "priority": "high" | "medium" | "low",
  "reasoning": "...",
  "confidence": 0.85,
  "triggerMessage": "Message matching example patterns...",
  "params": { "key": "value" },
  "estimatedImpact": "...",
  "estimatedGas": "..."
}`;
};
