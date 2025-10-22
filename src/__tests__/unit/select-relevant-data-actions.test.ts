/**
 * Unit tests for SendoWorkerService.selectRelevantDataActions()
 *
 * Tests LLM-based selection of relevant DATA actions
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime, Action } from '@elizaos/core';
import type { ProviderDataResult } from '../../types/index.js';

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

    // Mock LLM for selection
    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Check which type is being selected based on prompt content
      if (prompt.includes('GET_WALLET_BALANCE')) {
        return Promise.resolve({
          relevantActions: ['GET_WALLET_BALANCE'], // Select it
          reasoning: 'Wallet balance is essential for portfolio analysis',
        });
      }

      if (prompt.includes('GET_MARKET_DATA')) {
        return Promise.resolve({
          relevantActions: ['GET_MARKET_DATA'], // Select it
          reasoning: 'Market data needed for analysis',
        });
      }

      if (prompt.includes('ASSESS_PORTFOLIO_RISK')) {
        return Promise.resolve({
          relevantActions: [], // Don't select it
          reasoning: 'Risk assessment not needed at this time',
        });
      }

      return Promise.resolve({
        relevantActions: [],
        reasoning: 'Not relevant',
      });
    }) as any;
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

    // Should select 2 out of 3 actions (wallet + market, but not risk)
    expect(selected.length).toBe(2);
    expect(selected.map((a) => a.name)).toContain('GET_WALLET_BALANCE');
    expect(selected.map((a) => a.name)).toContain('GET_MARKET_DATA');
    expect(selected.map((a) => a.name)).not.toContain('ASSESS_PORTFOLIO_RISK');
  });

  it('should return empty array if no actions are relevant', async () => {
    // Mock to return no selections
    runtime.useModel = mock(() => {
      return Promise.resolve({
        relevantActions: [],
        reasoning: 'No actions are relevant',
      });
    }) as any;

    const providerData: ProviderDataResult[] = [];
    const selected = await service.selectRelevantDataActions(dataActions, providerData);

    expect(selected.length).toBe(0);
  });

  it('should handle LLM errors gracefully', async () => {
    // Mock to throw error
    runtime.useModel = mock(() => {
      return Promise.reject(new Error('LLM service unavailable'));
    }) as any;

    const providerData: ProviderDataResult[] = [];
    const selected = await service.selectRelevantDataActions(dataActions, providerData);

    // Should return empty array on error (not throw)
    expect(selected.length).toBe(0);
  });

  it('should process multiple action types in parallel', async () => {
    const callOrder: string[] = [];

    runtime.useModel = mock((_modelType: any, options: any) => {
      const prompt = options.prompt as string;

      // Track call order
      if (prompt.includes('GET_WALLET_BALANCE')) {
        callOrder.push('wallet');
      } else if (prompt.includes('GET_MARKET_DATA')) {
        callOrder.push('market');
      } else if (prompt.includes('ASSESS_PORTFOLIO_RISK')) {
        callOrder.push('risk');
      }

      return Promise.resolve({
        relevantActions: [],
        reasoning: 'Test',
      });
    }) as any;

    const providerData: ProviderDataResult[] = [];
    await service.selectRelevantDataActions(dataActions, providerData);

    // Should have called LLM for all 3 types
    expect(callOrder.length).toBe(3);
    expect(callOrder).toContain('wallet');
    expect(callOrder).toContain('market');
    expect(callOrder).toContain('risk');
  });

  it('should pass provider data to LLM prompt', async () => {
    let capturedPrompt = '';

    runtime.useModel = mock((_modelType: any, options: any) => {
      capturedPrompt = options.prompt as string;
      return Promise.resolve({
        relevantActions: [],
        reasoning: 'Test',
      });
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
