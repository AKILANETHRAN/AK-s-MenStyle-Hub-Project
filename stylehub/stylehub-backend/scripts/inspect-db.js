import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database(path.join(__dirname, '../config/stylehub.sqlite'));

console.log('--- TABLES ---');
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  console.log(`\nTable: ${t.name} (rows: ${count})`);
  console.log(t.sql);
}

console.log('\n--- INDEXES ---');
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'").all();
for (const idx of indexes) {
  console.log(`${idx.tbl_name}: ${idx.name} => ${idx.sql}`);
}
