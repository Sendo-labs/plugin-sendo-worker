# Testing Guide

## Overview

This directory contains all tests for the Sendo Worker plugin. Tests are organized into **unit tests** (isolated component testing) and **integration tests** (end-to-end workflows).

## Quick Start

```bash
# Run all tests (with mocked LLM - fast & free)
bun run test:all

# Run only unit tests (mocked)
bun run test:unit

# Run only integration tests (mocked)
bun run test:integration

# Run tests with REAL OpenRouter LLM (costs money!)
bun run test:unit:llm         # Unit tests with real LLM
bun run test:integration:llm  # Integration tests with real LLM
bun run test:all:llm          # All tests with real LLM

# Run a specific test file
bun test src/__tests__/unit/categorize-actions.test.ts
```

## Testing with Real LLM

By default, all tests use **mocked LLM responses** from fixtures. This is fast, free, and deterministic.

However, you can test with a **real OpenRouter LLM** to validate:
- Real LLM response quality
- Prompt engineering changes
- Production-like behavior

### Setup

1. **Install required plugins** (already in devDependencies):
   ```bash
   bun install
   ```

2. **Set your API keys in `.env`**:
   ```bash
   # OpenAI for embeddings
   OPENAI_API_KEY="sk-your-openai-key-here"

   # OpenRouter for LLM
   OPENROUTER_API_KEY="sk-or-v1-your-key-here"
   OPENROUTER_SMALL_MODEL="anthropic/claude-3.5-sonnet"
   OPENROUTER_LARGE_MODEL="anthropic/claude-3.5-sonnet"
   ```

3. **Run tests with real LLM**:
   ```bash
   # Run all integration tests with real LLM
   bun run test:integration:llm

   # Run all unit tests with real LLM
   bun run test:unit:llm

   # Run everything with real LLM
   bun run test:all:llm
   ```

### How It Works

When `USE_REAL_LLM=true`:
1. Test runtime loads `@elizaos/plugin-openai` (for embeddings) and `@elizaos/plugin-openrouter` (for LLM)
2. `setupLLMMock()` detects the flag and skips mocking
3. Real API calls are made to OpenAI and OpenRouter
4. Responses are parsed just like in production

**⚠️ Warning**: This will make **real API calls** and **cost money**. With 46 actions and 27 tests, expect ~100-200 LLM calls per run (~$0.50-$2.00).

### When to Use Real LLM Tests

✅ **Good use cases:**
- Validating prompt changes work with real LLMs
- Testing new action types
- Debugging categorization issues
- Before deploying to production

❌ **Bad use cases:**
- Regular development (use mocks)
- CI/CD pipelines (too slow/expensive)
- Quick iteration on business logic

## Test Structure

```
__tests__/
├── fixtures/           # Centralized test data
│   └── llm-responses.ts   # Predefined LLM responses
├── helpers/            # Test utilities
│   ├── test-runtime.ts    # Runtime creation helpers
│   └── mock-llm.ts        # Intelligent LLM mocking
├── unit/               # Unit tests (isolated)
└── integration/        # Integration tests (end-to-end)
```

## How LLM Mocking Works

### The Problem
The Sendo Worker service uses LLM calls extensively. Testing with real LLMs is slow and expensive. Pattern matching on prompts is fragile.

### The Solution: Fixture-Based Mocking

We use a **2-file system**:

#### 1. **`fixtures/llm-responses.ts`** - Centralized Test Data

Contains predefined LLM responses for all scenarios:

```typescript
// Example: Action categorization responses
export const actionCategorizationFixtures = {
  'GET_WALLET_BALANCE': {
    category: 'DATA',
    actionType: 'wallet_balance',
    confidence: 0.95,
    reasoning: 'Retrieves wallet balance information',
  },
  'REBALANCE_PORTFOLIO': {
    category: 'ACTION',
    actionType: 'portfolio_rebalance',
    confidence: 0.9,
    reasoning: 'Executes portfolio rebalancing',
  },
};

// Helper to get the right fixture
export function getCategorizationResponse(action: Action) {
  return actionCategorizationFixtures[action.name] || fallback;
}
```

#### 2. **`helpers/mock-llm.ts`** - Intelligent Mock System

Detects prompt types and returns appropriate fixtures:

