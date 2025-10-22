import type { AnalysisActionResult, ProviderDataResult } from '../types/generation.js';

export interface GenerateAnalysisPromptParams {
  analysisResults: AnalysisActionResult[];
  providerData: ProviderDataResult[];
  pluginsUsed: string[];
}

/**
 * Prompt for generating comprehensive analysis based on action results and provider data
 */
export const generateAnalysisPrompt = ({
  analysisResults,
  providerData,
  pluginsUsed,
}: GenerateAnalysisPromptParams): string => {
  return `You are a crypto portfolio analyst generating a comprehensive analysis report.

## Data from Analysis Actions

${analysisResults
  .map(
    (result, idx) => `
### ${idx + 1}. ${result.actionType}
**Status:** ${result.success ? 'Success' : 'Failed'}
${result.success ? `**Data:**\n${JSON.stringify(result.data, null, 2)}` : `**Error:** ${result.error}`}
`
  )
  .join('\n')}

## Context from Providers

${providerData
  .map(
    (provider) => `
### ${provider.providerName}
**Collected at:** ${provider.timestamp}
**Data:**
${JSON.stringify(provider.data, null, 2)}
`
  )
  .join('\n')}

## Plugins Used

${pluginsUsed.join(', ')}

## Your Task

Generate a comprehensive analysis with four distinct sections. Each section should:
- Reference specific data points from the actions and providers above
- Mention which plugins/actions provided key insights
- Be specific with numbers, percentages, and concrete details
- Keep each section concise (2-4 sentences)

## Response Format

Return a JSON object with exactly these four sections:

{
  "walletOverview": "Detailed overview of wallet status, balances, and holdings. Include specific numbers and values from the data.",
  "marketConditions": "Current market analysis and trends. Reference specific price data and market movements.",
  "riskAssessment": "Risk level evaluation with specific concerns. Identify vulnerabilities or exposure issues.",
  "opportunities": "Identified opportunities based on the data. Suggest specific potential actions or strategies."
}

**Important Guidelines:**
- Be specific and data-driven
- Cite your sources (e.g., "according to plugin-wallet", "via GET_BALANCE action")
- Use actual numbers from the data
- Keep each section focused and actionable
- If data is missing or failed, acknowledge it clearly`;
};
