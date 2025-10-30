/**
 * Unit tests for ProviderCollector
 *
 * Tests the collection of data from registered providers
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { ProviderCollector } from '../../services/data';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import type { IAgentRuntime } from '@elizaos/core';

describe('ProviderCollector - collect', () => {
  let runtime: IAgentRuntime;
  let collector: ProviderCollector;

  beforeAll(async () => {
    // Create runtime with providers
    runtime = await createTestRuntime({
      testId: 'collect-provider-test',
      withProviders: true,
    });

    collector = new ProviderCollector(runtime);
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should collect data from all registered providers', async () => {
    const results = await collector.collect();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should include provider name, data, and timestamp', async () => {
    const results = await collector.collect();

    for (const result of results) {
      expect(result).toHaveProperty('providerName');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.providerName).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    }
  });

  it('should return valid ISO timestamp', async () => {
    const results = await collector.collect();

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

    const emptyCollector = new ProviderCollector(emptyRuntime);
    const results = await emptyCollector.collect();

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);

    await cleanupTestRuntime(emptyRuntime);
  });

  it('should handle provider errors gracefully', async () => {
    // This test ensures collect doesn't throw if a provider fails
    // The runtime's composeState should handle errors internally

    await expect(collector.collect()).resolves.toBeDefined();
  });

  it('should collect data from multiple providers', async () => {
    const results = await collector.collect();

    // We registered 2 providers in the test runtime
    expect(results.length).toBeGreaterThanOrEqual(2);

    // Check that provider names are unique
    const providerNames = results.map((r: any) => r.providerName);
    const uniqueNames = new Set(providerNames);
    expect(uniqueNames.size).toBe(providerNames.length);
  });

  it('should include expected test providers', async () => {
    const results = await collector.collect();

    const providerNames = results.map((r: any) => r.providerName);

    // Test runtime registers walletContext and timeContext providers
    expect(providerNames).toContain('walletContext');
    expect(providerNames).toContain('timeContext');
  });

  it('should return consistent data structure on multiple calls', async () => {
    const results1 = await collector.collect();
    const results2 = await collector.collect();

    // Same number of providers
    expect(results1.length).toBe(results2.length);

    // Same provider names (order may differ)
    const names1 = results1.map((r: any) => r.providerName).sort();
    const names2 = results2.map((r: any) => r.providerName).sort();
    expect(names1).toEqual(names2);
  });
});
