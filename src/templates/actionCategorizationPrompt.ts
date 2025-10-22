import type { Action } from '@elizaos/core';

export interface ActionCategorizationPromptParams {
  action: Action;
}

/**
 * Prompt for categorizing a single action as DATA or ACTION with specific type
 */
export const actionCategorizationPrompt = ({
  action,
}: ActionCategorizationPromptParams): string => {
  const examplesText =
    action.examples && action.examples.length > 0
      ? `\n## Example Usage\n${action.examples
          .slice(0, 2)
          .map((conversation, idx) => {
            return `Example ${idx + 1}:\n${conversation
              .map((msg) => `  ${msg.name}: "${msg.content.text}"`)
              .join('\n')}`;
          })
          .join('\n\n')}`
      : '';

  const similesText =
    action.similes && action.similes.length > 0
      ? `\n## Alternative Names\n${action.similes.join(', ')}`
      : '';

  return `You are an action classifier for a blockchain AI agent system.

Your task is to categorize a single action into one of two main categories, and assign a specific type.

## Main Categories

1. **DATA** - Read-only operations that gather information or analyze data
   - No state changes, no transactions, no mutations
   - Purpose: Data collection, analysis, queries

2. **ACTION** - Write operations that modify state or execute transactions
   - State changes, blockchain transactions, external mutations
   - Purpose: Execute actions, modify data, send transactions

## DATA Action Types
- GET_BALANCE: Get wallet balances
- GET_PRICE: Get token/asset prices
- GET_PORTFOLIO: Get portfolio information
- GET_TRANSACTIONS: Get transaction history
- GET_NFT: Get NFT data
- GET_MARKET_DATA: Get market conditions/trends
- SEARCH: Search for information
- ANALYZE: Analyze data or conditions
- READ: Read messages/content
- OTHER: Other read-only operations

## ACTION Action Types
- SWAP: Exchange tokens
- TRANSFER: Send tokens/assets
- STAKE: Stake tokens
- UNSTAKE: Unstake tokens
- BRIDGE: Bridge assets cross-chain
- NFT_MINT: Mint NFTs
- NFT_TRANSFER: Transfer NFTs
- LIQUIDITY_ADD: Add liquidity to pools
- LIQUIDITY_REMOVE: Remove liquidity from pools
- GOVERNANCE_VOTE: Vote on governance proposals
- SOCIAL_POST: Post on social media
- OTHER: Other write operations

## Action to Classify

**Name:** ${action.name}

**Description:** ${action.description}
${similesText}
${examplesText}

## Classification Task

Analyze the action above and determine:
1. Is this action DATA (read-only) or ACTION (write operation)?
2. What specific type best describes this action?
3. How confident are you in this classification (0.0 to 1.0)?

## Response Format

Return a JSON object with:
{
  "category": "DATA" | "ACTION",
  "actionType": "one of the types listed above",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this action belongs in this category and type"
}

Be precise and consider the action's actual behavior, not just its name.`;
};
