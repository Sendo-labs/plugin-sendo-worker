import type { Route, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { SendoWorkerService } from '../services/sendoWorkerService.js';
import { checkWalletBalance } from '../utils/walletManager.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

function sendSuccess(res: any, data: any, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, data }));
}

function sendError(res: any, status: number, code: string, message: string, details?: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: { code, message, details } }));
}

// ============================================
// ROUTE HANDLERS
// ============================================

/**
 * GET /worker/analysis?limit=10
 * Get all analyses for the current agent
 * Query params:
 *   - limit: number of analyses to return (default: 10, max: 100)
 */
async function getAnalysisHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const agentId = runtime.agentId;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  // Parse limit from query params
  const limitParam = req.query?.limit;
  let limit = 10; // default

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return sendError(res, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
    }
    limit = Math.min(parsedLimit, 100); // max 100
  }

  try {
    const analyses = await workerService.getAnalysesByAgentId(agentId, limit);
    sendSuccess(res, { analyses, count: analyses.length, limit });
  } catch (error: any) {
    logger.error('[Route] Failed to get analyses:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get analyses', error.message);
  }
}

/**
 * GET /analysis/:analysisId
 * Get a specific analysis by ID
 */
async function getAnalysisByIdHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { analysisId } = req.params;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  if (!analysisId) {
    return sendError(res, 400, 'INVALID_REQUEST', 'analysisId is required');
  }

  try {
    const analysis = await workerService.getAnalysisResult(analysisId);

    if (!analysis) {
      return sendError(res, 404, 'NOT_FOUND', `Analysis ${analysisId} not found`);
    }

    sendSuccess(res, { analysis });
  } catch (error: any) {
    logger.error('[Route] Failed to get analysis:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get analysis', error.message);
  }
}

/**
 * GET /analysis/:analysisId/actions
 * Get all actions for a specific analysis
 */
async function getAnalysisActionsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { analysisId } = req.params;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  if (!analysisId) {
    return sendError(res, 400, 'INVALID_REQUEST', 'analysisId is required');
  }

  try {
    const actions = await workerService.getActionsByAnalysisId(analysisId);
    sendSuccess(res, { actions });
  } catch (error: any) {
    logger.error('[Route] Failed to get actions:', error);
    sendError(res, 500, 'RETRIEVAL_ERROR', 'Failed to get actions', error.message);
  }
}

/**
 * GET /worker/action/:actionId
 * Get a specific action by ID
 */
async function getActionHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { actionId } = req.params;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  if (!actionId) {
    return sendError(res, 400, 'INVALID_REQUEST', 'actionId is required');
  }

  try {
    const action = await workerService.getActionById(actionId);
    sendSuccess(res, { action });
  } catch (error: any) {
    if (error.message === 'Action not found') {
      return sendError(res, 404, 'ACTION_NOT_FOUND', 'Action not found');
    }
    logger.error('[Route] Failed to get action:', error);
    sendError(res, 500, 'RETRIEVAL_ERROR', 'Failed to get action', error.message);
  }
}

/**
 * POST /worker/analysis
 * Run a complete analysis for the current agent
 * Requires wallet with minimum 0.01 SOL balance
 * Returns immediately with 201 - analysis runs in background
 */
async function runAnalysisHandler(_req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const agentId = runtime.agentId;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  // Check wallet balance before running analysis
  try {
    const walletStatus = await checkWalletBalance(runtime);

    if (!walletStatus.hasBalance) {
      return sendError(
        res,
        402,
        'INSUFFICIENT_BALANCE',
        `Wallet has insufficient balance. Current: ${walletStatus.balance} SOL, Required: 0.01 SOL minimum`,
        `Please fund wallet: ${walletStatus.publicKey}`
      );
    }

    logger.info(`[Route] Wallet balance check passed: ${walletStatus.balance} SOL (${walletStatus.publicKey})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Route] Failed to check wallet balance:', errorMessage);
    return sendError(res, 500, 'WALLET_CHECK_FAILED', 'Failed to verify wallet balance', errorMessage);
  }

  // Return immediately with 201 - analysis runs in background
  sendSuccess(res, {
    message: 'Analysis started successfully',
    status: 'processing',
    agentId,
  }, 201);

  // Run analysis in background (don't await)
  workerService.runAnalysis(agentId)
    .then((result) => {
      logger.info(`[Route] ✅ Background analysis completed for agent ${agentId}: ${result.id}`);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Route] ❌ Background analysis failed for agent ${agentId}:`, errorMessage);
    });
}

/**
 * POST /actions/decide
 * Decide on one or more recommended actions (accept/reject)
 * - accept: Executes the action immediately (async)
 * - reject: Marks as rejected without execution
 */
async function decideActionsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { decisions } = req.body as { decisions: Array<{ actionId: string; decision: 'accept' | 'reject' }> };
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  if (!decisions || !Array.isArray(decisions) || decisions.length === 0) {
    return sendError(res, 400, 'INVALID_REQUEST', 'decisions must be a non-empty array');
  }

  // Validate decisions
  for (const { actionId, decision } of decisions) {
    if (!actionId || typeof actionId !== 'string') {
      return sendError(res, 400, 'INVALID_REQUEST', 'Each decision must have a valid actionId');
    }
    if (!['accept', 'reject'].includes(decision)) {
      return sendError(res, 400, 'INVALID_DECISION', `Decision must be "accept" or "reject", got "${decision}"`);
    }
  }

  try {
    // Process decisions
    const result = await workerService.processDecisions(decisions);

    sendSuccess(res, {
      processed: decisions.length,
      accepted: result.accepted,
      rejected: result.rejected,
    });
  } catch (error: any) {
    logger.error('[Route] Failed to process decisions:', error);
    sendError(res, 500, 'DECISION_ERROR', 'Failed to process decisions', error.message);
  }
}

// ============================================
// ROUTE EXPORTS
// ============================================

export const sendoWorkerRoutes: Route[] = [
  {
    type: 'GET',
    path: '/analysis',
    handler: getAnalysisHandler,
  },
  {
    type: 'GET',
    path: '/analysis/:analysisId',
    handler: getAnalysisByIdHandler,
  },
  {
    type: 'POST',
    path: '/analysis',
    handler: runAnalysisHandler,
  },
  {
    type: 'GET',
    path: '/analysis/:analysisId/actions',
    handler: getAnalysisActionsHandler,
  },
  {
    type: 'GET',
    path: '/action/:actionId',
    handler: getActionHandler,
  },
  {
    type: 'POST',
    path: '/actions/decide',
    handler: decideActionsHandler,
  },
];
