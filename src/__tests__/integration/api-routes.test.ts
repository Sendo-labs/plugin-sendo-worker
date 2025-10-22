/**
 * Integration tests for API routes
 *
 * Tests all HTTP endpoints exposed by the plugin
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { analysisResults, recommendedActions } from '../../schemas/index.js';

describe('API Routes - Integration Tests', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let testAnalysisId: UUID;
  let testActionId: string;

  beforeAll(async () => {
    // Create runtime with actions
    runtime = await createTestRuntime({
      testId: 'api-routes-test',
      withDataActions: true,
      withActionActions: true,
      withProviders: true,
    });

    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock LLM for runAnalysis tests
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Mock categorization responses
      if (prompt.includes('Categorize this action')) {
        return Promise.resolve({
          category: 'DATA',
          actionType: 'wallet_info',
          confidence: 0.95,
          reasoning: 'Mock categorization',
        });
      }

      // Mock select relevant actions
      if (prompt.includes('Which actions are relevant')) {
        return Promise.resolve({
          relevantActions: ['GET_WALLET_BALANCE', 'GET_MARKET_DATA'],
          reasoning: 'Mock selection',
        });
      }

      // Mock generate analysis
      if (prompt.includes('Generate comprehensive analysis')) {
        return Promise.resolve({
          walletOverview: 'Mock wallet overview',
          marketConditions: 'Mock market conditions',
          riskAssessment: 'Mock risk assessment',
          opportunities: 'Mock opportunities',
        });
      }

      // Mock generate recommendation
      if (prompt.includes('Generate recommendation')) {
        return Promise.resolve({
          actionType: 'EXECUTE_SWAP',
          pluginName: 'test-plugin',
          priority: 'high',
          reasoning: 'Mock reasoning',
          confidence: 0.9,
          triggerMessage: 'Mock trigger',
          params: { token: 'USDC' },
          estimatedImpact: 'High',
        });
      }

      return Promise.resolve({});
    });

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
      const result = await service.runAnalysis(runtime.agentId, true);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('recommendedActions');
    });

    it('should save analysis to database', async () => {
      const result = await service.runAnalysis(runtime.agentId, true);
      const analysisId = result.id;

      // Verify it was saved
      const saved = await service.getAnalysisResult(analysisId);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(analysisId);
    });

    it('should return analysis with structure matching API spec', async () => {
      const result = await service.runAnalysis(runtime.agentId, true);

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
