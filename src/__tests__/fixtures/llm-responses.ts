/**
 * LLM Response Fixtures
 *
 * Provides predefined LLM responses based on prompt templates.
 * This is more robust than pattern matching on action names.
 */

import type { Action } from '@elizaos/core';

/**
 * Action categorization responses
 * Maps action names to their expected categorization
 */
export const actionCategorizationFixtures: Record<string, {
  category: 'DATA' | 'ACTION';
  actionType: string;
  confidence: number;
  reasoning: string;
}> = {
  // ============================================
  // DATA ACTIONS - Wallet & Portfolio Info
  // ============================================
  'GET_WALLET_BALANCE': {
    category: 'DATA',
    actionType: 'wallet_balance',
    confidence: 0.95,
    reasoning: 'Retrieves wallet balance information - pure data query with no state changes',
  },
  'GET_TOKEN_HOLDINGS': {
    category: 'DATA',
    actionType: 'token_holdings',
    confidence: 0.95,
    reasoning: 'Lists all SPL token holdings in wallet - read-only operation',
  },
  'GET_TRANSACTION_HISTORY': {
    category: 'DATA',
    actionType: 'transaction_history',
    confidence: 0.92,
    reasoning: 'Fetches wallet transaction history - historical data query',
  },
  'GET_NFT_PORTFOLIO': {
    category: 'DATA',
    actionType: 'nft_portfolio',
    confidence: 0.90,
    reasoning: 'Retrieves NFT collection in wallet - read-only metadata query',
  },
  'GET_PORTFOLIO_VALUE': {
    category: 'DATA',
    actionType: 'portfolio_value',
    confidence: 0.93,
    reasoning: 'Calculates total portfolio USD value - computational analysis',
  },

  // ============================================
  // DATA ACTIONS - Market & Price Data
  // ============================================
  'GET_MARKET_DATA': {
    category: 'DATA',
    actionType: 'market_data',
    confidence: 0.90,
    reasoning: 'Fetches market data and prices - read-only operation',
  },
  'GET_TOKEN_PRICE': {
    category: 'DATA',
    actionType: 'token_price',
    confidence: 0.94,
    reasoning: 'Gets current token price from DEX/Oracle - price feed query',
  },
  'GET_PRICE_HISTORY': {
    category: 'DATA',
    actionType: 'price_history',
    confidence: 0.88,
    reasoning: 'Retrieves historical price charts - time-series data',
  },
  'GET_DEX_LIQUIDITY': {
    category: 'DATA',
    actionType: 'dex_liquidity',
    confidence: 0.87,
    reasoning: 'Checks liquidity pools on Raydium/Orca - read-only pool data',
  },
  'GET_TRADING_VOLUME': {
    category: 'DATA',
    actionType: 'trading_volume',
    confidence: 0.86,
    reasoning: 'Fetches 24h trading volume - market statistics',
  },

  // ============================================
  // DATA ACTIONS - DeFi Positions
  // ============================================
  'GET_STAKING_POSITIONS': {
    category: 'DATA',
    actionType: 'staking_info',
    confidence: 0.93,
    reasoning: 'Retrieves active staking positions and rewards - read-only validator data',
  },
  'GET_LENDING_POSITIONS': {
    category: 'DATA',
    actionType: 'lending_info',
    confidence: 0.91,
    reasoning: 'Gets lending/borrowing positions on Solend/MarginFi - position data',
  },
  'GET_LP_POSITIONS': {
    category: 'DATA',
    actionType: 'liquidity_positions',
    confidence: 0.90,
    reasoning: 'Lists liquidity provider positions - AMM position data',
  },
  'GET_YIELD_OPPORTUNITIES': {
    category: 'DATA',
    actionType: 'yield_farming',
    confidence: 0.85,
    reasoning: 'Scans for yield farming opportunities - DeFi data aggregation',
  },

  // ============================================
  // DATA ACTIONS - Risk & Analytics
  // ============================================
  'ASSESS_PORTFOLIO_RISK': {
    category: 'DATA',
    actionType: 'risk_assessment',
    confidence: 0.85,
    reasoning: 'Analyzes portfolio risk - computational analysis without blockchain interaction',
  },
  'CALCULATE_IMPERMANENT_LOSS': {
    category: 'DATA',
    actionType: 'il_calculation',
    confidence: 0.82,
    reasoning: 'Calculates impermanent loss for LP positions - mathematical computation',
  },
  'ANALYZE_WALLET_HEALTH': {
    category: 'DATA',
    actionType: 'wallet_health',
    confidence: 0.88,
    reasoning: 'Evaluates wallet health score - risk metrics calculation',
  },
  'GET_GAS_ESTIMATES': {
    category: 'DATA',
    actionType: 'gas_estimation',
    confidence: 0.90,
    reasoning: 'Estimates transaction costs - fee calculation',
  },

  // ============================================
  // ACTION ACTIONS - Token Swaps
  // ============================================
  'EXECUTE_SWAP': {
    category: 'ACTION',
    actionType: 'swap',
    confidence: 0.95,
    reasoning: 'Executes token swap - modifies blockchain state',
  },
  'SWAP_VIA_JUPITER': {
    category: 'ACTION',
    actionType: 'jupiter_swap',
    confidence: 0.94,
    reasoning: 'Executes swap through Jupiter aggregator - on-chain transaction',
  },
  'LIMIT_ORDER_CREATE': {
    category: 'ACTION',
    actionType: 'limit_order',
    confidence: 0.92,
    reasoning: 'Creates limit order on DEX - places order on-chain',
  },
  'DCA_ORDER_CREATE': {
    category: 'ACTION',
    actionType: 'dca_order',
    confidence: 0.90,
    reasoning: 'Sets up dollar-cost averaging - recurring swap schedule',
  },

  // ============================================
  // ACTION ACTIONS - Portfolio Management
  // ============================================
  'REBALANCE_PORTFOLIO': {
    category: 'ACTION',
    actionType: 'rebalance',
    confidence: 0.90,
    reasoning: 'Rebalances portfolio allocation - executes multiple swaps',
  },
  'AUTO_COMPOUND_REWARDS': {
    category: 'ACTION',
    actionType: 'auto_compound',
    confidence: 0.88,
    reasoning: 'Automatically compounds yield rewards - restakes earnings',
  },
  'STOP_LOSS_SET': {
    category: 'ACTION',
    actionType: 'stop_loss',
    confidence: 0.93,
    reasoning: 'Sets stop-loss order - risk management transaction',
  },
  'TAKE_PROFIT_SET': {
    category: 'ACTION',
    actionType: 'take_profit',
    confidence: 0.91,
    reasoning: 'Sets take-profit trigger - automated exit strategy',
  },

  // ============================================
  // ACTION ACTIONS - Staking & Validation
  // ============================================
  'STAKE_SOL': {
    category: 'ACTION',
    actionType: 'staking',
    confidence: 0.96,
    reasoning: 'Stakes SOL with validator - creates stake account on-chain',
  },
  'UNSTAKE_SOL': {
    category: 'ACTION',
    actionType: 'unstaking',
    confidence: 0.94,
    reasoning: 'Deactivates and withdraws staked SOL - modifies stake account',
  },
  'CLAIM_STAKING_REWARDS': {
    category: 'ACTION',
    actionType: 'claim_rewards',
    confidence: 0.92,
    reasoning: 'Claims accumulated staking rewards - transfers earned SOL',
  },
  'CHANGE_VALIDATOR': {
    category: 'ACTION',
    actionType: 'validator_change',
    confidence: 0.89,
    reasoning: 'Switches to different validator - re-delegates stake',
  },

  // ============================================
  // ACTION ACTIONS - DeFi Lending
  // ============================================
  'SUPPLY_COLLATERAL': {
    category: 'ACTION',
    actionType: 'supply_lending',
    confidence: 0.93,
    reasoning: 'Supplies assets to lending protocol - deposits collateral',
  },
  'BORROW_ASSET': {
    category: 'ACTION',
    actionType: 'borrow_lending',
    confidence: 0.91,
    reasoning: 'Borrows against collateral - creates debt position',
  },
  'REPAY_LOAN': {
    category: 'ACTION',
    actionType: 'repay_lending',
    confidence: 0.95,
    reasoning: 'Repays borrowed amount - reduces debt position',
  },
  'WITHDRAW_COLLATERAL': {
    category: 'ACTION',
    actionType: 'withdraw_lending',
    confidence: 0.92,
    reasoning: 'Withdraws supplied collateral - exits lending position',
  },

  // ============================================
  // ACTION ACTIONS - Liquidity Provision
  // ============================================
  'ADD_LIQUIDITY': {
    category: 'ACTION',
    actionType: 'add_liquidity',
    confidence: 0.94,
    reasoning: 'Adds liquidity to AMM pool - provides both tokens to pool',
  },
  'REMOVE_LIQUIDITY': {
    category: 'ACTION',
    actionType: 'remove_liquidity',
    confidence: 0.93,
    reasoning: 'Removes liquidity from pool - withdraws LP position',
  },
  'CLAIM_LP_FEES': {
    category: 'ACTION',
    actionType: 'claim_lp_fees',
    confidence: 0.90,
    reasoning: 'Claims accumulated trading fees - harvests LP rewards',
  },
  'MIGRATE_LIQUIDITY': {
    category: 'ACTION',
    actionType: 'migrate_liquidity',
    confidence: 0.87,
    reasoning: 'Migrates LP position to different pool - moves liquidity',
  },

  // ============================================
  // ACTION ACTIONS - NFT Operations
  // ============================================
  'LIST_NFT_FOR_SALE': {
    category: 'ACTION',
    actionType: 'nft_list',
    confidence: 0.92,
    reasoning: 'Lists NFT on marketplace - creates listing transaction',
  },
  'BUY_NFT': {
    category: 'ACTION',
    actionType: 'nft_buy',
    confidence: 0.94,
    reasoning: 'Purchases NFT from marketplace - executes buy transaction',
  },
  'CANCEL_NFT_LISTING': {
    category: 'ACTION',
    actionType: 'nft_cancel',
    confidence: 0.90,
    reasoning: 'Cancels active NFT listing - removes from marketplace',
  },
  'MAKE_NFT_OFFER': {
    category: 'ACTION',
    actionType: 'nft_offer',
    confidence: 0.88,
    reasoning: 'Makes offer on NFT - creates escrow for offer',
  },

  // ============================================
  // ACTION ACTIONS - Advanced DeFi
  // ============================================
  'FLASH_LOAN_ARBITRAGE': {
    category: 'ACTION',
    actionType: 'flash_loan',
    confidence: 0.85,
    reasoning: 'Executes flash loan arbitrage - complex multi-step transaction',
  },
  'LEVERAGE_POSITION': {
    category: 'ACTION',
    actionType: 'leverage',
    confidence: 0.87,
    reasoning: 'Opens leveraged position - borrows to amplify exposure',
  },
  'CLOSE_LEVERAGE': {
    category: 'ACTION',
    actionType: 'deleverage',
    confidence: 0.89,
    reasoning: 'Closes leveraged position - repays loan and exits',
  },
  'HEDGE_POSITION': {
    category: 'ACTION',
    actionType: 'hedging',
    confidence: 0.86,
    reasoning: 'Opens hedge with derivatives - risk mitigation strategy',
  },
};