```typescript
export function setupLLMMock(runtime, options = {}) {
  runtime.useModel = ((modelType, params) => {
    const prompt = params.prompt;

    // 1. Detect prompt type by content
    if (prompt.includes('action classifier')) {
      const actionName = extractActionName(prompt);
      return getCategorizationResponse({ name: actionName });
    }

    if (prompt.includes('determining which data collection actions')) {
      return relevantActionsFixtures.default;
    }

    // ... other prompt types
  });
}
```

## Writing Tests

### Basic Unit Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { SendoWorkerService } from '../../services/sendoWorkerService';
import { createTestRuntime, cleanupTestRuntime } from '../helpers/test-runtime';
import { setupLLMMock } from '../helpers/mock-llm';

describe('MyFeature', () => {
  let runtime;
  let service;

  beforeAll(async () => {
    // Create test runtime with mock actions
    runtime = await createTestRuntime({
      testId: 'my-test',
      withDataActions: true,
      withActionActions: true,
    });

    // Initialize service
    service = new SendoWorkerService(runtime);
    await service.initialize(runtime);

    // Setup LLM mock (one line!)
    setupLLMMock(runtime, { useFixtures: true });
  });

  afterAll(async () => {
    await cleanupTestRuntime(runtime);
  });

  it('should do something', async () => {
    const result = await service.myMethod();
    expect(result).toBeDefined();
  });
});
```

### Custom LLM Responses

Override specific responses for edge cases:

```typescript
it('should handle LLM errors gracefully', async () => {
  setupLLMMock(runtime, {
    useFixtures: true,
    overrides: {
      relevantActions: () => {
        throw new Error('LLM service unavailable');
      }
    }
  });

  const result = await service.selectRelevantDataActions(dataActions, []);

  // Should handle error gracefully
  expect(result.length).toBe(0);
});
```

### Debugging LLM Mocks

Enable logging to see what prompts are being sent:

```typescript
setupLLMMock(runtime, {
  useFixtures: true,
  logPrompts: true  // Shows prompt type detection
});
```

## Adding New Fixtures

When adding a new LLM-based feature:

1. **Add fixture data** to `fixtures/llm-responses.ts`:
```typescript
export const myNewFeatureFixtures = {
  default: { /* response data */ },
  edgeCase: { /* edge case data */ },
};

export function getMyFeatureResponse(context) {
  return myNewFeatureFixtures.default;
}
```

2. **Add detection** to `helpers/mock-llm.ts`:
```typescript
// In setupLLMMock function
if (prompt.includes('my new feature keyword')) {
  if (overrides.myFeature) {
    return Promise.resolve(overrides.myFeature());
  }

  if (useFixtures) {
    return Promise.resolve(getMyFeatureResponse(context));
  }
}
```

3. **Write tests** using the new mock:
```typescript
it('should handle my new feature', async () => {
  setupLLMMock(runtime, { useFixtures: true });
  const result = await service.myNewFeature();
  expect(result).toBeDefined();
});
```

## Test Coverage

Current coverage: **98 tests passing**
- ✅ 63 unit tests
- ✅ 27 integration tests
- ✅ 8 database tests

Run with coverage:
```bash
bun test --coverage
```

## Best Practices

### ✅ DO
- Use `setupLLMMock()` for all LLM-dependent tests
- Add fixtures for common scenarios
- Use overrides for edge cases
- Clean up resources in `afterAll()`
- Test both success and error paths

### ❌ DON'T
- Don't use inline pattern matching mocks
- Don't create runtime without cleaning up
- Don't test with real LLM in unit tests
- Don't duplicate fixture data

## Troubleshooting

### Tests fail with "Action not found"
Make sure you're creating the right action types:
```typescript
runtime = await createTestRuntime({
  withDataActions: true,    // Adds GET_*, ASSESS_* actions
  withActionActions: true,  // Adds EXECUTE_*, REBALANCE_* actions
});
```

### LLM mock returns unexpected data
Enable logging to debug:
```typescript
setupLLMMock(runtime, { useFixtures: true, logPrompts: true });
```

Check the console output to see:
- Which prompt type was detected
- What fixture was returned
- If prompt detection failed (returns fallback)

### Database constraint violations
Ensure you're calling `cleanupTestRuntime()` in `afterAll()`:
```typescript
afterAll(async () => {
  await cleanupTestRuntime(runtime);
});
```

## Future Improvements

- [x] Enable real LLM testing with environment flag ✅
- [ ] Add performance benchmarks
- [ ] Generate coverage reports in CI
- [ ] Add visual regression tests for API responses

## Questions?

Check the existing tests for examples, or ask in the team chat!
