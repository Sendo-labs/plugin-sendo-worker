/**
 * Unit tests for SendoWorkerService DB getter methods
 *
 * Tests database retrieval methods
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { analysisResults, recommendedActions } from '../../schemas/index.js';

describe('SendoWorkerService - DB Getters', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let testAnalysisId1: UUID;
  let testAnalysisId2: UUID;
  let testActionId1: string;
  let testActionId2: string;

  beforeAll(async () => {
    runtime = await createTestRuntime({
      testId: 'db-getters-test',
    });

    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Create test data
    const db = (runtime as any).db;
    testAnalysisId1 = crypto.randomUUID() as UUID;
    testAnalysisId2 = crypto.randomUUID() as UUID;

    // Insert 2 analyses
    await db.insert(analysisResults).values([
      {
        id: testAnalysisId1,
        agentId: runtime.agentId,
        analysis: {
          walletOverview: 'Analysis 1',
          marketConditions: 'Test',
          riskAssessment: 'Test',
          opportunities: 'Test',
        },
        pluginsUsed: ['plugin1'],
        executionTimeMs: 100,
        createdAt: new Date('2025-10-22T10:00:00Z'),
      },
      {
        id: testAnalysisId2,
        agentId: runtime.agentId,
        analysis: {
          walletOverview: 'Analysis 2',
          marketConditions: 'Test',
          riskAssessment: 'Test',
          opportunities: 'Test',
        },
        pluginsUsed: ['plugin2'],
        executionTimeMs: 200,
        createdAt: new Date('2025-10-22T11:00:00Z'),
      },
    ]);

    // Insert actions for first analysis
    testActionId1 = `action-1-${Date.now()}`;
    testActionId2 = `action-2-${Date.now()}`;

    await db.insert(recommendedActions).values([
      {
        id: testActionId1,
        analysisId: testAnalysisId1,
        actionType: 'ACTION_1',
        pluginName: 'test-plugin',
        priority: 3, // high
        reasoning: 'Test',
        confidence: '0.9',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date('2025-10-22T10:01:00Z'),
      },
      {
        id: testActionId2,
        analysisId: testAnalysisId1,
        actionType: 'ACTION_2',
        pluginName: 'test-plugin',
        priority: 1, // low
        reasoning: 'Test',
        confidence: '0.5',
        triggerMessage: 'Test',
        params: {},
        status: 'pending',
        createdAt: new Date('2025-10-22T10:02:00Z'),
      },
    ]);
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  describe('getAnalysesByAgentId', () => {
    it('should return analyses for agent', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId);

      expect(analyses.length).toBeGreaterThanOrEqual(2);
      expect(analyses[0]).toHaveProperty('id');
      expect(analyses[0]).toHaveProperty('agentId');
      expect(analyses[0]).toHaveProperty('analysis');
      expect(analyses[0]).toHaveProperty('pluginsUsed');
      expect(analyses[0]).toHaveProperty('executionTimeMs');
    });

    it('should return analyses sorted by most recent first', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId);

      // Most recent should be first (analysis 2 was created after analysis 1)
      const analysis2Index = analyses.findIndex((a) => a.id === testAnalysisId2);
      const analysis1Index = analyses.findIndex((a) => a.id === testAnalysisId1);

      expect(analysis2Index).toBeLessThan(analysis1Index);
    });

    it('should respect limit parameter', async () => {
      const analyses = await service.getAnalysesByAgentId(runtime.agentId, 1);

      expect(analyses.length).toBe(1);
    });

    it('should return empty array for non-existent agent', async () => {
      const fakeAgentId = crypto.randomUUID() as UUID;
      const analyses = await service.getAnalysesByAgentId(fakeAgentId);

      expect(analyses.length).toBe(0);
    });
  });

  describe('getActionsByAnalysisId', () => {
    it('should return actions for analysis', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId1);

      expect(actions.length).toBe(2);
      expect(actions[0].analysisId).toBe(testAnalysisId1);
      expect(actions[0]).toHaveProperty('id');
      expect(actions[0]).toHaveProperty('actionType');
      expect(actions[0]).toHaveProperty('priority');
      expect(actions[0]).toHaveProperty('confidence');
    });

    it('should return actions sorted by priority and confidence', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId1);

      // High priority (0.9) should come before low priority (0.5)
      expect(actions[0].priority).toBe('high');
      expect(actions[1].priority).toBe('low');
    });

    it('should return empty array for analysis with no actions', async () => {
      const actions = await service.getActionsByAnalysisId(testAnalysisId2);

      expect(actions.length).toBe(0);
    });

    it('should return empty array for non-existent analysis', async () => {
      const fakeAnalysisId = crypto.randomUUID() as UUID;
      const actions = await service.getActionsByAnalysisId(fakeAnalysisId);

      expect(actions.length).toBe(0);
    });
  });

  describe('getActionById', () => {
    it('should return action by ID', async () => {
      const action = await service.getActionById(testActionId1);

      expect(action.id).toBe(testActionId1);
      expect(action.analysisId).toBe(testAnalysisId1);
      expect(action.actionType).toBe('ACTION_1');
      expect(action.priority).toBe('high');
      expect(action.confidence).toBe(0.9);
      expect(action.status).toBe('pending');
    });

    it('should throw error for non-existent action', async () => {
      const fakeActionId = 'non-existent';

      await expect(service.getActionById(fakeActionId)).rejects.toThrow('Action not found');
    });
  });

  describe('getAnalysisResult', () => {
    it('should return analysis with recommendations', async () => {
      const result = await service.getAnalysisResult(testAnalysisId1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(testAnalysisId1);
      expect(result!.recommendedActions).toBeDefined();
      expect(result!.recommendedActions.length).toBe(2);
    });

    it('should return null for non-existent analysis', async () => {
      const fakeId = crypto.randomUUID() as UUID;
      const result = await service.getAnalysisResult(fakeId);

      expect(result).toBeNull();
    });
  });
});
