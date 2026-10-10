import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

// Keep SQLite-era API response shapes: counts are numbers and timestamps strings.
pg.types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds JavaScript safe range.');
  return number;
});
pg.types.setTypeParser(1114, value => value);

/** Convert positional statement placeholders and preserve response aliases. */
export function compileStatement(sql) {
  let index = 0;
  // Strings, quoted identifiers and comments must not consume parameters.
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\?|\bAS\s+([a-zA-Z_]\w*)/gi,
    (part, alias) => {
      if (part === '?') return `$${++index}`;
      if (alias && /[a-z][A-Z]/.test(alias)) return `AS "${alias}"`;
      return part;
    });
}

export function createPostgresDatabase(pool) {
  const context = new AsyncLocalStorage();
  let savepoint = 0;
  const query = (sql, params = []) => (context.getStore() || pool).query(sql, params);
  const database = {
    query,
    prepare(sql) {
      const statement = compileStatement(sql.trim().replace(/;$/, ''));
      return {
        async all(...params) { return (await query(statement, params)).rows; },
        async get(...params) { return (await query(statement, params)).rows[0]; },
        async run(...params) {
          // All application inserts except message_templates have an identity id.
          const insert = /^INSERT\s+INTO\s+(\w+)/i.exec(statement);
          const returning = insert && insert[1] !== 'message_templates' && !/\bRETURNING\b/i.test(statement);
          const result = await query(returning ? `${statement} RETURNING id` : statement, params);
          return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
        }
      };
    },
    transaction(callback) {
      return async (...args) => {
        const existing = context.getStore();
        const client = existing || await pool.connect();
        const name = existing ? `stylehub_${++savepoint}` : null;
        try {
          await client.query(existing ? `SAVEPOINT ${name}` : 'BEGIN');
          const result = await context.run(client, () => callback(...args));
          await client.query(existing ? `RELEASE SAVEPOINT ${name}` : 'COMMIT');
          return result;
        } catch (error) {
          await client.query(existing ? `ROLLBACK TO SAVEPOINT ${name}` : 'ROLLBACK');
          throw error;
        } finally {
          if (!existing) client.release();
        }
      };
    },
    close: () => pool.end()
  };
  return database;
}

export function getConnectionUrl(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL is required. Configure a PostgreSQL connection URL before starting StyleHub.');
  const url = new URL(connectionString);
  // Render's external endpoints require TLS even when the copied URL omits it.
  // Internal hosts and other providers keep their explicitly supplied settings.
  if (url.hostname.endsWith('-postgres.render.com') &&
      ![...url.searchParams.keys()].some(key => key.startsWith('ssl'))) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required. Configure a PostgreSQL connection URL before starting StyleHub.');
  return new pg.Pool({
    connectionString: getConnectionUrl(connectionString),
    max: Number(process.env.PG_POOL_MAX || 5),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // Provider connection URLs control SSL; certificate validation is not disabled.
    options: '-c timezone=UTC'
  });
}
