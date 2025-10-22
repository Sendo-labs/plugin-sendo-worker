/**
 * Integration tests for SendoWorkerService.runAnalysis()
 *
 * Tests the complete analysis workflow with REAL runtime
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import type { IAgentRuntime } from '@elizaos/core';

describe('SendoWorkerService - runAnalysis (Integration)', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create REAL runtime with actions, providers and isolated DB
    runtime = await createTestRuntime({
      testId: 'run-analysis-test',
      withDataActions: true, // 3 DATA actions
      withActionActions: true, // 2 ACTION actions
      withProviders: true, // 2 providers (wallet + time context)
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock ALL LLM calls
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // 1. Categorization
      if (prompt.includes('**Name:**') && prompt.includes('category')) {
        const actionName = prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];

        if (actionName?.includes('GET_') || actionName?.includes('ASSESS')) {
          return Promise.resolve({
            category: 'DATA',
            actionType: actionName.includes('BALANCE')
              ? 'wallet_info'
              : actionName.includes('MARKET')
                ? 'market_info'
                : 'risk_info',
            confidence: 0.95,
            reasoning: `${actionName} retrieves data`,
          });
        } else if (actionName?.includes('EXECUTE') || actionName?.includes('REBALANCE')) {
          return Promise.resolve({
            category: 'ACTION',
            actionType: actionName.includes('SWAP') ? 'swap' : 'rebalance',
            confidence: 0.9,
            reasoning: `${actionName} executes on-chain action`,
          });
        }
      }

      // 2. Trigger generation
      if (prompt.includes('trigger message') || prompt.includes('natural message')) {
        const actionName = prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];
        return Promise.resolve(`Execute ${actionName || 'action'}`);
      }

      // 3. Analysis generation (must match GenerateAnalysisResponse schema)
      // MORE SPECIFIC: Check for "crypto portfolio analyst" to avoid matching action selection
      if (prompt.includes('crypto portfolio analyst') && prompt.includes('comprehensive analysis')) {
        return Promise.resolve({
          walletOverview: 'Portfolio holds 100.5 SOL ($10,050) and 5,000 USDC. Total value: $15,050.',
          marketConditions: 'Market is bullish with +15.5% gain. Strong upward momentum. Volume: $1.2B.',
          riskAssessment:
            'Medium risk (60/100) due to high SOL concentration (66%). Volatility: 35%. Limited diversification.',
          opportunities: 'Strong market momentum favors holding. Consider rebalancing to reduce concentration risk.',
        });
      }

      // 4a. DATA action selection (Step 3)
      if (prompt.includes('## Available DATA Actions')) {
        return Promise.resolve({
          relevantActions: ['GET_WALLET_BALANCE', 'GET_MARKET_DATA', 'ASSESS_PORTFOLIO_RISK'],
          reasoning: 'All DATA actions provide valuable information for comprehensive portfolio analysis.',
        });
      }

      // 4b. ACTION selection for recommendations (Step 6)
      // Matches "You are an AI agent analyzing which blockchain actions"
      if (prompt.includes('You are an AI agent analyzing which blockchain actions')) {
        // Check which action type we're selecting
        if (prompt.includes('rebalance')) {
          return Promise.resolve({
            relevantActions: ['REBALANCE_PORTFOLIO'],
            reasoning: 'Portfolio needs rebalancing due to high SOL concentration.',
          });
        }
        if (prompt.includes('swap')) {
          return Promise.resolve({
            relevantActions: [],
            reasoning: 'No swap actions needed at this time.',
          });
        }
        // Default for other action types
        return Promise.resolve({
          relevantActions: [],
          reasoning: 'No actions selected for this type.',
        });
      }

      // 5. Recommendation generation (must match GenerateRecommendationResponse schema)
      // Matches "You are generating a specific action recommendation"
      if (prompt.includes('You are generating a specific action recommendation')) {
        return Promise.resolve({
          actionType: 'REBALANCE_PORTFOLIO',
          pluginName: 'test-plugin',
          priority: 'high',
          reasoning: 'High SOL concentration (66%) poses risk. Rebalancing to 50/50 improves diversification.',
          confidence: 0.85,
          triggerMessage: 'Rebalance my portfolio to 50% SOL and 50% USDC',
          params: {
            targetRatio: { SOL: 0.5, USDC: 0.5 },
          },
          estimatedImpact: 'Reduced portfolio volatility by ~20%',
        });
      }

      // Fallback for unmatched prompts
      return Promise.resolve({
        relevantActions: [],
        reasoning: 'No actions selected',
      });
    }) as any;
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should execute complete analysis workflow', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('recommendedActions');
    expect(result).toHaveProperty('createdAt');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });

  it('should execute all DATA actions', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    // DATA actions are reflected in pluginsUsed
    expect(result.pluginsUsed.length).toBeGreaterThanOrEqual(3);
    expect(result.pluginsUsed).toContain('GET_WALLET_BALANCE');
    expect(result.pluginsUsed).toContain('GET_MARKET_DATA');
    expect(result.pluginsUsed).toContain('ASSESS_PORTFOLIO_RISK');
  });

  it('should collect provider data', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    // Providers should be in pluginsUsed
    expect(result.pluginsUsed.length).toBeGreaterThanOrEqual(5); // 3 actions + 2 providers
    expect(result.pluginsUsed).toContain('walletContext');
    expect(result.pluginsUsed).toContain('timeContext');
  });

  it('should generate comprehensive analysis', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    expect(result.analysis).toHaveProperty('walletOverview');
    expect(result.analysis).toHaveProperty('marketConditions');
    expect(result.analysis).toHaveProperty('riskAssessment');
    expect(result.analysis).toHaveProperty('opportunities');

    expect(typeof result.analysis.walletOverview).toBe('string');
    expect(result.analysis.walletOverview.length).toBeGreaterThan(0);
  });

  it('should generate action recommendations with trigger messages', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    expect(result.recommendedActions.length).toBeGreaterThan(0);

    const rec = result.recommendedActions[0];
    expect(rec).toHaveProperty('actionType');
    expect(rec).toHaveProperty('pluginName');
    expect(rec).toHaveProperty('reasoning');
    expect(rec).toHaveProperty('confidence');
    expect(rec).toHaveProperty('priority');
    expect(rec).toHaveProperty('triggerMessage');
    expect(rec).toHaveProperty('status');

    expect(rec.actionType).toBe('REBALANCE_PORTFOLIO');
    expect(rec.status).toBe('pending');
    expect(typeof rec.triggerMessage).toBe('string');
    expect(rec.triggerMessage.length).toBeGreaterThan(0);
  });

  it('should have successfully generated analysis', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    // Analysis should have all required fields with content
    expect(result.analysis.walletOverview).toBeDefined();
    expect(result.analysis.marketConditions).toBeDefined();
    expect(result.analysis.riskAssessment).toBeDefined();
    expect(result.analysis.opportunities).toBeDefined();

    expect(result.analysis.walletOverview.length).toBeGreaterThan(0);
    expect(result.analysis.marketConditions.length).toBeGreaterThan(0);
  });

  it('should save analysis to database', async () => {
    const result = await service.runAnalysis(runtime.agentId);

    expect(result.id).toBeDefined();

    const retrieved = await service.getAnalysisResult(result.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(result.id);
  });

  it('should complete workflow in reasonable time', async () => {
    const startTime = Date.now();
    await service.runAnalysis(runtime.agentId);
    const duration = Date.now() - startTime;

    // Should complete in under 2 seconds (parallel execution)
    expect(duration).toBeLessThan(2000);
  });
});
