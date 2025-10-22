/**
 * Unit tests for SendoWorkerService.generateAnalysis()
 *
 * Tests LLM-based analysis generation from action results and provider data
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime } from '@elizaos/core';
import type { AnalysisActionResult, ProviderDataResult } from '../../types/index.js';

describe('SendoWorkerService - generateAnalysis', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create REAL runtime
    runtime = await createTestRuntime({
      testId: 'generate-analysis-test',
    });

    // Create service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Mock LLM to return analysis with 4 sections
    runtime.useModel = mock(() => {
      return Promise.resolve({
        walletOverview: 'Portfolio contains 100 SOL and 5000 USDC. Total value: $15,000.',
        marketConditions: 'SOL trading at $95. Bullish sentiment with 15% gain this week.',
        riskAssessment: 'Medium risk (60/100). High SOL exposure at 66% of portfolio.',
        opportunities: 'Consider rebalancing to 50/50 to reduce volatility and improve risk-adjusted returns.',
      });
    }) as any;
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should generate analysis with all 4 required sections', async () => {
    const analysisResults: AnalysisActionResult[] = [
      {
        actionType: 'GET_WALLET_BALANCE',
        success: true,
        data: { SOL: 100, USDC: 5000 },
      },
    ];

    const providerData: ProviderDataResult[] = [];

    const analysis = await service.generateAnalysis(analysisResults, providerData);

    expect(analysis).toHaveProperty('walletOverview');
    expect(analysis).toHaveProperty('marketConditions');
    expect(analysis).toHaveProperty('riskAssessment');
    expect(analysis).toHaveProperty('opportunities');

    expect(typeof analysis.walletOverview).toBe('string');
    expect(typeof analysis.marketConditions).toBe('string');
    expect(typeof analysis.riskAssessment).toBe('string');
    expect(typeof analysis.opportunities).toBe('string');

    expect(analysis.walletOverview.length).toBeGreaterThan(0);
  });

  it('should include action results in analysis', async () => {
    let capturedPrompt = '';

    runtime.useModel = mock((_modelType: any, options: any) => {
      capturedPrompt = options.prompt as string;
      return Promise.resolve({
        walletOverview: 'Test',
        marketConditions: 'Test',
        riskAssessment: 'Test',
        opportunities: 'Test',
      });
    }) as any;

    const analysisResults: AnalysisActionResult[] = [
      {
        actionType: 'GET_WALLET_BALANCE',
        success: true,
        data: { SOL: 100, USDC: 5000 },
      },
      {
        actionType: 'GET_MARKET_DATA',
        success: true,
        data: { price: 95, sentiment: 'bullish' },
      },
    ];

    const providerData: ProviderDataResult[] = [];

    await service.generateAnalysis(analysisResults, providerData);

    // Prompt should include both action results
    expect(capturedPrompt).toContain('GET_WALLET_BALANCE');
    expect(capturedPrompt).toContain('GET_MARKET_DATA');
    expect(capturedPrompt).toContain('SOL');
    expect(capturedPrompt).toContain('USDC');
  });

  it('should include provider data in analysis', async () => {
    let capturedPrompt = '';

    runtime.useModel = mock((_modelType: any, options: any) => {
      capturedPrompt = options.prompt as string;
      return Promise.resolve({
        walletOverview: 'Test',
        marketConditions: 'Test',
        riskAssessment: 'Test',
        opportunities: 'Test',
      });
    }) as any;

    const analysisResults: AnalysisActionResult[] = [];

    const providerData: ProviderDataResult[] = [
      {
        providerName: 'walletContext',
        data: { address: '0x123', network: 'solana' },
        timestamp: new Date().toISOString(),
      },
      {
        providerName: 'timeContext',
        data: { currentTime: '2025-10-22', marketHours: true },
        timestamp: new Date().toISOString(),
      },
    ];

    await service.generateAnalysis(analysisResults, providerData);

    // Prompt should include provider data
    expect(capturedPrompt).toContain('walletContext');
    expect(capturedPrompt).toContain('timeContext');
    expect(capturedPrompt).toContain('0x123');
    expect(capturedPrompt).toContain('solana');
  });

  it('should handle failed action results', async () => {
    let capturedPrompt = '';

    runtime.useModel = mock((_modelType: any, options: any) => {
      capturedPrompt = options.prompt as string;
      return Promise.resolve({
        walletOverview: 'Test',
        marketConditions: 'Test',
        riskAssessment: 'Test',
        opportunities: 'Test',
      });
    }) as any;

    const analysisResults: AnalysisActionResult[] = [
      {
        actionType: 'GET_WALLET_BALANCE',
        success: true,
        data: { SOL: 100 },
      },
      {
        actionType: 'GET_MARKET_DATA',
        success: false,
        error: 'API rate limit exceeded',
      },
    ];

    const providerData: ProviderDataResult[] = [];

    const analysis = await service.generateAnalysis(analysisResults, providerData);

    // Should still generate analysis
    expect(analysis).toHaveProperty('walletOverview');

    // Prompt should include error information
    expect(capturedPrompt).toContain('Failed');
    expect(capturedPrompt).toContain('API rate limit exceeded');
  });

  it('should handle empty inputs gracefully', async () => {
    const analysisResults: AnalysisActionResult[] = [];
    const providerData: ProviderDataResult[] = [];

    const analysis = await service.generateAnalysis(analysisResults, providerData);

    // Should still generate all sections
    expect(analysis).toHaveProperty('walletOverview');
    expect(analysis).toHaveProperty('marketConditions');
    expect(analysis).toHaveProperty('riskAssessment');
    expect(analysis).toHaveProperty('opportunities');
  });
});