/**
 * Relevant actions selection responses
 * Maps context to selected action names
 */
export const relevantActionsFixtures = {
  // Basic wallet analysis
  basicAnalysis: {
    relevantActions: ['GET_WALLET_BALANCE', 'GET_TOKEN_HOLDINGS', 'GET_MARKET_DATA'],
    reasoning: 'Basic portfolio overview requires balance, holdings, and market data',
  },

  // Comprehensive DeFi analysis
  defiAnalysis: {
    relevantActions: [
      'GET_WALLET_BALANCE',
      'GET_STAKING_POSITIONS',
      'GET_LENDING_POSITIONS',
      'GET_LP_POSITIONS',
      'GET_YIELD_OPPORTUNITIES',
    ],
    reasoning: 'DeFi analysis needs all position data and yield opportunities',
  },

  // Risk assessment focused
  riskFocused: {
    relevantActions: [
      'GET_PORTFOLIO_VALUE',
      'ASSESS_PORTFOLIO_RISK',
      'ANALYZE_WALLET_HEALTH',
      'CALCULATE_IMPERMANENT_LOSS',
    ],
    reasoning: 'Risk analysis requires portfolio metrics and health checks',
  },

  // NFT portfolio analysis
  nftAnalysis: {
    relevantActions: ['GET_NFT_PORTFOLIO', 'GET_WALLET_BALANCE', 'GET_MARKET_DATA'],
    reasoning: 'NFT analysis needs collection data and market context',
  },

  // Trading opportunity scan
  tradingOpportunities: {
    relevantActions: [
      'GET_TOKEN_PRICE',
      'GET_DEX_LIQUIDITY',
      'GET_TRADING_VOLUME',
      'GET_PRICE_HISTORY',
    ],
    reasoning: 'Trading analysis requires price, liquidity, and volume data',
  },

  // Default - select all essential DATA actions
  default: {
    relevantActions: [
      'GET_WALLET_BALANCE',
      'GET_TOKEN_HOLDINGS',
      'GET_MARKET_DATA',
      'ASSESS_PORTFOLIO_RISK',
    ],
    reasoning: 'Comprehensive analysis requires all available data',
  },
};

