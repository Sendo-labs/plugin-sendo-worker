import { IAgentRuntime, UUID, logger, type Memory } from '@elizaos/core';
import type { ProviderDataResult } from '../../types/index';

/**
 * ProviderCollector
 *
 * Collects data from all available providers via composeState.
 * Providers include context information like wallet, time, market data, etc.
 */
export class ProviderCollector {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Collect data from all available providers via composeState
   * @returns Array of provider data results
   */
  async collect(): Promise<ProviderDataResult[]> {
    logger.info('[ProviderCollector] Collecting data from providers...');

    // Create a minimal memory for state composition
    const memory: Memory = {
      id: crypto.randomUUID() as UUID,
      entityId: this.runtime.agentId,
      agentId: this.runtime.agentId,
      roomId: crypto.randomUUID() as UUID,
      content: { text: 'Collecting provider data for analysis' },
      createdAt: Date.now(),
    };

    // Compose state - this automatically calls all non-private, non-dynamic providers
    const state = await this.runtime.composeState(memory);

    // Extract provider data from state.data.providers
    const providers = state.data?.providers || {};
    const timestamp = new Date().toISOString();

    const results: ProviderDataResult[] = Object.entries(providers).map(
      ([name, providerResult]) => ({
        providerName: name,
        data: providerResult,
        timestamp,
      })
    );

    logger.info(`[ProviderCollector] Collected data from ${results.length} providers`);
    return results;
  }
}
