import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { resolve } from 'path';
import { recommendedActions } from './src/schemas/index.js';

const PGLITE_DATA_DIR = resolve(process.cwd(), '../agent/.eliza/.elizadb');
const client = new PGlite(PGLITE_DATA_DIR);
const db = drizzle(client);

const actions = await db.select().from(recommendedActions).limit(2);
console.log('Sample action IDs:');
actions.forEach(a => console.log(`  - ${a.id} (analysis: ${a.analysisId})`));

await client.close();