/**
 * Analysis generation responses
 */
export const analysisFixtures = {
  // Basic balanced portfolio
  default: {
    walletOverview: 'Wallet holds 10 SOL and 500 USDC across Solana mainnet',
    marketConditions: 'SOL trading at $150 with bullish sentiment',
    riskAssessment: 'Medium risk - concentrated position in SOL',
    opportunities: 'Consider diversifying into USDC or staking SOL for yield',
  },

  // Strong bull market scenario
  bullMarket: {
    walletOverview: 'Portfolio: 10 SOL ($1,500), 500 USDC, 2 staking positions. Total: ~$2,000',
    marketConditions: 'Strong bull market - SOL up 20% this week, high volume (24h: $1.2B)',
    riskAssessment: 'Low risk - favorable market conditions, staking provides downside protection',
    opportunities: 'Good time to increase SOL exposure or add leveraged staking positions',
  },

  // Bear market scenario
  bearMarket: {
    walletOverview: 'Portfolio: 10 SOL ($1,200), 500 USDC, underwater LP positions. Total declining',
    marketConditions: 'Bear market - SOL down 15% week-over-week, declining liquidity',
    riskAssessment: 'High risk - market downturn with potential for further decline',
    opportunities: 'Consider exiting risky DeFi positions and moving to stablecoins',
  },

  // DeFi-heavy portfolio
  defiHeavy: {
    walletOverview: 'Active DeFi user: 5 SOL staked, 1000 USDC lent, 3 LP positions (SOL/USDC, JUP/SOL, BONK/SOL)',
    marketConditions: 'Mixed market - SOL stable at $145, DeFi TVL growing 5% weekly',
    riskAssessment: 'Medium-high risk - significant IL exposure in volatile LP pairs',
    opportunities: 'Rebalance LP positions, compound rewards, consider reducing exposure to meme coin LPs',
  },

  // Yield farming focused
  yieldFarmer: {
    walletOverview: 'Yield optimization setup: 3 SOL staked (6% APY), 2000 USDC in Kamino vaults (12% APY), auto-compounder active',
    marketConditions: 'Favorable DeFi yields - lending rates 8-15%, staking 6%, LP farming 20-40%',
    riskAssessment: 'Low-medium risk - diversified yield strategies with automated compounding',
    opportunities: 'New Meteora DLMM pools offering 35% APY, consider migrating some LP positions',
  },

  // NFT collector portfolio
  nftCollector: {
    walletOverview: 'NFT-focused: 15 SOL liquid, 23 NFTs (8 Mad Lads, 5 Tensorians, 10 other), floor value ~$5,000',
    marketConditions: 'NFT market recovering - Mad Lads floor up 15% this month, trading volume increasing',
    riskAssessment: 'High risk - NFT holdings are illiquid and volatile',
    opportunities: 'Consider listing lower-tier NFTs, using NFT collateral for loans on Sharky',
  },

  // Conservative portfolio
  conservative: {
    walletOverview: 'Conservative allocation: 2 SOL ($300), 5000 USDC (83% stablecoins), minimal DeFi exposure',
    marketConditions: 'Stable market - SOL range-bound between $140-$155 for 2 weeks',
    riskAssessment: 'Very low risk - heavily weighted toward stablecoins',
    opportunities: 'USDC is underutilized - consider low-risk yield (Kamino: 10% APY) or gradual SOL accumulation',
  },

  // Leveraged trader
  leveragedTrader: {
    walletOverview: 'Active trader: 8 SOL, 2 leveraged positions (3x long JTO, 2x long JUP), 1000 USDC collateral',
    marketConditions: 'Volatile market - altcoins swinging 10-15% daily, liquidation risks elevated',
    riskAssessment: 'Very high risk - leveraged positions near liquidation thresholds',
    opportunities: 'URGENT: Add collateral to avoid liquidation, consider reducing leverage to 2x or less',
  },

  // Airdrop hunter
  airdropHunter: {
    walletOverview: 'Airdrop farming: 12 SOL spread across 8 protocols (MarginFi, Kamino, Drift, Jupiter, Zeta, Phoenix, Meteora, Sanctum)',
    marketConditions: 'Airdrop season - multiple confirmed drops coming (ZEUS, KMNO, DRIFT Season 2)',
    riskAssessment: 'Medium risk - capital spread thin across protocols, some unconfirmed airdrops',
    opportunities: 'Focus on confirmed airdrops, maintain minimum activity thresholds, consolidate into top 4 protocols',
  },
};

