/**
 * Unit tests for SendoWorkerService.selectRelevantDataActions()
 *
 * Tests LLM-based selection of relevant DATA actions
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';
import type { IAgentRuntime, Action } from '@elizaos/core';
import type { ProviderDataResult } from '../../types/index';

describe('SendoWorkerService - selectRelevantDataActions', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;
  let dataActions: Map<string, Action[]>;

  beforeAll(async () => {
    // Create REAL runtime with DATA actions
    runtime = await createTestRuntime({
      testId: 'select-relevant-test',
      withDataActions: true, // 3 DATA actions
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Prepare dataActions map (grouped by type)
    dataActions = new Map<string, Action[]>();
    const actions = Array.from(runtime.actions.values());

    // Group by action type (simplified for test)
    dataActions.set('wallet_info', [
      actions.find((a) => a.name === 'GET_WALLET_BALANCE')!,
    ]);
    dataActions.set('market_data', [
      actions.find((a) => a.name === 'GET_MARKET_DATA')!,
    ]);
    dataActions.set('risk_assessment', [
      actions.find((a) => a.name === 'ASSESS_PORTFOLIO_RISK')!,
    ]);

    // Setup LLM mock using fixtures
    setupLLMMock(runtime, { useFixtures: true });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should select relevant actions based on LLM decision', async () => {
    const providerData: ProviderDataResult[] = [
      {
        providerName: 'walletContext',
        data: { address: '0x123', network: 'solana' },
        timestamp: new Date().toISOString(),
      },
    ];

    const selected = await service.selectRelevantDataActions(dataActions, providerData);

    // Fixtures select all DATA actions by default
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.every((a) => a !== null)).toBe(true);
  });

  it('should return empty array if no actions are relevant', async () => {
    // Override to return no selections
    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => ({ relevantActions: [], reasoning: 'No actions are relevant' }),
      },
    });

    const providerData: ProviderDataResult[] = [];
    const selected = await service.selectRelevantDataActions(dataActions, providerData);

    expect(selected.length).toBe(0);
  });

  it('should handle LLM errors gracefully', async () => {
    // Override to throw error
    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => {
          throw new Error('LLM service unavailable');
        },
      },
    });

    const providerData: ProviderDataResult[] = [];
    const selected = await service.selectRelevantDataActions(dataActions, providerData);

    // Should return empty array on error (not throw)
    expect(selected.length).toBe(0);
  });

  it('should process multiple action types in parallel', async () => {
    const callOrder: string[] = [];

    setupLLMMock(runtime, {
      useFixtures: true,
      overrides: {
        relevantActions: () => {
          callOrder.push('action-type');
          return { relevantActions: [], reasoning: 'Test' };
        },
      },
    });

    const providerData: ProviderDataResult[] = [];
    await service.selectRelevantDataActions(dataActions, providerData);

    // Should have called LLM for all 3 action types
    expect(callOrder.length).toBe(3);
  });

  it('should pass provider data to LLM prompt', async () => {
    let capturedPrompt = '';

    setupLLMMock(runtime, { useFixtures: true });

    // Override to capture prompt
    const originalUseModel = runtime.useModel;
    runtime.useModel = ((modelType: any, options: any) => {
      capturedPrompt = options.prompt as string;
      return originalUseModel(modelType, options);
    }) as any;

    const providerData: ProviderDataResult[] = [
      {
        providerName: 'walletContext',
        data: { address: '0xABCD', network: 'solana' },
        timestamp: new Date().toISOString(),
      },
    ];

    await service.selectRelevantDataActions(dataActions, providerData);

    // Prompt should include provider data
    expect(capturedPrompt).toContain('walletContext');
    expect(capturedPrompt).toContain('0xABCD');
  });

  it('should handle empty dataActions map', async () => {
    const emptyMap = new Map<string, Action[]>();
    const providerData: ProviderDataResult[] = [];

    const selected = await service.selectRelevantDataActions(emptyMap, providerData);

    expect(selected.length).toBe(0);
  });
});
