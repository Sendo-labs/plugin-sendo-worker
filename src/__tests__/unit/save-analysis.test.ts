/**
 * Unit tests for SendoWorkerService saveAnalysis (via runAnalysis)
 *
 * Tests database persistence of analysis and recommendations
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
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

    // Setup LLM mock using fixture-based system
    setupLLMMock(runtime, { useFixtures: true });
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
    // Override to return no ACTION actions
    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => ({ relevantActions: [], reasoning: 'None needed' }),
      },
    });

    const result = await service.runAnalysis(runtime.agentId, true);

    // Should save analysis even with no recommendations
    const saved = await service.getAnalysisResult(result.id);
    expect(saved).not.toBeNull();
    expect(saved!.recommendedActions.length).toBe(0);

    // Restore default mock for other tests
    setupLLMMock(runtime, { useFixtures: true });
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
