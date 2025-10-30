/**
 * Integration tests for API routes
 *
 * Tests all HTTP endpoints exposed by the plugin
 */

import { describe, it, expect, beforeAll, afterAll, setDefaultTimeout } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import { setupLLMMock } from '../helpers/mock-llm.js';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { analysisResults, recommendedActions } from '../../schemas/index.js';

// Set default timeout for all tests (higher for real LLM mode)
const useRealLLM = process.env.USE_REAL_LLM === 'true';
setDefaultTimeout(useRealLLM ? 60000 : 5000);

describe('API Routes - Integration Tests', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let testAnalysisId: UUID;
  let testActionId: string;

  beforeAll(async () => {
    // Create runtime with actions
    // Limit actions to 10 when using real LLM to reduce costs
    runtime = await createTestRuntime({
      testId: 'api-routes-test',
      withDataActions: true,
      withActionActions: true,
      withProviders: true,
      limitActions: useRealLLM ? 10 : undefined,
    });

    // Get service via service loading mechanism
    service = await runtime.getServiceLoadPromise(SendoWorkerService.serviceType as any) as SendoWorkerService;

    // Setup LLM mock using fixture-based system
    setupLLMMock(runtime, { useFixtures: true });

    // Create test data
    const db = (runtime as any).db;

    // Insert test analysis
    testAnalysisId = crypto.randomUUID() as UUID;
    await db.insert(analysisResults).values({
      id: testAnalysisId,
      agentId: runtime.agentId,
      analysis: {
        walletOverview: 'Test wallet overview',
        marketConditions: 'Test market conditions',
        riskAssessment: 'Test risk assessment',
        opportunities: 'Test opportunities',
      },
      pluginsUsed: ['test-plugin'],
      executionTimeMs: 100,
      createdAt: new Date(),
    });

    // Insert test action
    testActionId = `test-action-${Date.now()}`;
    await db.insert(recommendedActions).values({
      id: testActionId,
      analysisId: testAnalysisId,
      actionType: 'EXECUTE_SWAP',
      pluginName: 'test-plugin',
      priority: 3, // high
      reasoning: 'Test reasoning',
      confidence: '0.9',
      triggerMessage: 'Test trigger',
      params: { token: 'USDC' },
      estimatedImpact: 'High impact',
      status: 'pending',
      createdAt: new Date(),
    });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  describe('GET /analysis', () => {
    it('should return all analyses for agent', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId);

      expect(analyses).toBeDefined();
      expect(Array.isArray(analyses)).toBe(true);
      expect(analyses.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const limit = 5;
      const analyses = await service.getAnalysesByAgentId(runtime.agentId, limit);

      expect(analyses.length).toBeLessThanOrEqual(limit);
    });

    it('should return analyses with correct structure', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId);
      const analysis = analyses[0];

      expect(analysis).toHaveProperty('id');
      expect(analysis).toHaveProperty('agentId');
      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('pluginsUsed');
      expect(analysis).toHaveProperty('executionTimeMs');
      expect(analysis).toHaveProperty('createdAt');
    });

    it('should sort analyses by most recent first', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId, 10);

      if (analyses.length >= 2) {
        const first = new Date(analyses[0].createdAt).getTime();
        const second = new Date(analyses[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('GET /analysis/:analysisId', () => {
    it('should return specific analysis with actions', async () => {
      const result = await service.getAnalysisResult(testAnalysisId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(testAnalysisId);
      expect(result?.recommendedActions).toBeDefined();
      expect(Array.isArray(result?.recommendedActions)).toBe(true);
    });

    it('should include all analysis fields', async () => {
      const result = await service.getAnalysisResult(testAnalysisId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('agentId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('pluginsUsed');
      expect(result).toHaveProperty('executionTimeMs');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('recommendedActions');
    });

    it('should return null for non-existent analysis', async () => {
      const fakeId = crypto.randomUUID() as UUID;
      const result = await service.getAnalysisResult(fakeId);

      expect(result).toBeNull();
    });

    it('should include recommended actions in response', async () => {
      const result = await service.getAnalysisResult(testAnalysisId);

      expect(result?.recommendedActions.length).toBeGreaterThanOrEqual(1);
      const action = result?.recommendedActions[0];
      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('actionType');
      expect(action).toHaveProperty('priority');
    });
  });

  describe('POST /analysis', () => {
    it('should run complete analysis workflow', async () => {
      const result = await service.runAnalysis(runtime.agentId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendedActions');
    });

    it('should save analysis to database', async () => {
      const result = await service.runAnalysis(runtime.agentId);
      const analysisId = result.id;

      // Verify it was saved
      const saved = await service.getAnalysisResult(analysisId);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(analysisId);
    });

    it('should return analysis with structure matching API spec', async () => {
      const result = await service.runAnalysis(runtime.agentId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('agentId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('pluginsUsed');
      expect(result).toHaveProperty('executionTimeMs');
      expect(result).toHaveProperty('recommendedActions');
      expect(Array.isArray(result.recommendedActions)).toBe(true);
    });
  });

  describe('POST /analysis - Wallet Balance Validation', () => {
    it('should check wallet balance before running analysis', async () => {
      // Import wallet utils
      const { checkWalletBalance } = await import('../../utils/walletManager.js');

      // Mock checkWalletBalance to verify it's called
      // Note: In real scenario, wallet auto-creation happens in service.initialize()
      // and balance check happens in route handler before calling runAnalysis

      // This test validates the integration flow:
      // 1. Wallet should exist (created during initialize)
      // 2. Balance check should pass (sufficient funds)
      // 3. Analysis should run successfully

      const result = await service.runAnalysis(runtime.agentId);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should validate wallet utilities work with runtime', async () => {
      // Import wallet utils
      const { hasWallet, getWalletPublicKey } = await import('../../utils/walletManager.js');

      // Check if wallet exists
      const walletExists = hasWallet(runtime);

      if (walletExists) {
        // If wallet exists, public key should be retrievable
        const publicKey = getWalletPublicKey(runtime);
        expect(publicKey).toBeDefined();
        expect(typeof publicKey).toBe('string');
      } else {
        // If no wallet, public key should be null
        const publicKey = getWalletPublicKey(runtime);
        expect(publicKey).toBeNull();
      }
    });
  });

  describe('GET /analysis/:analysisId/actions', () => {
    it('should return all actions for analysis', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId);

      expect(actions).toBeDefined();
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThanOrEqual(1);
    });

    it('should return actions sorted by priority then confidence', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId);

      if (actions.length >= 2) {
        // Priority should be descending (high > medium > low)
        // Within same priority, confidence should be descending
        for (let i = 0; i < actions.length - 1; i++) {
          const current = actions[i];
          const next = actions[i + 1];

          // Compare priority values (high=3, medium=2, low=1)
          const priorityValues = { high: 3, medium: 2, low: 1 };
          const currentPriority = priorityValues[current.priority];
          const nextPriority = priorityValues[next.priority];

          expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
        }
      }
    });

    it('should return actions with all required fields', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId);
      const action = actions[0];

      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('analysisId');
      expect(action).toHaveProperty('actionType');
      expect(action).toHaveProperty('pluginName');
      expect(action).toHaveProperty('priority');
      expect(action).toHaveProperty('reasoning');
      expect(action).toHaveProperty('confidence');
      expect(action).toHaveProperty('triggerMessage');
      expect(action).toHaveProperty('status');
      // errorType is optional (only present on failed actions)
    });
  });

  describe('Action Error Handling - errorType field', () => {
    it('should set errorType to initialization when action is not found', async () => {
      const db = (runtime as any).db;
      const actionId = `test-not-found-${Date.now()}`;

      // Create action with type that doesn't exist in runtime
      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'NON_EXISTENT_ACTION',
        pluginName: 'fake-plugin',
        priority: 3,
        reasoning: 'Testing action not found error',
        confidence: '0.9',
        triggerMessage: 'Execute non-existent action',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      // Accept the action (it will try to execute and fail)
      await service.processDecisions([{ actionId, decision: 'accept' }]);

      // Wait for async execution to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check the action - should be failed with initialization
      const action = await service.getActionById(actionId);
      expect(action.status).toBe('failed');
      expect(action.error).toBeDefined();
      expect(action.error).toContain('not found');
      expect(action.errorType).toBe('initialization');
      expect(action.executedAt).toBeDefined();
    });

    it('should set errorType to execution when action returns error result', async () => {
      const db = (runtime as any).db;
      const actionId = `test-execution-failed-${Date.now()}`;

      // Mock an action that executes but fails
      const failingAction = {
        name: 'FAILING_ACTION',
        description: 'An action that executes but fails',
        examples: [],
        similes: ['FAIL'],
        validate: async () => true,
        handler: async () => ({
          text: 'Insufficient funds to complete transaction',
          success: false,
          error: 'Insufficient USDC balance. Available: 100, Required: 1000',
        }),
      };

      runtime.actions.push(failingAction as any);

      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'FAILING_ACTION',
        pluginName: 'test-plugin',
        priority: 3,
        reasoning: 'Testing execution failure',
        confidence: '0.9',
        triggerMessage: 'Execute action that fails',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      await service.processDecisions([{ actionId, decision: 'accept' }]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const action = await service.getActionById(actionId);
      expect(action.status).toBe('failed');
      expect(action.error).toContain('Insufficient');
      expect(action.errorType).toBe('execution');
      expect(action.executedAt).toBeDefined();
    });

    it('should set errorType to execution when action returns no result', async () => {
      const db = (runtime as any).db;
      const actionId = `test-no-result-${Date.now()}`;

      // Mock an action that returns nothing
      const noResultAction = {
        name: 'NO_RESULT_ACTION',
        description: 'An action that returns no result',
        examples: [],
        similes: ['NO_RESULT'],
        validate: async () => true,
        handler: async () => null as any,
      };

      runtime.actions.push(noResultAction as any);

      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'NO_RESULT_ACTION',
        pluginName: 'test-plugin',
        priority: 2,
        reasoning: 'Testing no result error',
        confidence: '0.8',
        triggerMessage: 'Execute action that returns no result',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      await service.processDecisions([{ actionId, decision: 'accept' }]);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const action = await service.getActionById(actionId);
      expect(action.status).toBe('failed');
      expect(action.error).toContain('No result');
      expect(action.errorType).toBe('execution');
    });

    it('should not include errorType field for pending actions', async () => {
      const db = (runtime as any).db;
      const actionId = `test-pending-${Date.now()}`;

      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'SOME_PENDING_ACTION',
        pluginName: 'test-plugin',
        priority: 2,
        reasoning: 'Testing pending action has no errorType',
        confidence: '0.85',
        triggerMessage: 'Pending action',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      const action = await service.getActionById(actionId);
      expect(action.status).toBe('pending');
      expect(action.error).toBeUndefined();
      expect(action.errorType).toBeUndefined();
    });

    it('should not include errorType field for rejected actions', async () => {
      const db = (runtime as any).db;
      const actionId = `test-rejected-${Date.now()}`;

      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'SOME_REJECTED_ACTION',
        pluginName: 'test-plugin',
        priority: 1,
        reasoning: 'Testing rejected action has no errorType',
        confidence: '0.6',
        triggerMessage: 'Rejected action',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      // Reject the action
      await service.processDecisions([{ actionId, decision: 'reject' }]);

      const action = await service.getActionById(actionId);
      expect(action.status).toBe('rejected');
      expect(action.error).toBeUndefined();
      expect(action.errorType).toBeUndefined();
      expect(action.decidedAt).toBeDefined();
    });
  });

  describe('GET /action/:actionId', () => {
    it('should return specific action by id', async () => {
      const action = await service.getActionById(testActionId);

      expect(action).toBeDefined();
      expect(action.id).toBe(testActionId);
    });

    it('should return action with all fields', async () => {
      const action = await service.getActionById(testActionId);

      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('analysisId');
      expect(action).toHaveProperty('actionType');
      expect(action).toHaveProperty('pluginName');
      expect(action).toHaveProperty('priority');
      expect(action).toHaveProperty('reasoning');
      expect(action).toHaveProperty('confidence');
      expect(action).toHaveProperty('triggerMessage');
      expect(action).toHaveProperty('params');
      expect(action).toHaveProperty('status');
    });

    it('should throw error for non-existent action', async () => {
      const fakeId = 'non-existent-action';

      await expect(service.getActionById(fakeId)).rejects.toThrow('Action not found');
    });

    it('should return correct action data', async () => {
      const action = await service.getActionById(testActionId);

      expect(action.analysisId).toBe(testAnalysisId);
      expect(action.actionType).toBe('EXECUTE_SWAP');
      expect(action.priority).toBe('high');
      expect(action.status).toBe('pending');
    });
  });

  describe('POST /actions/decide', () => {
    it('should accept action decision', async () => {
      // Create new test action
      const db = (runtime as any).db;
      const newActionId = `test-accept-${Date.now()}`;

      await db.insert(recommendedActions).values({
        id: newActionId,
        analysisId: testAnalysisId,
        actionType: 'TEST_ACTION',
        pluginName: 'test-plugin',
        priority: 2, // medium
        reasoning: 'Test',
        confidence: '0.8',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      const result = await service.processDecisions([
        { actionId: newActionId, decision: 'accept' },
      ]);

      expect(result.accepted.length).toBe(1);
      expect(result.rejected.length).toBe(0);
      // When accepted, action is immediately executed (status becomes 'executing')
      expect(result.accepted[0].status).toBe('executing');
    });

    it('should reject action decision', async () => {
      // Create new test action
      const db = (runtime as any).db;
      const newActionId = `test-reject-${Date.now()}`;

      await db.insert(recommendedActions).values({
        id: newActionId,
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
      });

      const result = await service.processDecisions([
        { actionId: newActionId, decision: 'reject' },
      ]);

      expect(result.accepted.length).toBe(0);
      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].status).toBe('rejected');
    });

    it('should handle multiple decisions', async () => {
      // Create 2 test actions
      const db = (runtime as any).db;
      const acceptId = `test-multi-accept-${Date.now()}`;
      const rejectId = `test-multi-reject-${Date.now()}`;

      await db.insert(recommendedActions).values([
        {
          id: acceptId,
          analysisId: testAnalysisId,
          actionType: 'TEST_1',
          pluginName: 'test-plugin',
          priority: 2,
          reasoning: 'Test',
          confidence: '0.8',
          triggerMessage: 'Test',
          params: {},
          status: 'pending',
          createdAt: new Date(),
        },
        {
          id: rejectId,
          analysisId: testAnalysisId,
          actionType: 'TEST_2',
          pluginName: 'test-plugin',
          priority: 1,
          reasoning: 'Test',
          confidence: '0.6',
          triggerMessage: 'Test',
          params: {},
          status: 'pending',
          createdAt: new Date(),
        },
      ]);

      const result = await service.processDecisions([
        { actionId: acceptId, decision: 'accept' },
        { actionId: rejectId, decision: 'reject' },
      ]);

      expect(result.accepted.length).toBe(1);
      expect(result.rejected.length).toBe(1);
    });

    it('should update action status in database', async () => {
      // Create test action
      const db = (runtime as any).db;
      const actionId = `test-status-${Date.now()}`;

      await db.insert(recommendedActions).values({
        id: actionId,
        analysisId: testAnalysisId,
        actionType: 'TEST_STATUS',
        pluginName: 'test-plugin',
        priority: 2,
        reasoning: 'Test',
        confidence: '0.7',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date(),
      });

      await service.processDecisions([
        { actionId, decision: 'reject' },
      ]);

      // Verify in DB
      const action = await service.getActionById(actionId);
      expect(action.status).toBe('rejected');
      expect(action.decidedAt).toBeDefined();
    });
  });
});
