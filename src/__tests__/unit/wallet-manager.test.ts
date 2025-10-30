/**
 * Unit tests for walletManager utilities
 *
 * Tests wallet creation, balance checking, and persistence
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import {
  ensureSolanaWallet,
  checkWalletBalance,
  getWalletPublicKey,
  hasWallet,
} from '../../utils/walletManager';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import type { IAgentRuntime } from '@elizaos/core';

describe('walletManager - Basic Utilities', () => {
  let runtime: IAgentRuntime;

  beforeAll(async () => {
    // Create runtime without wallet
    runtime = await createTestRuntime({
      testId: 'wallet-manager-test',
    });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  describe('hasWallet', () => {
    it('should return false when no wallet is configured', () => {
      expect(hasWallet(runtime)).toBe(false);
    });

    it('should return true when wallet is configured', () => {
      // Configure wallet
      runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-public-key', false);
      runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private-key', true);

      expect(hasWallet(runtime)).toBe(true);

      // Cleanup
      runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
      runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
    });

    it('should return false when only public key is configured', () => {
      runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-public-key', false);
      expect(hasWallet(runtime)).toBe(false);

      // Cleanup
      runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    });

    it('should return false when only private key is configured', () => {
      runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private-key', true);
      expect(hasWallet(runtime)).toBe(false);

      // Cleanup
      runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
    });
  });

  describe('getWalletPublicKey', () => {
    it('should return null when no wallet is configured', () => {
      expect(getWalletPublicKey(runtime)).toBeNull();
    });

    it('should return public key when wallet is configured', () => {
      const testPublicKey = 'TestPublicKey123456789';
      runtime.setSetting('SOLANA_PUBLIC_KEY', testPublicKey, false);
      runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private-key', true);

      const publicKey = getWalletPublicKey(runtime);
      expect(publicKey).toBe(testPublicKey);

      // Cleanup
      runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
      runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
    });
  });
});

describe('walletManager - ensureSolanaWallet', () => {
  let runtime: IAgentRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime({
      testId: 'ensure-wallet-test',
    });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should return existing wallet if already configured', async () => {
    const testPublicKey = 'ExistingPublicKey123';
    runtime.setSetting('SOLANA_PUBLIC_KEY', testPublicKey, false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'existing-private-key', true);

    const resultPublicKey = await ensureSolanaWallet(runtime);

    expect(resultPublicKey).toBe(testPublicKey);

    // Cleanup
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should throw error if SOLANA_SERVICE is not available', async () => {
    // Ensure no wallet configured
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);

    await expect(ensureSolanaWallet(runtime)).rejects.toThrow(
      'SOLANA_SERVICE required but not available'
    );
  });

  it('should create new wallet when none exists', async () => {
    // Ensure no wallet configured
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);

    // Mock wallet data
    const mockPublicKey = 'NewMockPublicKey' + Date.now();
    const mockPrivateKey = 'NewMockPrivateKey' + Date.now();

    // Mock createWallet
    const mockCreateWallet = mock(async () => ({
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
    }));

    const mockService = { createWallet: mockCreateWallet };

    // Mock getService and updateAgent
    const originalGetService = runtime.getService;
    const originalUpdateAgent = runtime.updateAgent;
    let updateAgentCalled = false;
    let updateAgentData: any = null;

    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    runtime.updateAgent = mock(async (_agentId: any, data: any) => {
      updateAgentCalled = true;
      updateAgentData = data;
      return true;
    }) as any;

    // Create wallet
    const resultPublicKey = await ensureSolanaWallet(runtime);

    // Verify wallet was created
    expect(resultPublicKey).toBe(mockPublicKey);
    expect(mockCreateWallet).toHaveBeenCalled();

    // Verify settings were updated
    expect(runtime.getSetting('SOLANA_PUBLIC_KEY')).toBe(mockPublicKey);
    expect(runtime.getSetting('SOLANA_PRIVATE_KEY')).toBe(mockPrivateKey);

    // Verify updateAgent was called for persistence
    expect(updateAgentCalled).toBe(true);
    expect(updateAgentData).toBeDefined();
    expect(updateAgentData.settings).toBeDefined();
    expect(updateAgentData.updatedAt).toBeDefined();

    // Cleanup
    runtime.getService = originalGetService;
    runtime.updateAgent = originalUpdateAgent;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should be idempotent - calling twice returns same wallet', async () => {
    const testPublicKey = 'IdempotentPublicKey123';
    runtime.setSetting('SOLANA_PUBLIC_KEY', testPublicKey, false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'idempotent-private-key', true);

    // Mock service (should NOT be called)
    const mockCreateWallet = mock(async () => ({
      publicKey: 'ShouldNotBeCreated',
      privateKey: 'ShouldNotBeCreated',
    }));

    const mockService = { createWallet: mockCreateWallet };
    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    // Call twice
    const result1 = await ensureSolanaWallet(runtime);
    const result2 = await ensureSolanaWallet(runtime);

    // Both should return same wallet
    expect(result1).toBe(testPublicKey);
    expect(result2).toBe(testPublicKey);

    // createWallet should NOT have been called
    expect(mockCreateWallet).not.toHaveBeenCalled();

    // Cleanup
    runtime.getService = originalGetService;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should handle createWallet failure gracefully', async () => {
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);

    // Mock createWallet that throws error
    const mockCreateWallet = mock(async () => {
      throw new Error('Network error: Failed to connect to Solana RPC');
    });

    const mockService = { createWallet: mockCreateWallet };
    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    // Should propagate the error
    expect(ensureSolanaWallet(runtime)).rejects.toThrow('Network error');

    // Cleanup
    runtime.getService = originalGetService;
  });
});

describe('walletManager - checkWalletBalance', () => {
  let runtime: IAgentRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime({
      testId: 'check-balance-test',
    });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should throw error if no wallet configured', async () => {
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);

    await expect(checkWalletBalance(runtime)).rejects.toThrow('No wallet configured');
  });

  it('should throw error if SOLANA_SERVICE not available', async () => {
    runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-key', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private', true);

    await expect(checkWalletBalance(runtime)).rejects.toThrow(
      'SOLANA_SERVICE required but not available'
    );

    // Cleanup
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should return balance info when balance is sufficient', async () => {
    const testPublicKey = 'TestPublicKeyForBalance';
    runtime.setSetting('SOLANA_PUBLIC_KEY', testPublicKey, false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private', true);

    // Create mock service with getBalance method
    const mockGetBalance = mock(async () => 1.5);
    const mockService = { getBalance: mockGetBalance };

    // Mock getService to return our mock service
    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    const result = await checkWalletBalance(runtime);

    expect(result.hasBalance).toBe(true);
    expect(result.balance).toBe(1.5);
    expect(result.publicKey).toBe(testPublicKey);

    // Verify getBalance was called
    expect(mockGetBalance).toHaveBeenCalledWith('SOL', testPublicKey);

    // Cleanup
    runtime.getService = originalGetService;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should return hasBalance false when balance < 0.01 SOL', async () => {
    const mockGetBalance = mock(async () => 0.005);
    const mockService = { getBalance: mockGetBalance };

    runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-key', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private', true);

    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    const result = await checkWalletBalance(runtime);

    expect(result.hasBalance).toBe(false);
    expect(result.balance).toBe(0.005);

    // Cleanup
    runtime.getService = originalGetService;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should return hasBalance true when balance = 0.01 SOL (edge case)', async () => {
    const mockGetBalance = mock(async () => 0.01);
    const mockService = { getBalance: mockGetBalance };

    runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-key', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private', true);

    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    const result = await checkWalletBalance(runtime);

    expect(result.hasBalance).toBe(true);
    expect(result.balance).toBe(0.01);

    // Cleanup
    runtime.getService = originalGetService;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });

  it('should return hasBalance false when balance is 0', async () => {
    const mockGetBalance = mock(async () => 0);
    const mockService = { getBalance: mockGetBalance };

    runtime.setSetting('SOLANA_PUBLIC_KEY', 'test-key', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', 'test-private', true);

    const originalGetService = runtime.getService;
    runtime.getService = ((serviceName: string) => {
      if (serviceName === 'SOLANA_SERVICE') return mockService;
      return originalGetService.call(runtime, serviceName);
    }) as any;

    const result = await checkWalletBalance(runtime);

    expect(result.hasBalance).toBe(false);
    expect(result.balance).toBe(0);

    // Cleanup
    runtime.getService = originalGetService;
    runtime.setSetting('SOLANA_PUBLIC_KEY', '', false);
    runtime.setSetting('SOLANA_PRIVATE_KEY', '', true);
  });
});