/**
 * Recommendation generation responses
 */
export const recommendationFixtures: Record<string, {
  actionType: string;
  pluginName: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  confidence: number;
  triggerMessage: string;
  params: Record<string, any>;
  estimatedImpact: string;
  estimatedGas: string;
}> = {
  // ============================================
  // Swap & Trading Actions
  // ============================================
  'EXECUTE_SWAP': {
    actionType: 'EXECUTE_SWAP',
    pluginName: 'plugin-swap',
    priority: 'high',
    reasoning: 'High USDC allocation (83%) should be balanced with SOL exposure for better upside',
    confidence: 0.85,
    triggerMessage: 'Swap 250 USDC to SOL with 1% slippage tolerance',
    params: { from: 'USDC', to: 'SOL', amount: 250, slippage: 0.01 },
    estimatedImpact: 'Increase SOL holdings by ~1.67 SOL (+10% portfolio SOL weight)',
    estimatedGas: '~0.00001 SOL',
  },

  'SWAP_VIA_JUPITER': {
    actionType: 'SWAP_VIA_JUPITER',
    pluginName: 'plugin-jupiter',
    priority: 'high',
    reasoning: 'Jupiter offers best pricing with 0.2% better rate than direct swap',
    confidence: 0.90,
    triggerMessage: 'Execute Jupiter swap: 500 USDC to JUP with 50 bps slippage',
    params: { inputMint: 'USDC', outputMint: 'JUP', amount: 500, slippageBps: 50 },
    estimatedImpact: 'Acquire ~555 JUP tokens, diversify into governance token',
    estimatedGas: '~0.00003 SOL',
  },

  'LIMIT_ORDER_CREATE': {
    actionType: 'LIMIT_ORDER_CREATE',
    pluginName: 'plugin-limit-order',
    priority: 'medium',
    reasoning: 'Set limit order to catch potential SOL dip to $140 support level',
    confidence: 0.75,
    triggerMessage: 'Create limit buy order for SOL at $140 using 300 USDC, expires in 7 days',
    params: { side: 'buy', token: 'SOL', limitPrice: 140, amount: 300, expiry: '7d' },
    estimatedImpact: 'Accumulate 2.14 SOL if price drops to support',
    estimatedGas: '~0.00002 SOL',
  },

  'DCA_ORDER_CREATE': {
    actionType: 'DCA_ORDER_CREATE',
    pluginName: 'plugin-dca',
    priority: 'low',
    reasoning: 'Setup automated weekly SOL purchases to build position over time',
    confidence: 0.80,
    triggerMessage: 'Setup DCA to buy $100 of SOL weekly for 10 weeks',
    params: { token: 'SOL', amountPerOrder: 100, frequency: 'weekly', duration: 10 },
    estimatedImpact: 'Accumulate ~6.67 SOL over 10 weeks with price averaging',
    estimatedGas: '~0.00001 SOL per order',
  },

  // ============================================
  // Portfolio Management
  // ============================================
  'REBALANCE_PORTFOLIO': {
    actionType: 'REBALANCE_PORTFOLIO',
    pluginName: 'plugin-portfolio',
    priority: 'medium',
    reasoning: 'Portfolio drift detected - rebalance from current 40/60 SOL/USDC to target 50/50 allocation',
    confidence: 0.75,
    triggerMessage: 'Rebalance portfolio to 50% SOL and 50% USDC allocation',
    params: { targetAllocation: { SOL: 0.5, USDC: 0.5 } },
    estimatedImpact: 'Restore target allocation, swap 200 USDC → SOL',
    estimatedGas: '~0.00002 SOL',
  },

  'STOP_LOSS_SET': {
    actionType: 'STOP_LOSS_SET',
    pluginName: 'plugin-risk-management',
    priority: 'high',
    reasoning: 'Protect gains - set stop loss at $130 to limit downside to -13%',
    confidence: 0.88,
    triggerMessage: 'Set stop-loss to sell 5 SOL if price drops to $130 using market order',
    params: { token: 'SOL', amount: 5, triggerPrice: 130, orderType: 'market' },
    estimatedImpact: 'Downside protection - auto-sell if SOL drops 13%',
    estimatedGas: '~0.00002 SOL',
  },

  'TAKE_PROFIT_SET': {
    actionType: 'TAKE_PROFIT_SET',
    pluginName: 'plugin-risk-management',
    priority: 'medium',
    reasoning: 'Lock in profits - take 50% profit if SOL hits $180 (+20% target)',
    confidence: 0.82,
    triggerMessage: 'Set take-profit limit order to sell 5 SOL at $180 target price',
    params: { token: 'SOL', amount: 5, triggerPrice: 180, orderType: 'limit' },
    estimatedImpact: 'Secure $900 profit if target hit, reduce risk exposure',
    estimatedGas: '~0.00002 SOL',
  },

  'AUTO_COMPOUND_REWARDS': {
    actionType: 'AUTO_COMPOUND_REWARDS',
    pluginName: 'plugin-yield-optimizer',
    priority: 'low',
    reasoning: 'Automate reward compounding for 12% APY boost vs manual claiming',
    confidence: 0.85,
    triggerMessage: 'Enable auto-compound for Marinade and Orca rewards, daily frequency, minimum 0.1 SOL per claim',
    params: { minClaimAmount: 0.1, frequency: 'daily', protocols: ['marinade', 'orca'] },
    estimatedImpact: 'Increase APY from 6% to 6.72% through daily compounding',
    estimatedGas: '~0.00001 SOL per compound',
  },

  // ============================================
  // Staking Actions
  // ============================================
  'STAKE_SOL': {
    actionType: 'STAKE_SOL',
    pluginName: 'plugin-staking',
    priority: 'high',
    reasoning: '5 SOL is idle - stake with Marinade for 6.2% APY + liquid mSOL token',
    confidence: 0.92,
    triggerMessage: 'Stake 5 SOL with Marinade validator to receive mSOL liquid staking token at 6.2% APY',
    params: { amount: 5, validator: 'marinade', receiveToken: 'mSOL' },
    estimatedImpact: 'Earn ~0.31 SOL/year in rewards, receive 5 mSOL (liquid staking token)',
    estimatedGas: '~0.00005 SOL',
  },

  'CLAIM_STAKING_REWARDS': {
    actionType: 'CLAIM_STAKING_REWARDS',
    pluginName: 'plugin-staking',
    priority: 'medium',
    reasoning: '0.15 SOL in unclaimed rewards available - compound into staking',
    confidence: 0.90,
    triggerMessage: 'Claim 0.15 SOL staking rewards from all validators and auto-restake',
    params: { validators: ['all'], autoRestake: true },
    estimatedImpact: 'Claim 0.15 SOL rewards and auto-compound for better APY',
    estimatedGas: '~0.00003 SOL',
  },

  'UNSTAKE_SOL': {
    actionType: 'UNSTAKE_SOL',
    pluginName: 'plugin-staking',
    priority: 'low',
    reasoning: 'Market opportunity detected - unstake 2 SOL to rebalance into altcoins',
    confidence: 0.70,
    triggerMessage: 'Unstake 2 SOL from Marinade with standard 3-day cooldown period',
    params: { amount: 2, validator: 'marinade', instant: false },
    estimatedImpact: 'Free up 2 SOL for reallocation after 3-day unstaking period',
    estimatedGas: '~0.00005 SOL',
  },

  // ============================================
  // DeFi Lending Actions
  // ============================================
  'SUPPLY_COLLATERAL': {
    actionType: 'SUPPLY_COLLATERAL',
    pluginName: 'plugin-lending',
    priority: 'medium',
    reasoning: 'Supply 3 SOL to MarginFi as collateral to earn 4% APY + borrow capacity',
    confidence: 0.83,
    triggerMessage: 'Supply 3 SOL as collateral to MarginFi lending pool',
    params: { protocol: 'marginfi', asset: 'SOL', amount: 3 },
    estimatedImpact: 'Earn 4% APY + unlock $450 borrow capacity at 50% LTV',
    estimatedGas: '~0.00004 SOL',
  },

  'BORROW_ASSET': {
    actionType: 'BORROW_ASSET',
    pluginName: 'plugin-lending',
    priority: 'high',
    reasoning: 'Borrow 200 USDC against SOL collateral for yield farming opportunity',
    confidence: 0.78,
    triggerMessage: 'Borrow 200 USDC from MarginFi at 50% max LTV ratio',
    params: { protocol: 'marginfi', asset: 'USDC', amount: 200, maxLTV: 0.5 },
    estimatedImpact: 'Borrow $200 at 8% APR to deploy in 35% APY Kamino vault (27% net)',
    estimatedGas: '~0.00004 SOL',
  },

  'REPAY_LOAN': {
    actionType: 'REPAY_LOAN',
    pluginName: 'plugin-lending',
    priority: 'high',
    reasoning: 'Health factor at 1.15 - repay 100 USDC to reduce liquidation risk',
    confidence: 0.95,
    triggerMessage: 'Repay 100 USDC loan on Solend protocol to improve health factor',
    params: { protocol: 'solend', asset: 'USDC', amount: 100 },
    estimatedImpact: 'Increase health factor from 1.15 to 1.42, reduce liquidation risk',
    estimatedGas: '~0.00003 SOL',
  },

  // ============================================
  // Liquidity Provision Actions
  // ============================================
  'ADD_LIQUIDITY': {
    actionType: 'ADD_LIQUIDITY',
    pluginName: 'plugin-amm',
    priority: 'medium',
    reasoning: 'Add liquidity to SOL/USDC Orca whirlpool for 18% APY (fees + rewards)',
    confidence: 0.80,
    triggerMessage: 'Add 2 SOL and 300 USDC to Orca SOL-USDC-0.3% whirlpool',
    params: { protocol: 'orca', poolId: 'SOL-USDC-0.3', amountA: 2, amountB: 300 },
    estimatedImpact: 'Earn 18% APY on $600 LP position (~$108/year)',
    estimatedGas: '~0.00006 SOL',
  },

  'REMOVE_LIQUIDITY': {
    actionType: 'REMOVE_LIQUIDITY',
    pluginName: 'plugin-amm',
    priority: 'high',
    reasoning: 'BONK/SOL pool has -15% IL - exit position to stop losses',
    confidence: 0.87,
    triggerMessage: 'Remove 100% of BONK-SOL LP position from Raydium',
    params: { protocol: 'raydium', poolId: 'BONK-SOL', percentage: 100 },
    estimatedImpact: 'Exit underwater position, realize -$45 IL loss, free up capital',
    estimatedGas: '~0.00005 SOL',
  },

  'CLAIM_LP_FEES': {
    actionType: 'CLAIM_LP_FEES',
    pluginName: 'plugin-amm',
    priority: 'low',
    reasoning: '12 USDC + 0.08 SOL in unclaimed LP fees across 3 pools',
    confidence: 0.88,
    triggerMessage: 'Claim all LP trading fees and ORCA rewards from all Orca pools',
    params: { protocol: 'orca', pools: ['all'], autoCompound: false },
    estimatedImpact: 'Claim $24 in fees + 15 ORCA tokens (~$35 total)',
    estimatedGas: '~0.00003 SOL',
  },

  // ============================================
  // NFT Actions
  // ============================================
  'LIST_NFT_FOR_SALE': {
    actionType: 'LIST_NFT_FOR_SALE',
    pluginName: 'plugin-nft',
    priority: 'medium',
    reasoning: 'List low-tier NFT at floor price for liquidity',
    confidence: 0.75,
    triggerMessage: 'List Generic PFP #4523 on Tensor marketplace at 0.5 SOL floor price, expires in 7 days',
    params: { marketplace: 'tensor', nftMint: '...', price: 0.5, expiry: '7d' },
    estimatedImpact: 'Convert illiquid NFT to 0.5 SOL (~$75)',
    estimatedGas: '~0.00002 SOL',
  },

  'BUY_NFT': {
    actionType: 'BUY_NFT',
    pluginName: 'plugin-nft',
    priority: 'low',
    reasoning: 'Mad Lads floor dipped 10% - good entry for speculation',
    confidence: 0.65,
    triggerMessage: 'Buy Mad Lads #1337 on Tensor at max price of 85 SOL',
    params: { marketplace: 'tensor', nftMint: '...', maxPrice: 85 },
    estimatedImpact: 'Acquire Mad Lad NFT with potential 20%+ upside',
    estimatedGas: '~0.00005 SOL',
  },
};

