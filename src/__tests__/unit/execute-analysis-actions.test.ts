/**
 * Unit tests for DataExecutor.execute()
 *
 * Tests parallel execution of DATA actions with dynamic triggers
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { DataExecutor } from '../../services/data';
import { ActionCategorizer } from '../../services/analysis';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
import type { IAgentRuntime, Action, UUID } from '@elizaos/core';

describe('DataExecutor - execute', () => {
  let runtime: IAgentRuntime;
  let executor: DataExecutor;
  let dataActions: Action[];

  beforeAll(async () => {
    // Create REAL runtime with DATA actions only and isolated DB
    runtime = await createTestRuntime({
      testId: 'execute-analysis-test',
      withDataActions: true, // 3 DATA actions
      withActionActions: false, // No ACTION actions needed
    });

    // Helper function to get agent world ID
    const getAgentWorldId = (): UUID => {
      return (runtime as any).agentId as UUID;
    };

    // Create executor
    executor = new DataExecutor(runtime, getAgentWorldId);

    // Setup LLM mock using fixture-based system
    setupLLMMock(runtime, {
      useFixtures: true,
      logPrompts: false,
    });

    // First, categorize actions to populate dataActions map
    const categorizer = new ActionCategorizer(runtime);
    const categorization = await categorizer.categorize();

    // Extract all DATA actions from the map
    dataActions = [];
    for (const actions of categorization.dataActions.values()) {
      dataActions.push(...actions);
    }
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should execute all DATA actions in parallel', async () => {
    const { results, roomIds } = await executor.execute(dataActions);

    // Should have executed all selected DATA actions (now we have many more)
    expect(results.length).toBeGreaterThan(3); // At least 3, now we have 18+

    // All should be successful
    const successCount = results.filter((r: any) => r.success).length;
    expect(successCount).toBe(results.length); // All should succeed

    // Should have created rooms for cleanup
    expect(roomIds.length).toBe(results.length);
  });

  it('should return AnalysisActionResult objects with correct structure', async () => {
    const { results } = await executor.execute(dataActions);

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
    const { results } = await executor.execute(dataActions);

    // Find the wallet balance result
    const walletResult = results.find((r: any) => r.actionType === 'GET_WALLET_BALANCE');

    expect(walletResult).toBeDefined();
    expect(walletResult?.success).toBe(true);

    const data = walletResult?.data as any;
    expect(data.balances).toBeDefined();
    expect(Array.isArray(data.balances)).toBe(true);
    expect(data.balances.length).toBeGreaterThan(0);
    expect(data.totalUsd).toBeDefined();
  });

  it('should execute GET_MARKET_DATA action', async () => {
    const { results } = await executor.execute(dataActions);

    // Find the market data result
    const marketResult = results.find((r: any) => r.actionType === 'GET_MARKET_DATA');

    expect(marketResult).toBeDefined();
    expect(marketResult?.success).toBe(true);

    const data = marketResult?.data as any;
    expect(data.sentiment).toBeDefined();
    expect(data.solPrice).toBeDefined();
    expect(data.solPrice).toBeGreaterThan(0);
  });

  it('should execute ASSESS_PORTFOLIO_RISK action', async () => {
    const { results } = await executor.execute(dataActions);

    // Find the risk assessment result
    const riskResult = results.find((r: any) => r.actionType === 'ASSESS_PORTFOLIO_RISK');

    expect(riskResult).toBeDefined();
    expect(riskResult?.success).toBe(true);

    const data = riskResult?.data as any;
    expect(data.riskLevel).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(data.riskLevel);
    expect(data.riskScore).toBeGreaterThanOrEqual(0);
    expect(data.riskScore).toBeLessThanOrEqual(1);
  });

  it('should include all action types in results', async () => {
    const { results } = await executor.execute(dataActions);

    const actionTypes = results.map((r: any) => r.actionType);

    expect(actionTypes).toContain('GET_WALLET_BALANCE');
    expect(actionTypes).toContain('GET_MARKET_DATA');
    expect(actionTypes).toContain('ASSESS_PORTFOLIO_RISK');
  });

  it('should handle empty DATA actions gracefully', async () => {
    // Pass empty array
    const { results, roomIds } = await executor.execute([]);

    expect(results).toHaveLength(0);
    expect(roomIds).toHaveLength(0);
  });

  it('should execute actions in parallel (performance check)', async () => {
    const startTime = Date.now();
    await executor.execute(dataActions);
    const duration = Date.now() - startTime;

    // If executed sequentially, would take ~300ms (3 actions * 100ms each)
    // Parallel execution should be much faster (around 100-150ms)
    // We allow 250ms max to account for overhead
    expect(duration).toBeLessThan(250);
  });
});
