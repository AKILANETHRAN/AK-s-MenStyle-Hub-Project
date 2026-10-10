import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPool, createPostgresDatabase } from './postgres.js';

const pool = createPool();
pool.on('error', error => console.error('PostgreSQL idle connection error:', error.code || error.name));
const db = createPostgresDatabase(pool);

/** Apply the versioned schema once. Empty databases remain empty for import. */
export async function initDatabase() {
  await db.transaction(async () => {
    await db.query('SELECT pg_advisory_xact_lock(72190410)');
    await db.query(`CREATE TABLE IF NOT EXISTS stylehub_schema_migrations (
      version INTEGER PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    if (!await db.prepare('SELECT version FROM stylehub_schema_migrations WHERE version = ?').get(1)) {
      const schema = await readFile(new URL('../migrations/001-postgresql.sql', import.meta.url), 'utf8');
      await db.query(schema);
      await db.prepare('INSERT INTO stylehub_schema_migrations(version) VALUES (?) RETURNING version').run(1);
    }
  })();
  return db;
}

export async function checkDatabaseHealth() {
  try {
    return (await db.prepare('SELECT 1 AS alive').get())?.alive === 1 ? 'connected' : 'disconnected';
  } catch { return 'disconnected'; }
}

export default db;
