/**
 * Unit tests for SendoWorkerService.executeAnalysisActions()
 *
 * Tests parallel execution of DATA actions with dynamic triggers
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime, Action } from '@elizaos/core';
import * as fs from 'fs';
import * as path from 'path';

describe('SendoWorkerService - executeAnalysisActions', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let dataActions: Action[];

  beforeAll(async () => {
    // Create .eliza directory for database
    const elizaDir = path.join(process.cwd(), '.eliza', '.elizadb');
    if (!fs.existsSync(elizaDir)) {
      fs.mkdirSync(elizaDir, { recursive: true });
    }

    // Create REAL runtime with DATA actions only
    runtime = await createTestRuntime({
      testId: 'execute-analysis-test',
      withDataActions: true, // 3 DATA actions
      withActionActions: false, // No ACTION actions needed
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock LLM for both categorization AND trigger generation
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Check if this is a categorization prompt (contains **Name:** and **Description:** and "DATA" | "ACTION")
      if (prompt.includes('**Name:**') && prompt.includes('category')) {
        const actionName = prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];

        // Categorize all as DATA for this test
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
        }
      }

      // Check if this is a trigger generation prompt (contains "generate a trigger message")
      if (prompt.includes('trigger message') || prompt.includes('natural message')) {
        const actionName = prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];
        return Promise.resolve(`Execute ${actionName || 'action'}`);
      }

      // Default
      return Promise.resolve({
        category: 'DATA',
        actionType: 'unknown',
        confidence: 0.5,
        reasoning: 'Unknown action',
      });
    }) as any;

    // First, categorize actions to populate dataActions map
    const categorization = await service.categorizeActions();

    // Extract all DATA actions from the map
    dataActions = [];
    for (const actions of categorization.dataActions.values()) {
      dataActions.push(...actions);
    }
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);

    // Cleanup .eliza directory
    const elizaDir = path.join(process.cwd(), '.eliza');
    if (fs.existsSync(elizaDir)) {
      fs.rmSync(elizaDir, { recursive: true, force: true });
    }
  });

  it('should execute all DATA actions in parallel', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    // Should have executed 3 actions
    expect(results.length).toBe(3);

    // All should be successful
    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(3);
  });

  it('should return AnalysisActionResult objects with correct structure', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    // Check first result
    const actionResult = results[0];
    expect(actionResult).toHaveProperty('actionType');
    expect(actionResult).toHaveProperty('success');
    expect(actionResult).toHaveProperty('data');

    // Should be successful
    expect(actionResult.success).toBe(true);
    expect(typeof actionResult.actionType).toBe('string');
  });

  it('should execute GET_WALLET_BALANCE action', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    // Find the wallet balance result
    const walletResult = results.find((r) => r.actionType === 'GET_WALLET_BALANCE');

    expect(walletResult).toBeDefined();
    expect(walletResult?.success).toBe(true);

    const data = walletResult?.data as any;
    expect(data.balances).toBeDefined();
    expect(Array.isArray(data.balances)).toBe(true);
    expect(data.balances.length).toBeGreaterThan(0);
    expect(data.totalUsd).toBeDefined();
  });

  it('should execute GET_MARKET_DATA action', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    // Find the market data result
    const marketResult = results.find((r) => r.actionType === 'GET_MARKET_DATA');

    expect(marketResult).toBeDefined();
    expect(marketResult?.success).toBe(true);

    const data = marketResult?.data as any;
    expect(data.sentiment).toBeDefined();
    expect(data.solPrice).toBeDefined();
    expect(data.solPrice).toBeGreaterThan(0);
  });

  it('should execute ASSESS_PORTFOLIO_RISK action', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    // Find the risk assessment result
    const riskResult = results.find((r) => r.actionType === 'ASSESS_PORTFOLIO_RISK');

    expect(riskResult).toBeDefined();
    expect(riskResult?.success).toBe(true);

    const data = riskResult?.data as any;
    expect(data.riskLevel).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(data.riskLevel);
    expect(data.riskScore).toBeGreaterThanOrEqual(0);
    expect(data.riskScore).toBeLessThanOrEqual(1);
  });

  it('should include all action types in results', async () => {
    const results = await service.executeAnalysisActions(dataActions);

    const actionTypes = results.map((r) => r.actionType);

    expect(actionTypes).toContain('GET_WALLET_BALANCE');
    expect(actionTypes).toContain('GET_MARKET_DATA');
    expect(actionTypes).toContain('ASSESS_PORTFOLIO_RISK');
  });

  it('should handle empty DATA actions gracefully', async () => {
    // Pass empty array
    const results = await service.executeAnalysisActions([]);

    expect(results).toHaveLength(0);
  });

  it('should execute actions in parallel (performance check)', async () => {
    const startTime = Date.now();
    await service.executeAnalysisActions(dataActions);
    const duration = Date.now() - startTime;

    // If executed sequentially, would take ~300ms (3 actions * 100ms each)
    // Parallel execution should be much faster (around 100-150ms)
    // We allow 250ms max to account for overhead
    expect(duration).toBeLessThan(250);
  });
});
