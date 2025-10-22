/**
 * Unit tests for SendoWorkerService.generateRecommendations()
 *
 * Tests LLM-based recommendation generation for ACTION actions
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
import type { IAgentRuntime, Action } from '@elizaos/core';
import type { ActionActionType } from '../../types/index';

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
    // Setup LLM mock using fixtures
    setupLLMMock(runtime, { useFixtures: true });

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
    // Override to select no actions
    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => ({ relevantActions: [], reasoning: 'No actions needed' }),
      },
    });

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

    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => {
          callOrder.push('action-select');
          return { relevantActions: [], reasoning: 'Test' };
        },
      },
    });

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

    // Should have called selection for both types (2 action types in the map)
    expect(callOrder.length).toBe(2);
  });

  it('should filter out null recommendations from failed generations', async () => {
    let recommendationCallCount = 0;

    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        recommendation: () => {
          recommendationCallCount++;
          if (recommendationCallCount === 1) {
            // Success for first call
            return {
              actionType: 'REBALANCE_PORTFOLIO',
              pluginName: 'test-plugin',
              priority: 'high',
              reasoning: 'Test',
              confidence: 0.8,
              triggerMessage: 'Test message',
              params: {},
              estimatedImpact: 'Test',
            };
          } else {
            // Failure for subsequent calls
            throw new Error('LLM error');
          }
        },
      },
    });

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
    // Override to throw error during action type processing
    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => {
          throw new Error('Action type processing failed');
        },
      },
    });

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
    // Use fixtures which include all required fields
    setupLLMMock(runtime, { useFixtures: true });

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
    expect(rec.pluginName).toBe('plugin-portfolio');
    expect(rec.priority).toBe('medium');
    expect(rec.reasoning).toContain('rebalance');
    expect(rec.confidence).toBe(0.75);
    expect(rec.triggerMessage).toContain('Rebalance');
    expect(rec.params).toBeDefined();
    expect(rec.estimatedImpact).toBeDefined();
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
