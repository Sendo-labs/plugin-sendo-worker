/**
 * Unit tests for SendoWorkerService.generateRecommendations()
 *
 * Tests LLM-based recommendation generation for ACTION actions
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime, Action } from '@elizaos/core';
import type { ActionActionType } from '../../types/index.js';

describe('SendoWorkerService - generateRecommendations', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let actionActions: Map<ActionActionType, Action[]>;

  beforeAll(async () => {
    // Create REAL runtime with ACTION actions
    runtime = await createTestRuntime({
      testId: 'generate-recommendations-test',
      withActionActions: true, // 2 ACTION actions
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Prepare actionActions map
    const actions = Array.from(runtime.actions.values());
    actionActions = new Map<ActionActionType, Action[]>();

    actionActions.set('SWAP', [
      actions.find((a) => a.name === 'EXECUTE_SWAP')!,
    ]);
    actionActions.set('TRANSFER', [
      actions.find((a) => a.name === 'REBALANCE_PORTFOLIO')!,
    ]);
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should generate recommendations for selected actions', async () => {
    // Mock LLM responses
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Step 1: Action selection
      if (prompt.includes('analyzing which blockchain actions')) {
        if (prompt.includes('rebalance')) {
          return Promise.resolve({
            relevantActions: ['REBALANCE_PORTFOLIO'],
            reasoning: 'Portfolio needs rebalancing',
          });
        }
        return Promise.resolve({
          relevantActions: [],
          reasoning: 'Not needed',
        });
      }

      // Step 2: Recommendation generation
      if (prompt.includes('generating a specific action recommendation')) {
        return Promise.resolve({
          actionType: 'REBALANCE_PORTFOLIO',
          pluginName: 'test-plugin',
          priority: 'high',
          reasoning: 'High SOL exposure needs balancing',
          confidence: 0.85,
          triggerMessage: 'Rebalance portfolio to 50% SOL and 50% USDC',
          params: { targetRatio: { SOL: 0.5, USDC: 0.5 } },
          estimatedImpact: 'Reduced volatility by 20%',
          estimatedGas: '0.01 SOL',
        });
      }

      return Promise.resolve({});
    }) as any;

    const analysis = {
      walletOverview: 'Portfolio: 100 SOL, 5000 USDC',
      marketConditions: 'Bullish',
      riskAssessment: 'Medium risk',
      opportunities: 'Rebalance to reduce risk',
    };

    const analysisId = crypto.randomUUID();
    const recommendations = await service.generateRecommendations(
      analysisId,
      analysis,
      actionActions
    );

    expect(recommendations.length).toBeGreaterThan(0);

    const rec = recommendations[0];
    expect(rec).toHaveProperty('id');
    expect(rec).toHaveProperty('analysisId');
    expect(rec).toHaveProperty('actionType');
    expect(rec).toHaveProperty('pluginName');
    expect(rec).toHaveProperty('priority');
    expect(rec).toHaveProperty('reasoning');
    expect(rec).toHaveProperty('confidence');
    expect(rec).toHaveProperty('triggerMessage');
    expect(rec).toHaveProperty('params');
    expect(rec).toHaveProperty('estimatedImpact');
    expect(rec).toHaveProperty('status');

    expect(rec.actionType).toBe('REBALANCE_PORTFOLIO');
    expect(rec.status).toBe('pending');
    expect(typeof rec.confidence).toBe('number');
    expect(rec.confidence).toBeGreaterThan(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
  });

  it('should return empty array if no actions are selected', async () => {
    // Mock to select no actions
    runtime.useModel = mock(() => {
      return Promise.resolve({
        relevantActions: [],
        reasoning: 'No actions needed',
      });
    }) as any;

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    const recommendations = await service.generateRecommendations(
      crypto.randomUUID(),
      analysis,
      actionActions
    );

    expect(recommendations.length).toBe(0);
  });

  it('should process multiple action types in parallel', async () => {
    const callOrder: string[] = [];

    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      if (prompt.includes('analyzing which blockchain actions')) {
        if (prompt.includes('swap')) {
          callOrder.push('swap-select');
        } else if (prompt.includes('rebalance')) {
          callOrder.push('rebalance-select');
        }
        return Promise.resolve({
          relevantActions: [],
          reasoning: 'Test',
        });
      }

      return Promise.resolve({});
    }) as any;

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    await service.generateRecommendations(
      crypto.randomUUID(),
      analysis,
      actionActions
    );

    // Should have called selection for both types
    expect(callOrder).toContain('swap-select');
    expect(callOrder).toContain('rebalance-select');
  });

  it('should filter out null recommendations from failed generations', async () => {
    let recommendationCallCount = 0;

    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Step 1: Select 2 actions
      if (prompt.includes('analyzing which blockchain actions')) {
        return Promise.resolve({
          relevantActions: ['REBALANCE_PORTFOLIO'],
          reasoning: 'Test',
        });
      }

      // Step 2: First recommendation succeeds, second fails
      if (prompt.includes('generating a specific action recommendation')) {
        recommendationCallCount++;
        if (recommendationCallCount === 1) {
          // Success
          return Promise.resolve({
            actionType: 'REBALANCE_PORTFOLIO',
            pluginName: 'test-plugin',
            priority: 'high',
            reasoning: 'Test',
            confidence: 0.8,
            triggerMessage: 'Test message',
            params: {},
            estimatedImpact: 'Test',
          });
        } else {
          // Failure
          return Promise.reject(new Error('LLM error'));
        }
      }

      return Promise.resolve({});
    }) as any;

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    const recommendations = await service.generateRecommendations(
      crypto.randomUUID(),
      analysis,
      actionActions
    );

    // Should filter out null (failed) recommendations
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r !== null)).toBe(true);
  });

  it('should handle action type processing errors gracefully', async () => {
    // Mock to throw error during action type processing
    runtime.useModel = mock(() => {
      return Promise.reject(new Error('Action type processing failed'));
    }) as any;

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    const recommendations = await service.generateRecommendations(
      crypto.randomUUID(),
      analysis,
      actionActions
    );

    // Should return empty array on error (not throw)
    expect(recommendations.length).toBe(0);
  });

  it('should include all required fields in recommendations', async () => {
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      if (prompt.includes('analyzing which blockchain actions')) {
        return Promise.resolve({
          relevantActions: ['REBALANCE_PORTFOLIO'],
          reasoning: 'Test',
        });
      }

      if (prompt.includes('generating a specific action recommendation')) {
        return Promise.resolve({
          actionType: 'REBALANCE_PORTFOLIO',
          pluginName: 'test-plugin',
          priority: 'medium',
          reasoning: 'Detailed reasoning here',
          confidence: 0.75,
          triggerMessage: 'Execute rebalance now',
          params: { foo: 'bar' },
          estimatedImpact: 'Positive impact',
          estimatedGas: '0.001 SOL',
        });
      }

      return Promise.resolve({});
    }) as any;

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    const analysisId = crypto.randomUUID();
    const recommendations = await service.generateRecommendations(
      analysisId,
      analysis,
      actionActions
    );

    expect(recommendations.length).toBe(1);

    const rec = recommendations[0];

    // Required fields
    expect(rec.analysisId).toBe(analysisId);
    expect(rec.actionType).toBe('REBALANCE_PORTFOLIO');
    expect(rec.pluginName).toBe('test-plugin');
    expect(rec.priority).toBe('medium');
    expect(rec.reasoning).toBe('Detailed reasoning here');
    expect(rec.confidence).toBe(0.75);
    expect(rec.triggerMessage).toBe('Execute rebalance now');
    expect(rec.params).toEqual({ foo: 'bar' });
    expect(rec.estimatedImpact).toBe('Positive impact');
    expect(rec.estimatedGas).toBe('0.001 SOL');
    expect(rec.status).toBe('pending');
    expect(rec.createdAt).toBeDefined();
  });

  it('should handle empty actionActions map', async () => {
    const emptyMap = new Map<ActionActionType, Action[]>();

    const analysis = {
      walletOverview: 'Test',
      marketConditions: 'Test',
      riskAssessment: 'Test',
      opportunities: 'Test',
    };

    const recommendations = await service.generateRecommendations(
      crypto.randomUUID(),
      analysis,
      emptyMap
    );

    expect(recommendations.length).toBe(0);
  });
});
