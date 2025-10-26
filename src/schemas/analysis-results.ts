import { sql } from 'drizzle-orm';
import { pgSchema, uuid, timestamp, jsonb, integer, text } from 'drizzle-orm/pg-core';

/**
 * Sendo Worker schema for better isolation
 */
export const sendoWorkerSchema = pgSchema('sendo_worker');

/**
 * Analysis results storage table
 * Stores analysis results generated for agents
 */
export const analysisResults = sendoWorkerSchema.table('analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),

  // Global insights (JSONB)
  analysis: jsonb('analysis').notNull(),

  // Metadata
  pluginsUsed: text('plugins_used').array().notNull(),
  executionTimeMs: integer('execution_time_ms'),
});
