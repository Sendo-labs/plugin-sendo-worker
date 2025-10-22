import type { Plugin } from '@elizaos/core';
import { SendoWorkerService } from './services/sendoWorkerService.js';
import { sendoWorkerRoutes } from './routes/index.js';
import * as schema from './schemas/index.js';

export * from './types/index.js';
export * from './schemas/index.js';
export { SendoWorkerService };

/**
 * Sendo Worker plugin for ElizaOS
 *
 * Provides analysis and action recommendation management with REST API.
 *
 * **Components**:
 * - `SendoWorkerService`: Manages all analysis and action operations
 * - REST API Routes: 5 endpoints for CRUD operations
 * - Database: Automatic migrations via Drizzle ORM schemas
 *
 * **Database Tables**:
 * - `analysis_results`: Stores agent analyses
 * - `recommended_actions`: Stores recommended actions with decision tracking
 */
export const sendoWorkerPlugin: Plugin = {
  name: 'plugin-sendo-worker',
  description: 'Sendo Worker orchestrator that manages analyses, recommended actions, and tracks decisions',

  services: [SendoWorkerService],
  routes: sendoWorkerRoutes,

  // Export schema for automatic database migrations
  schema,
};

export default sendoWorkerPlugin;