/**
 * Trigger message generation responses
 */
export const triggerMessageFixtures: Record<string, string> = {
  // DATA actions
  'GET_WALLET_BALANCE': 'Get current wallet balance for SOL and USDC',
  'GET_TOKEN_HOLDINGS': 'Fetch all SPL token holdings in wallet',
  'GET_TRANSACTION_HISTORY': 'Get transaction history for the last 30 days',
  'GET_NFT_PORTFOLIO': 'Retrieve all NFTs in wallet',
  'GET_PORTFOLIO_VALUE': 'Calculate total portfolio value in USD',
  'GET_MARKET_DATA': 'Fetch latest market data for SOL',
  'GET_TOKEN_PRICE': 'Get current SOL price from Jupiter aggregator',
  'GET_PRICE_HISTORY': 'Fetch 7-day SOL price history with hourly data',
  'GET_DEX_LIQUIDITY': 'Check SOL/USDC liquidity on Orca and Raydium',
  'GET_TRADING_VOLUME': 'Get 24h trading volume for SOL',
  'GET_STAKING_POSITIONS': 'Retrieve all active SOL staking positions',
  'GET_LENDING_POSITIONS': 'Get lending and borrowing positions on MarginFi and Solend',
  'GET_LP_POSITIONS': 'List all liquidity provider positions',
  'GET_YIELD_OPPORTUNITIES': 'Scan DeFi protocols for yield farming opportunities above 15% APY',
  'ASSESS_PORTFOLIO_RISK': 'Assess current portfolio risk level',
  'CALCULATE_IMPERMANENT_LOSS': 'Calculate impermanent loss for all LP positions',
  'ANALYZE_WALLET_HEALTH': 'Evaluate wallet health score and borrowing capacity',
  'GET_GAS_ESTIMATES': 'Estimate transaction costs for common operations',

  // ACTION actions
  'EXECUTE_SWAP': 'Swap 250 USDC to SOL with 1% slippage',
  'SWAP_VIA_JUPITER': 'Execute Jupiter swap: 500 USDC to JUP with 50 bps slippage',
  'LIMIT_ORDER_CREATE': 'Create limit buy order for SOL at $140 using 300 USDC, expires in 7 days',
  'DCA_ORDER_CREATE': 'Setup DCA to buy $100 of SOL weekly for 10 weeks',
  'REBALANCE_PORTFOLIO': 'Rebalance portfolio to 50% SOL and 50% USDC allocation',
  'AUTO_COMPOUND_REWARDS': 'Enable auto-compound for all staking and LP rewards, daily frequency',
  'STOP_LOSS_SET': 'Set stop-loss to sell 5 SOL if price drops to $130',
  'TAKE_PROFIT_SET': 'Set take-profit limit order to sell 5 SOL at $180',
  'STAKE_SOL': 'Stake 5 SOL with Marinade validator to receive mSOL',
  'UNSTAKE_SOL': 'Unstake 2 SOL from Marinade with 3-day cooldown',
  'CLAIM_STAKING_REWARDS': 'Claim 0.15 SOL staking rewards from all validators and auto-restake',
  'CHANGE_VALIDATOR': 'Switch 3 SOL stake from current validator to Jito validator',
  'SUPPLY_COLLATERAL': 'Supply 3 SOL as collateral to MarginFi lending pool',
  'BORROW_ASSET': 'Borrow 200 USDC from MarginFi at 50% max LTV',
  'REPAY_LOAN': 'Repay 100 USDC loan on Solend protocol',
  'WITHDRAW_COLLATERAL': 'Withdraw 2 SOL collateral from MarginFi',
  'ADD_LIQUIDITY': 'Add 2 SOL and 300 USDC to Orca SOL-USDC-0.3% whirlpool',
  'REMOVE_LIQUIDITY': 'Remove 100% of BONK-SOL LP position from Raydium',
  'CLAIM_LP_FEES': 'Claim all LP trading fees and ORCA rewards from all Orca pools',
  'MIGRATE_LIQUIDITY': 'Migrate SOL-USDC LP position from Orca to Raydium for better APY',
  'LIST_NFT_FOR_SALE': 'List Generic PFP #4523 on Tensor at 0.5 SOL, expires in 7 days',
  'BUY_NFT': 'Buy Mad Lads #1337 on Tensor at max price of 85 SOL',
  'CANCEL_NFT_LISTING': 'Cancel Tensorians #9876 listing on Magic Eden',
  'MAKE_NFT_OFFER': 'Make offer of 75 SOL for SMB #442 on Tensor',
  'FLASH_LOAN_ARBITRAGE': 'Execute flash loan arbitrage: borrow 10000 USDC, arb SOL-JUP-USDC path',
  'LEVERAGE_POSITION': 'Open 3x leveraged long position on SOL using 1000 USDC collateral',
  'CLOSE_LEVERAGE': 'Close 3x SOL leveraged position on Drift',
  'HEDGE_POSITION': 'Hedge 5 SOL exposure with 2x short JUP perpetual',
};

