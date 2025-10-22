import type { UUID } from '@elizaos/core';

/**
 * Represents a complete analysis generated for an agent
 */
export interface AnalysisResult {
  id: UUID;
  agentId: UUID;
  timestamp: string;

  // Global insights (rich text for UI)
  analysis: {
    walletOverview: string;
    marketConditions: string;
    riskAssessment: string;
    opportunities: string;
  };

  // Metadata
  pluginsUsed: string[];
  executionTimeMs: number;

  createdAt: string;
}
