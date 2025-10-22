import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  uuid,
  text,
  decimal,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { analysisResults } from './analysis-results';

/**
 * Recommended actions storage table
 * Stores recommended actions from analyses
 */
export const recommendedActions = pgTable(
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
    priority: varchar('priority', { length: 50 }).notNull(), // 'high' | 'medium' | 'low'
    reasoning: text('reasoning').notNull(),
    confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(),

    // Trigger
    triggerMessage: text('trigger_message').notNull(),

    // Parameters (optional JSON)
    params: jsonb('params'),

    // UI metadata
    estimatedImpact: varchar('estimated_impact', { length: 255 }),
    estimatedGas: varchar('estimated_gas', { length: 255 }),

    // State and execution
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    decidedAt: timestamp('decided_at'),
    executedAt: timestamp('executed_at'),

    // Result (saved by Frontend)
    result: jsonb('result'),
    error: text('error'),

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
