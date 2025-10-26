import { sql } from 'drizzle-orm';
import {
  varchar,
  uuid,
  text,
  decimal,
  jsonb,
  timestamp,
  index,
  smallint,
} from 'drizzle-orm/pg-core';
import { analysisResults, sendoWorkerSchema } from './analysis-results';

/**
 * Priority levels as numeric values for proper sorting
 * 3 = high, 2 = medium, 1 = low
 */
export const PRIORITY_VALUES = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

export const PRIORITY_NAMES = {
  3: 'high',
  2: 'medium',
  1: 'low',
} as const;

/**
 * Recommended actions storage table
 * Stores recommended actions from analyses
 */
export const recommendedActions = sendoWorkerSchema.table(
  'recommended_actions',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analysisResults.id, { onDelete: 'cascade' }),

    // Type and source
    actionType: varchar('action_type', { length: 255 }).notNull(),
    pluginName: varchar('plugin_name', { length: 255 }).notNull(),

    // Priority and confidence
    priority: smallint('priority').notNull(), // 3=high, 2=medium, 1=low
    reasoning: text('reasoning').notNull(),
    confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(),

    // Trigger
    triggerMessage: text('trigger_message').notNull(),

    // Parameters (optional JSON) - includes estimatedGas
    params: jsonb('params'),

    // UI metadata
    estimatedImpact: varchar('estimated_impact', { length: 255 }),

    // State and execution
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    decidedAt: timestamp('decided_at'),
    executedAt: timestamp('executed_at'),

    // Result (saved by Frontend)
    result: jsonb('result'),
    error: text('error'),
    errorType: varchar('error_type', { length: 50 }), // 'initialization' | 'execution'

    createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  },
  (table) => {
    return {
      analysisIdx: index('idx_analysis').on(table.analysisId),
      statusIdx: index('idx_status').on(table.status),
      createdAtIdx: index('idx_created').on(table.createdAt),
    };
  }
);
