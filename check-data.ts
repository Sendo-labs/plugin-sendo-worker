import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { resolve } from 'path';
import { analysisResults } from './src/schemas/index.js';

const PGLITE_DATA_DIR = resolve(process.cwd(), '../agent/.eliza/.elizadb');
const client = new PGlite(PGLITE_DATA_DIR);
const db = drizzle(client);

const results = await db.select().from(analysisResults);
console.log('Analysis results in DB:', results.length);
console.log('First result:', JSON.stringify(results[0], null, 2));

await client.close();
