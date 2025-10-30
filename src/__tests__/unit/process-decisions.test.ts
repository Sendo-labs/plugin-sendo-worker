/**
 * Unit tests for SendoWorkerService.processDecisions()
 *
 * Tests accept/reject workflow for recommended actions
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { analysisResults, recommendedActions } from '../../schemas/index';

describe('SendoWorkerService - processDecisions', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let testAnalysisId: UUID;
  let testActionId1: string;
  let testActionId2: string;

  beforeAll(async () => {
    runtime = await createTestRuntime({
      testId: 'process-decisions-test',
    });

    service = await runtime.getServiceLoadPromise(SendoWorkerService.serviceType as any) as SendoWorkerService;

    // Create test data directly in DB
    const db = (runtime as any).db;
    testAnalysisId = crypto.randomUUID() as UUID;

    // Insert analysis
    await db.insert(analysisResults).values({
      id: testAnalysisId,
      agentId: runtime.agentId,
      analysis: {
        walletOverview: 'Test',
        marketConditions: 'Test',
        riskAssessment: 'Test',
        opportunities: 'Test',
      },
      pluginsUsed: ['test'],
      executionTimeMs: 100,
      createdAt: new Date(),
    });

    // Insert test recommendations
    testActionId1 = `test-action-1-${Date.now()}`;
    testActionId2 = `test-action-2-${Date.now()}`;

    await db.insert(recommendedActions).values([
      {
        id: testActionId1,
        analysisId: testAnalysisId,
        actionType: 'REBALANCE_PORTFOLIO',
        pluginName: 'test-plugin',
        priority: 3, // high
        reasoning: 'Test reasoning',
        confidence: '0.85',
        triggerMessage: 'Test trigger',
        params: {},
        estimatedImpact: 'Test impact',
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: testActionId2,
        analysisId: testAnalysisId,
        actionType: 'EXECUTE_SWAP',
        pluginName: 'test-plugin',
        priority: 2, // medium
        reasoning: 'Test reasoning 2',
        confidence: '0.75',
        triggerMessage: 'Test trigger 2',
        params: {},
        estimatedImpact: 'Test impact 2',
        status: 'pending',
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should accept action and update status to executing', async () => {
    const result = await service.processDecisions([
      { actionId: testActionId1, decision: 'accept' },
    ]);

    expect(result.accepted.length).toBe(1);
    expect(result.rejected.length).toBe(0);

    const acceptedAction = result.accepted[0];
    expect(acceptedAction.id).toBe(testActionId1);
    expect(acceptedAction.status).toBe('executing');
    expect(acceptedAction.decidedAt).toBeDefined();
  });

  it('should reject action and update status to rejected', async () => {
    const result = await service.processDecisions([
      { actionId: testActionId2, decision: 'reject' },
    ]);

    expect(result.accepted.length).toBe(0);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].actionId).toBe(testActionId2);
    expect(result.rejected[0].status).toBe('rejected');

    // Verify in DB
    const action = await service.getActionById(testActionId2);
    expect(action.status).toBe('rejected');
    expect(action.decidedAt).toBeDefined();
  });

  it('should handle multiple decisions', async () => {
    // Create 2 more test actions
    const db = (runtime as any).db;
    const actionId3 = `test-action-3-${Date.now()}`;
    const actionId4 = `test-action-4-${Date.now()}`;

    await db.insert(recommendedActions).values([
      {
        id: actionId3,
        analysisId: testAnalysisId,
        actionType: 'TEST_ACTION',
        pluginName: 'test-plugin',
        priority: 1, // low
        reasoning: 'Test',
        confidence: '0.6',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      },
      {
        id: actionId4,
        analysisId: testAnalysisId,
        actionType: 'TEST_ACTION_2',
        pluginName: 'test-plugin',
        priority: 1, // low
        reasoning: 'Test',
        confidence: '0.6',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      },
    ]);

    // Accept one, reject another
    const result = await service.processDecisions([
      { actionId: actionId3, decision: 'accept' },
      { actionId: actionId4, decision: 'reject' },
    ]);

    expect(result.accepted.length).toBe(1);
    expect(result.rejected.length).toBe(1);
    expect(result.accepted[0].id).toBe(actionId3);
    expect(result.rejected[0].actionId).toBe(actionId4);
  });

  it('should handle non-existent action ID gracefully', async () => {
    const fakeActionId = 'non-existent-id';

    // Should not throw, just log error and skip
    const result = await service.processDecisions([
      { actionId: fakeActionId, decision: 'accept' },
    ]);

    expect(result.accepted.length).toBe(0);
    expect(result.rejected.length).toBe(0);
  });

  it('should return proper structure', async () => {
    // Create fresh action
    const db = (runtime as any).db;
    const actionId = `test-action-struct-${Date.now()}`;

    await db.insert(recommendedActions).values({
      id: actionId,
      analysisId: testAnalysisId,
      actionType: 'TEST',
      pluginName: 'test-plugin',
      priority: 1, // low
      reasoning: 'Test',
      confidence: '0.5',
      triggerMessage: 'Test',
      params: {},
      status: 'pending',
      createdAt: new Date(),
    });

    const result = await service.processDecisions([
      { actionId, decision: 'accept' },
    ]);

    expect(result).toHaveProperty('accepted');
    expect(result).toHaveProperty('rejected');
    expect(Array.isArray(result.accepted)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
  });

  it('should handle empty decisions array', async () => {
    const result = await service.processDecisions([]);

    expect(result.accepted.length).toBe(0);
    expect(result.rejected.length).toBe(0);
  });
});
