/**
 * Unit tests for ActionCategorizer
 *
 * Tests action categorization with REAL runtime and actions
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { ActionCategorizer } from '../../services/analysis';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
import type { IAgentRuntime } from '@elizaos/core';

describe('ActionCategorizer - categorize', () => {
  let runtime: IAgentRuntime;
  let categorizer: ActionCategorizer;

  beforeAll(async () => {
    // Create REAL runtime with test actions
    runtime = await createTestRuntime({
      testId: 'categorize-test',
      withDataActions: true, // 3 DATA actions
      withActionActions: true, // 2 ACTION actions
    });

    // Create categorizer
    categorizer = new ActionCategorizer(runtime);

    // Setup LLM mock using fixture-based system
    setupLLMMock(runtime, {
      useFixtures: true,
      logPrompts: false,
    });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should categorize all available actions', async () => {
    const result = await categorizer.categorize();

    // Verify structure
    expect(result).toHaveProperty('dataActions');
    expect(result).toHaveProperty('actionActions');
    expect(result).toHaveProperty('classifications');

    // Verify counts (should have many actions now)
    expect(result.classifications.length).toBeGreaterThan(5); // At least 5, but now we have 46+
    expect(result.dataActions.size).toBeGreaterThan(0);
    expect(result.actionActions.size).toBeGreaterThan(0);

    // Verify we have a good mix of DATA and ACTION
    const dataCount = Array.from(result.dataActions.values()).flat().length;
    const actionCount = Array.from(result.actionActions.values()).flat().length;
    expect(dataCount).toBeGreaterThan(3); // More than the original 3
    expect(actionCount).toBeGreaterThan(2); // More than the original 2
  });

  it('should correctly categorize DATA actions', async () => {
    const result = await categorizer.categorize();

    // Check DATA actions
    const dataActionNames = new Set<string>();
    for (const actions of result.dataActions.values()) {
      actions.forEach((action: any) => dataActionNames.add(action.name));
    }

    expect(dataActionNames.has('GET_WALLET_BALANCE')).toBe(true);
    expect(dataActionNames.has('GET_MARKET_DATA')).toBe(true);
    expect(dataActionNames.has('ASSESS_PORTFOLIO_RISK')).toBe(true);
  });

  it('should correctly categorize ACTION actions', async () => {
    const result = await categorizer.categorize();

    // Check ACTION actions
    const actionActionNames = new Set<string>();
    for (const actions of result.actionActions.values()) {
      actions.forEach((action: any) => actionActionNames.add(action.name));
    }

    expect(actionActionNames.has('EXECUTE_SWAP')).toBe(true);
    expect(actionActionNames.has('REBALANCE_PORTFOLIO')).toBe(true);
  });

  it('should group actions by type', async () => {
    const result = await categorizer.categorize();

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
    const result = await categorizer.categorize();

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
    const emptyCategorizer = new ActionCategorizer(emptyRuntime);

    // Setup same LLM mock
    setupLLMMock(emptyRuntime, { useFixtures: true });

    const result = await emptyCategorizer.categorize();

    expect(result.classifications).toHaveLength(0);
    expect(result.dataActions.size).toBe(0);
    expect(result.actionActions.size).toBe(0);

    await cleanupTestRuntime(emptyRuntime);
  });
});
