import { IAgentRuntime, logger, ModelType } from '@elizaos/core';
import type { AnalysisActionResult, ProviderDataResult } from '../../types/index';
import { generateAnalysisSchema } from '../../types/index';
import { generateAnalysisPrompt } from '../../templates/index';

/**
 * AnalysisGenerator
 *
 * Generates comprehensive analysis using LLM based on DATA action results and provider data.
 * Produces four sections: wallet overview, market conditions, risk assessment, and opportunities.
 */
export class AnalysisGenerator {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Generate comprehensive analysis using LLM
   * @param analysisResults - Results from executed DATA actions
   * @param providerData - Data collected from providers
   * @returns Analysis with four sections
   */
  async generate(
    analysisResults: AnalysisActionResult[],
    providerData: ProviderDataResult[]
  ): Promise<{
    walletOverview: string;
    marketConditions: string;
    riskAssessment: string;
    opportunities: string;
  }> {
    logger.info('[AnalysisGenerator] Generating analysis with LLM...');

    // Extract plugin names from successful results
    const pluginsUsed = [
      ...new Set([
        ...analysisResults.filter((r) => r.success).map((r) => r.actionType.split(':')[0] || 'unknown'),
        ...providerData.map((p) => p.providerName),
      ]),
    ];

    const analysis = await this.runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: generateAnalysisPrompt({
        analysisResults,
        providerData,
        pluginsUsed,
      }),
      schema: generateAnalysisSchema,
      temperature: 0.7,
    });

    logger.info('[AnalysisGenerator] Analysis generated successfully');
    return analysis;
  }
}
