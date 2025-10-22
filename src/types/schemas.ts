import { z } from 'zod';

/**
 * Schema for action categorization response
 */
export const actionCategorizationSchema = z.object({
  category: z.enum(['DATA', 'ACTION']).describe('Main category of the action'),
  actionType: z
    .string()
    .describe('Specific type within the category (e.g., GET_BALANCE, SWAP, TRANSFER)'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence level in the classification'),
  reasoning: z
    .string()
    .describe('Brief explanation of the classification'),
});

export type ActionCategorizationResponse = z.infer<
  typeof actionCategorizationSchema
>;

/**
 * Schema for relevant actions selection response
 */
export const selectRelevantActionsSchema = z.object({
  relevantActions: z
    .array(z.string())
    .describe('Array of action names that are relevant'),
  reasoning: z
    .string()
    .describe('Explanation of why these actions are relevant'),
});

export type SelectRelevantActionsResponse = z.infer<
  typeof selectRelevantActionsSchema
>;

/**
 * Schema for recommended action generation response
 */
export const generateRecommendationSchema = z.object({
  actionType: z.string().describe('Name of the action to execute'),
  pluginName: z.string().describe('Plugin that provides this action'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .describe('Priority level of this recommendation'),
  reasoning: z
    .string()
    .describe('Detailed explanation of why this action is recommended'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in this recommendation'),
  triggerMessage: z
    .string()
    .describe('Exact message to send to trigger this action'),
  params: z
    .record(z.string(), z.any())
    .optional()
    .describe('Parameters for the action'),
  estimatedImpact: z.string().describe('Expected outcome of the action'),
  estimatedGas: z
    .string()
    .optional()
    .describe('Gas estimate for blockchain transactions'),
});

export type GenerateRecommendationResponse = z.infer<
  typeof generateRecommendationSchema
>;

/**
 * Schema for analysis generation response
 */
export const generateAnalysisSchema = z.object({
  walletOverview: z
    .string()
    .describe('Detailed overview of wallet status, balances, and holdings'),
  marketConditions: z.string().describe('Current market analysis and trends'),
  riskAssessment: z.string().describe('Risk level evaluation with specific concerns'),
  opportunities: z.string().describe('Identified opportunities based on the data'),
});

export type GenerateAnalysisResponse = z.infer<typeof generateAnalysisSchema>;
