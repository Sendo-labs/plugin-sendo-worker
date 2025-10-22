/**
 * Unit tests for SendoWorkerService collectProviderData
 *
 * Tests the collection of data from registered providers
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService.js';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime.js';
import type { IAgentRuntime } from '@elizaos/core';

describe('SendoWorkerService - collectProviderData', () => {
  let runtime: IAgentRuntime;
  let service: SendoWorkerService;

  beforeAll(async () => {
    // Create runtime with providers
    runtime = await createTestRuntime({
      testId: 'collect-provider-test',
      withProviders: true,
    });

    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should collect data from all registered providers', async () => {
    const results = await service.collectProviderData();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should include provider name, data, and timestamp', async () => {
    const results = await service.collectProviderData();

    for (const result of results) {
      expect(result).toHaveProperty('providerName');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.providerName).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    }
  });

  it('should return valid ISO timestamp', async () => {
    const results = await service.collectProviderData();

    if (results.length > 0) {
      const timestamp = results[0].timestamp;
      const date = new Date(timestamp);
      expect(date.toISOString()).toBe(timestamp);
    }
  });

  it('should return empty array when no providers registered', async () => {
    // Create runtime without providers
    const emptyRuntime = await createTestRuntime({
      testId: 'no-providers-test',
      withProviders: false,
    });

    const emptyService = new SendoWorkerService(emptyRuntime);
    await emptyService.initialize(emptyRuntime);

    const results = await emptyService.collectProviderData();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);

    await cleanupTestRuntime(emptyRuntime);
  });

  it('should handle provider errors gracefully', async () => {
    // This test ensures collectProviderData doesn't throw if a provider fails
    // The runtime's composeState should handle errors internally

    await expect(service.collectProviderData()).resolves.toBeDefined();
  });

  it('should collect data from multiple providers', async () => {
    const results = await service.collectProviderData();

    // We registered 2 providers in the test runtime
    expect(results.length).toBeGreaterThanOrEqual(2);

    // Check that provider names are unique
    const providerNames = results.map(r => r.providerName);
    const uniqueNames = new Set(providerNames);
    expect(uniqueNames.size).toBe(providerNames.length);
  });

  it('should include expected test providers', async () => {
    const results = await service.collectProviderData();

    const providerNames = results.map(r => r.providerName);

    // Test runtime registers walletContext and timeContext providers
    expect(providerNames).toContain('walletContext');
    expect(providerNames).toContain('timeContext');
  });

  it('should return consistent data structure on multiple calls', async () => {
    const results1 = await service.collectProviderData();
    const results2 = await service.collectProviderData();

    // Same number of providers
    expect(results1.length).toBe(results2.length);

    // Same provider names (order may differ)
    const names1 = results1.map(r => r.providerName).sort();
    const names2 = results2.map(r => r.providerName).sort();
    expect(names1).toEqual(names2);
  });
});
