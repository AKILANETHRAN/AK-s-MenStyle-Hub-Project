import 'dotenv/config';
import Database from 'better-sqlite3';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const backend = fileURLToPath(new URL('../', import.meta.url));
const quote = name => {
  if (!/^\w+$/.test(name)) throw new Error('Unexpected database identifier.');
  return `"${name}"`;
};

function digest(rows, columns) {
  const canonical = rows.map(row => columns.map(column => {
    const value = row[column.name];
    if (value != null && /DATE|TIME/i.test(column.type)) {
      const date = value instanceof Date ? value : new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
      return date.toISOString();
    }
    return value;
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** Copy into an empty target, in one transaction; never merge or overwrite. */
export async function migrateSqlite(sourcePath, db, { apply = false, backupDir } = {}) {
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  let snapshot;
  try {
    const schema = await readFile(new URL('../migrations/001-postgresql.sql', import.meta.url), 'utf8');
    const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?/gi)].map(m => m[1]);
    if (!apply) {
      const counts = Object.fromEntries(tables.map(table => [table, source.prepare(`SELECT COUNT(*) AS count FROM ${quote(table)}`).get().count]));
      console.log(JSON.stringify({ mode: 'preview', counts }, null, 2));
      return counts;
    }

    const directory = backupDir || path.resolve(backend, '../..', 'scratch/postgres-migration');
    await mkdir(directory, { recursive: true });
    const backupPath = path.join(directory, `stylehub-${Date.now()}.sqlite`);
    // Online SQLite backup includes committed WAL data and provides a stable snapshot.
    await source.backup(backupPath);
    snapshot = new Database(backupPath, { readonly: true });
    if (snapshot.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('SQLite integrity check failed.');
    const violations = snapshot.pragma('foreign_key_check');
    if (violations.length) throw new Error(`Source contains ${violations.length} foreign-key violations. Repair the source before importing.`);
    const actualTables = snapshot.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
    if (actualTables.some(t => !tables.includes(t))) throw new Error('Source contains tables not covered by the PostgreSQL schema.');

    const counts = {};
    await db.transaction(async () => {
      await db.query(`LOCK TABLE ${tables.map(quote).join(', ')} IN ACCESS EXCLUSIVE MODE`);
      for (const table of tables) {
        const targetCount = await db.prepare(`SELECT COUNT(*) AS count FROM ${quote(table)}`).get();
        if (targetCount.count) throw new Error(`Refusing import: target table ${table} is not empty.`);
      }
      for (const table of tables) {
        const columns = snapshot.pragma(`table_info(${quote(table)})`);
        const names = columns.map(c => c.name);
        const key = names.includes('id') ? 'id' : columns.find(c => c.pk)?.name;
        if (!key) throw new Error(`Table ${table} has no import ordering key.`);
        const rows = snapshot.prepare(`SELECT * FROM ${quote(table)} ORDER BY ${quote(key)}`).all();
        const targetColumns = (await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table])).rows.map(c => c.column_name);
        if (names.some(n => !targetColumns.includes(n))) throw new Error(`Source columns for ${table} do not match the target schema.`);
        for (let offset = 0; offset < rows.length; offset += 200) {
          const chunk = rows.slice(offset, offset + 200);
          const params = [];
          const values = chunk.map(row => `(${names.map(n => { params.push(row[n]); return `$${params.length}`; }).join(',')})`);
          await db.query(`INSERT INTO ${quote(table)} (${names.map(quote).join(',')}) VALUES ${values.join(',')}`, params);
        }
        const imported = (await db.query(`SELECT ${names.map(quote).join(',')} FROM ${quote(table)} ORDER BY ${quote(key)}`)).rows;
        if (imported.length !== rows.length || digest(imported, columns) !== digest(rows, columns)) {
          throw new Error(`Data reconciliation failed for ${table}; the import will roll back.`);
        }
        if (names.includes('id')) {
          await db.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${quote(table)}`, [table]);
        }
        counts[table] = rows.length;
      }
    })();
    console.log(JSON.stringify({ mode: 'imported', backupPath, counts }, null, 2));
    return counts;
  } finally {
    snapshot?.close();
    source.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceArg = process.argv.find(arg => arg.startsWith('--source='));
  const sourcePath = sourceArg ? path.resolve(sourceArg.slice('--source='.length)) : path.join(backend, 'config/stylehub.sqlite');
  const apply = process.argv.includes('--apply');
  let db;
  try {
    if (apply) {
      const module = await import('../config/database.js');
      db = module.default;
      await module.initDatabase();
    }
    await migrateSqlite(sourcePath, db, { apply });
  } catch (error) {
    // Do not print connection URLs, query parameters, or customer records.
    console.error('Migration failed:', error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection URL]'));
    process.exitCode = 1;
  } finally { await db?.close(); }
}
