/**
 * Unit tests for SendoWorkerService.categorizeActions()
 *
 * Tests action categorization with REAL runtime and actions
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime } from '@elizaos/core';

describe('SendoWorkerService - categorizeActions', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create REAL runtime with test actions
    runtime = await createTestRuntime({
      testId: 'categorize-test',
      withDataActions: true, // 3 DATA actions
      withActionActions: true, // 2 ACTION actions
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock LLM calls for categorization (we mock LLM, not the actions!)
    runtime.useModel = mock((_modelType: any, options: any) => {
      const actionName = options.prompt.match(/\*\*Name:\*\*\s*([A-Z_]+)/)?.[1];

      console.log('[TEST] Mock LLM called for action:', actionName);

      // Mock categorization responses based on action name
      if (actionName?.includes('GET_') || actionName?.includes('ASSESS')) {
        const response = {
          category: 'DATA',
          actionType: actionName.includes('BALANCE')
            ? 'wallet_info'
            : actionName.includes('MARKET')
              ? 'market_info'
              : 'risk_info',
          confidence: 0.95,
          reasoning: `${actionName} retrieves data`,
        };
        console.log('[TEST] Categorized as DATA:', response);
        return Promise.resolve(response);
      } else if (actionName?.includes('EXECUTE') || actionName?.includes('REBALANCE')) {
        const response = {
          category: 'ACTION',
          actionType: actionName.includes('SWAP') ? 'swap' : 'rebalance',
          confidence: 0.9,
          reasoning: `${actionName} executes on-chain action`,
        };
        console.log('[TEST] Categorized as ACTION:', response);
        return Promise.resolve(response);
      }

      // Default
      const response = {
        category: 'DATA',
        actionType: 'unknown',
        confidence: 0.5,
        reasoning: 'Unknown action',
      };
      console.log('[TEST] Categorized as DATA (default):', response);
      return Promise.resolve(response);
    }) as any;
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should categorize all available actions', async () => {
    const result = await service.categorizeActions();

    // Verify structure
    expect(result).toHaveProperty('dataActions');
    expect(result).toHaveProperty('actionActions');
    expect(result).toHaveProperty('classifications');

    // Verify counts (3 DATA + 2 ACTION = 5 total)
    expect(result.classifications).toHaveLength(5);
    expect(result.dataActions.size).toBeGreaterThan(0);
    expect(result.actionActions.size).toBeGreaterThan(0);
  });

  it('should correctly categorize DATA actions', async () => {
    const result = await service.categorizeActions();

    // Check DATA actions
    const dataActionNames = new Set<string>();
    for (const actions of result.dataActions.values()) {
      actions.forEach((action) => dataActionNames.add(action.name));
    }

    expect(dataActionNames.has('GET_WALLET_BALANCE')).toBe(true);
    expect(dataActionNames.has('GET_MARKET_DATA')).toBe(true);
    expect(dataActionNames.has('ASSESS_PORTFOLIO_RISK')).toBe(true);
  });

  it('should correctly categorize ACTION actions', async () => {
    const result = await service.categorizeActions();

    // Check ACTION actions
    const actionActionNames = new Set<string>();
    for (const actions of result.actionActions.values()) {
      actions.forEach((action) => actionActionNames.add(action.name));
    }

    expect(actionActionNames.has('EXECUTE_SWAP')).toBe(true);
    expect(actionActionNames.has('REBALANCE_PORTFOLIO')).toBe(true);
  });

  it('should group actions by type', async () => {
    const result = await service.categorizeActions();

    // DATA actions should be grouped
    expect(result.dataActions.size).toBeGreaterThan(0);

    // ACTION actions should be grouped
    expect(result.actionActions.size).toBeGreaterThan(0);

    // Each group should contain actions
    for (const [type, actions] of result.dataActions.entries()) {
      expect(actions.length).toBeGreaterThan(0);
      expect(typeof type).toBe('string');
    }

    for (const [type, actions] of result.actionActions.entries()) {
      expect(actions.length).toBeGreaterThan(0);
      expect(typeof type).toBe('string');
    }
  });

  it('should include classification metadata', async () => {
    const result = await service.categorizeActions();

    // Check first classification has all required fields
    const classification = result.classifications[0];
    expect(classification).toHaveProperty('action');
    expect(classification).toHaveProperty('category');
    expect(classification).toHaveProperty('actionType');
    expect(classification).toHaveProperty('confidence');
    expect(classification).toHaveProperty('reasoning');
    expect(classification).toHaveProperty('pluginName');

    // Verify confidence is a number
    expect(typeof classification.confidence).toBe('number');
    expect(classification.confidence).toBeGreaterThanOrEqual(0);
    expect(classification.confidence).toBeLessThanOrEqual(1);
  });

  it('should handle empty actions gracefully', async () => {
    // Create runtime with NO actions
    const emptyRuntime = await createTestRuntime({ testId: 'empty-test' });
    const emptyService = new SendoWorkerService(emptyRuntime);
    await emptyService.initialize(emptyRuntime);

    emptyRuntime.useModel = runtime.useModel; // Use same mock

    const result = await emptyService.categorizeActions();

    expect(result.classifications).toHaveLength(0);
    expect(result.dataActions.size).toBe(0);
    expect(result.actionActions.size).toBe(0);

    await cleanupTestRuntime(emptyRuntime);
  });
});
