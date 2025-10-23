/**
 * Integration tests for SendoWorkerService.runAnalysis()
 *
 * Tests the complete analysis workflow with REAL runtime
 */

import { describe, it, expect, beforeAll, afterAll, setDefaultTimeout } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
import type { IAgentRuntime } from '@elizaos/core';

// Set default timeout for all tests (higher for real LLM mode)
const useRealLLM = process.env.USE_REAL_LLM === 'true';
setDefaultTimeout(useRealLLM ? 60000 : 5000);

describe('SendoWorkerService - runAnalysis (Integration)', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create REAL runtime with actions, providers and isolated DB
    // Limit actions to 10 when using real LLM to reduce costs
    runtime = await createTestRuntime({
      testId: 'run-analysis-test',
      withDataActions: true,
      withActionActions: true,
      withProviders: true,
      limitActions: useRealLLM ? 10 : undefined,
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

    // Verify structure, not specific values (LLM can choose different actions)
    expect(typeof rec.actionType).toBe('string');
    expect(rec.actionType.length).toBeGreaterThan(0);
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

    // Should complete in reasonable time
    // Mocked: < 2s (parallel execution)
    // Real LLM: < 60s (46 actions to categorize + analysis)
    const maxDuration = useRealLLM ? 60000 : 2000;
    expect(duration).toBeLessThan(maxDuration);
  });
});
