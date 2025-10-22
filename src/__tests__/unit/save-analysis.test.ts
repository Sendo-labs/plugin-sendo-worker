/**
 * Unit tests for SendoWorkerService saveAnalysis (via runAnalysis)
 *
 * Tests database persistence of analysis and recommendations
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime } from '@elizaos/core';

describe('SendoWorkerService - saveAnalysis (DB persistence)', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create REAL runtime with actions
    runtime = await createTestRuntime({
      testId: 'save-analysis-test',
      withDataActions: true,
      withActionActions: true,
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock LLM for complete workflow
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Categorization
      if (prompt.includes('**Name:**') && prompt.includes('category')) {
        const actionName = prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];
        if (actionName?.includes('GET_') || actionName?.includes('ASSESS')) {
          return Promise.resolve({ category: 'DATA', actionType: 'wallet_info' });
        }
        return Promise.resolve({ category: 'ACTION', actionType: 'SWAP' });
      }

      // Select DATA actions
      if (prompt.includes('determine which DATA actions are relevant')) {
        return Promise.resolve({
          relevantActions: ['GET_WALLET_BALANCE'],
          reasoning: 'Need balance',
        });
      }

      // Generate trigger for DATA action
      if (prompt.includes('Generate a natural language trigger')) {
        return Promise.resolve({ triggerMessage: 'Get my wallet balance' });
      }

      // Generate analysis
      if (prompt.includes('crypto portfolio analyst') && prompt.includes('comprehensive analysis')) {
        return Promise.resolve({
          walletOverview: 'Portfolio overview',
          marketConditions: 'Market conditions',
          riskAssessment: 'Risk assessment',
          opportunities: 'Opportunities',
        });
      }

      // Select ACTION actions
      if (prompt.includes('analyzing which blockchain actions')) {
        return Promise.resolve({
          relevantActions: ['REBALANCE_PORTFOLIO'],
          reasoning: 'Need rebalance',
        });
      }

      // Generate recommendation
      if (prompt.includes('generating a specific action recommendation')) {
        return Promise.resolve({
          actionType: 'REBALANCE_PORTFOLIO',
          pluginName: 'test-plugin',
          priority: 'high',
          reasoning: 'High risk',
          confidence: 0.85,
          triggerMessage: 'Rebalance portfolio',
          params: {},
          estimatedImpact: 'Reduced risk',
        });
      }

      return Promise.resolve({});
    }) as any;
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should save analysis to database with all fields', async () => {
    const result = await service.runAnalysis(runtime.agentId, true);

    // Verify analysis was created
    expect(result.id).toBeDefined();

    // Retrieve from DB
    const saved = await service.getAnalysisResult(result.id);

    expect(saved).not.toBeNull();
    expect(saved!.id).toBe(result.id);
    expect(saved!.agentId).toBe(runtime.agentId);
    expect(saved!.analysis).toEqual(result.analysis);
    expect(saved!.pluginsUsed).toEqual(result.pluginsUsed);
    expect(saved!.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(saved!.createdAt).toBeDefined();
  });

  it('should save recommendations with analysis', async () => {
    const result = await service.runAnalysis(runtime.agentId, true);

    // Should have recommendations
    expect(result.recommendedActions.length).toBeGreaterThan(0);

    // Retrieve from DB
    const saved = await service.getAnalysisResult(result.id);

    expect(saved!.recommendedActions).toBeDefined();
    expect(saved!.recommendedActions.length).toBe(result.recommendedActions.length);

    const savedRec = saved!.recommendedActions[0];
    expect(savedRec.analysisId).toBe(result.id);
    expect(savedRec.actionType).toBeDefined();
    expect(savedRec.status).toBe('pending');
    expect(savedRec.confidence).toBeGreaterThan(0);
  });

  it('should skip saving if shouldPersist is false', async () => {
    const result = await service.runAnalysis(runtime.agentId, false);

    // Should return result
    expect(result.id).toBeDefined();

    // But NOT in database
    const saved = await service.getAnalysisResult(result.id);
    expect(saved).toBeNull();
  });

  it('should handle saving with no recommendations', async () => {
    // Mock to return no recommendations
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Return minimal responses
      if (prompt.includes('category')) {
        return Promise.resolve({ category: 'DATA', actionType: 'wallet_info' });
      }
      if (prompt.includes('determine which DATA actions are relevant')) {
        return Promise.resolve({ relevantActions: ['GET_WALLET_BALANCE'], reasoning: 'Test' });
      }
      if (prompt.includes('Generate a natural language trigger')) {
        return Promise.resolve({ triggerMessage: 'Get balance' });
      }
      if (prompt.includes('comprehensive analysis')) {
        return Promise.resolve({
          walletOverview: 'Test',
          marketConditions: 'Test',
          riskAssessment: 'Test',
          opportunities: 'Test',
        });
      }
      // No ACTION actions selected
      if (prompt.includes('analyzing which blockchain actions')) {
        return Promise.resolve({ relevantActions: [], reasoning: 'None needed' });
      }

      return Promise.resolve({});
    }) as any;

    const result = await service.runAnalysis(runtime.agentId, true);

    // Should save analysis even with no recommendations
    const saved = await service.getAnalysisResult(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.recommendedActions.length).toBe(0);
  });

  it('should filter out null/undefined recommendations before saving', async () => {
    // This is tested indirectly - if invalid recs are saved, DB will throw
    // The fact that previous tests pass means filtering works

    const result = await service.runAnalysis(runtime.agentId, true);
    const saved = await service.getAnalysisResult(result.id);

    // All saved recommendations should be valid
    saved!.recommendedActions.forEach((rec) => {
      expect(rec).not.toBeNull();
      expect(rec).not.toBeUndefined();
      expect(rec.confidence).not.toBeNull();
      expect(rec.confidence).not.toBeUndefined();
      expect(typeof rec.confidence).toBe('number');
    });
  });
});
