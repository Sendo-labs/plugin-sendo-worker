import type { Route, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { SendoWorkerService } from '../services/sendoWorkerService.js';

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
 * GET /worker/analysis
 * Get all analyses for the current agent
 */
async function getAnalysisHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const agentId = runtime.agentId;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  try {
    const analyses = await workerService.getAnalysesByAgentId(agentId);
    sendSuccess(res, { analyses });
  } catch (error: any) {
    logger.error('[Route] Failed to get analyses:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get analyses', error.message);
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
 */
async function runAnalysisHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const agentId = runtime.agentId;
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  try {
    // Run complete analysis workflow
    const result = await workerService.runAnalysis(agentId, true);

    sendSuccess(res, {
      message: 'Analysis completed successfully',
      analysis: result,
    }, 201);
  } catch (error: any) {
    logger.error('[Route] Failed to run analysis:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to run analysis', error.message);
  }
}

/**
 * POST /worker/actions/execute
 * Execute one or more recommended actions
 * Returns immediately with "executing" status, actions process in background
 */
async function executeActionsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { actionIds } = req.body as { actionIds: string[] };
  const workerService = runtime.getService<SendoWorkerService>('sendo_worker');

  if (!workerService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoWorkerService not found');
  }

  if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
    return sendError(res, 400, 'INVALID_REQUEST', 'actionIds must be a non-empty array');
  }

  try {
    // Execute actions (returns immediately with "executing" status)
    const executingActions = await workerService.executeActions(actionIds);

    sendSuccess(res, {
      message: `${executingActions.length} actions are now executing`,
      actions: executingActions,
    });
  } catch (error: any) {
    logger.error('[Route] Failed to execute actions:', error);
    sendError(res, 500, 'EXECUTION_ERROR', 'Failed to execute actions', error.message);
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
    path: '/actions/execute',
    handler: executeActionsHandler,
  },
];