/**
 * Helper to get categorization response for an action
 */
export function getCategorizationResponse(action: Action) {
  const fixture = actionCategorizationFixtures[action.name];

  if (fixture) {
    return fixture;
  }

  // Fallback based on action name patterns
  if (action.name.includes('GET_') || action.name.includes('ASSESS_')) {
    return {
      category: 'DATA' as const,
      actionType: 'unknown_data',
      confidence: 0.7,
      reasoning: 'Action appears to be data retrieval based on name',
    };
  }

  if (action.name.includes('EXECUTE_') || action.name.includes('REBALANCE_')) {
    return {
      category: 'ACTION' as const,
      actionType: 'unknown_action',
      confidence: 0.7,
      reasoning: 'Action appears to execute operations based on name',
    };
  }

  // Ultimate fallback
  return {
    category: 'DATA' as const,
    actionType: 'unknown',
    confidence: 0.5,
    reasoning: 'Unable to categorize action - defaulting to DATA',
  };
}

/**
 * Helper to get trigger message for an action
 */
export function getTriggerMessage(action: Action): string {
  return triggerMessageFixtures[action.name] || `Execute ${action.name}`;
}

/**
 * Helper to get recommendation for an action
 */
export function getRecommendation(action: Action) {
  const fixture = recommendationFixtures[action.name];

  if (fixture) {
    return fixture;
  }

  // Fallback recommendation
  return {
    actionType: action.name,
    pluginName: 'unknown',
    priority: 'medium' as const,
    reasoning: `Generated recommendation for ${action.name}`,
    confidence: 0.7,
    triggerMessage: `Execute ${action.name}`,
    params: {},
    estimatedImpact: 'Unknown impact',
    estimatedGas: 'Unknown',
  };
}
