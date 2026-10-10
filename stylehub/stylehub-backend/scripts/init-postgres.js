import db, { initDatabase, checkDatabaseHealth } from '../config/database.js';
try {
  await initDatabase();
  console.log(`PostgreSQL schema ready; connection ${await checkDatabaseHealth()}.`);
} finally { await db.close(); }
