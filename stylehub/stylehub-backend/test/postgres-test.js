import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { compileStatement, createPostgresDatabase, getConnectionUrl } from '../config/postgres.js';
import { migrateSqlite } from '../scripts/migrate-sqlite-to-postgres.js';
import { reserveStock } from '../services/stockService.js';

test('parameters preserve literals and camelCase response aliases', () => {
  assert.equal(compileStatement("SELECT '?' AS marker, full_name AS fullName FROM users WHERE id = ? -- ?"),
    "SELECT '?' AS marker, full_name AS \"fullName\" FROM users WHERE id = $1 -- ?");
});

test('Render external URLs default to verified TLS without changing internal or explicit SSL settings', () => {
  const external = 'postgresql://test:password@dpg-example-a.ohio-postgres.render.com/stylehub';
  assert.equal(new URL(getConnectionUrl(external)).searchParams.get('sslmode'), 'verify-full');
  assert.equal(new URL(getConnectionUrl(`${external}?sslmode=require`)).searchParams.get('sslmode'), 'require');
  assert.equal(new URL(getConnectionUrl('postgresql://test:password@dpg-example-a/stylehub')).searchParams.get('sslmode'), null);
  assert.equal(new URL(getConnectionUrl('postgresql://test:password@localhost/stylehub')).searchParams.get('sslmode'), null);
});

test('PostgreSQL import, transactions, and HTTP application flows', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.endsWith('_test'),
    'Integration tests require an isolated local database ending in _test.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_ENABLED = 'false';
  process.env.MONGODB_URI = '';
  process.env.META_WHATSAPP_ACCESS_TOKEN = '';
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = '';
  process.env.TWILIO_ACCOUNT_SID = '';
  process.env.TWILIO_AUTH_TOKEN = '';
  process.env.VTON_SERVICE_URL = 'http://127.0.0.1:1';
  const { default: db, initDatabase } = await import('../config/database.js');
  await initDatabase();
  const schemaName = `migration_test_${Date.now()}`;
  const users = [];
  let server;
  let productId;
  let secondProductId;
  try {
    await t.test('imports all local rows, verifies values, and refuses an occupied target', async () => {
      await db.query(`CREATE SCHEMA ${schemaName}`);
      const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schemaName} -c timezone=UTC` });
      const isolated = createPostgresDatabase(pool);
      try {
        const schema = await readFile(new URL('../migrations/001-postgresql.sql', import.meta.url), 'utf8');
        await isolated.query(schema);
        const sourcePath = new URL('../config/stylehub.sqlite', import.meta.url);
        const { fileURLToPath } = await import('node:url');
        const counts = await migrateSqlite(fileURLToPath(sourcePath), isolated, { apply: true });
        assert.equal(Object.keys(counts).length, 21);
        assert.ok(counts.users > 0 && counts.products > 0);
        await assert.rejects(migrateSqlite(fileURLToPath(sourcePath), isolated, { apply: true }), /not empty/);
        assert.equal((await isolated.prepare('SELECT COUNT(*) AS count FROM users').get()).count, counts.users);
        const next = await isolated.prepare("INSERT INTO users(full_name,email,password_hash) VALUES ('Sequence Test', ?, 'unused')").run(`sequence-${Date.now()}@example.invalid`);
        assert.ok(next.lastInsertRowid > (await isolated.prepare('SELECT MAX(id) AS maximum FROM users WHERE id != ?').get(next.lastInsertRowid)).maximum);
      } finally { await isolated.close(); }
    });

    await t.test('failed transactions roll back and concurrent reservations cannot oversell', async () => {
      const insert = await db.prepare("INSERT INTO products(name,category,price,original_price,stock) VALUES ('Postgres Test', 'Accessories', 450, 450, 1)").run();
      productId = insert.lastInsertRowid;
      await assert.rejects(db.transaction(async () => {
        await db.prepare('UPDATE products SET stock = 10 WHERE id = ?').run(productId);
        throw new Error('rollback test');
      })(), /rollback test/);
      assert.equal((await db.prepare('SELECT stock FROM products WHERE id = ?').get(productId)).stock, 1);
      const results = await Promise.allSettled([1, 2].map(() => db.transaction(() => reserveStock(db, productId, 1))()));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await db.prepare('SELECT stock FROM products WHERE id = ?').get(productId)).stock, 0);
      await db.prepare("UPDATE products SET stock = 20, status = 'IN_STOCK' WHERE id = ?").run(productId);
    });

    const { default: app } = await import('../server.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(endpoint, { token, body, method = 'GET' } = {}) {
      const response = await fetch(`${base}${endpoint}`, { method, headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    }
    const suffix = Date.now();
    let token;
    let secondToken;
    let username;
    await t.test('registration, login, profile aliases, and case-insensitive username uniqueness', async () => {
      for (const index of [1, 2]) {
        const body = { username: `pg_${suffix}_${index}`, fullName: 'Postgres Test User', email: `pg-${suffix}-${index}@example.invalid`, password: 'test-password-123',
          phone: '9999999999', address: 'Test address', city: 'Test city', state: 'Test state', pincode: '600001' };
        const result = await request('/auth/register', { method: 'POST', body });
        assert.equal(result.status, 201, JSON.stringify(result.data));
        users.push(result.data.user.id);
        if (index === 1) { token = result.data.token; username = body.username; }
        else secondToken = result.data.token;
      }
      const me = await request('/auth/me', { token });
      assert.equal(me.data.fullName, 'Postgres Test User');
      const login = await request('/auth/login', { method: 'POST', body: { email: `pg-${suffix}-1@example.invalid`, password: 'test-password-123' } });
      assert.equal(login.status, 200);
      assert.equal((await request(`/auth/check-username?username=${username.toUpperCase()}`)).data.available, false);
    });

    await t.test('catalog, recommendations, settings, notifications, history, and admin queries', async () => {
      await db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(users[0]);
      for (const endpoint of ['/products?page=1', `/products/${productId}`, '/settings', '/notifications', '/recently-accessed', '/purchases?page=1',
        '/admin/metrics', '/admin/products?page=1', '/admin/users', '/admin/purchases', '/admin/vton-stats', '/admin/recent-activity', '/admin/message-templates']) {
        const result = await request(endpoint, { token });
        assert.equal(result.status, 200, `${endpoint}: ${JSON.stringify(result.data)}`);
      }
      const anchor = await db.prepare('SELECT id FROM products WHERE vton_supported = 1 ORDER BY id LIMIT 1').get();
      if (anchor) assert.equal((await request(`/recommendations/product/${anchor.id}`, { token })).status, 200);
      assert.equal((await request('/admin/message-templates', { token, method: 'PUT', body: { channel: 'EMAIL', body: 'Purchase {purchaseId}' } })).status, 200);
    });

    await t.test('cart, wishlist, direct purchase and cart checkout persist correctly', async () => {
      assert.ok([200, 201].includes((await request('/cart/items', { token, method: 'POST', body: { productId, quantity: 1 } })).status));
      assert.equal((await request('/cart', { token })).status, 200);
      assert.ok([200, 201].includes((await request('/wishlist/items', { token, method: 'POST', body: { productId, action: 'add' } })).status));
      assert.equal((await request('/wishlist', { token })).status, 200);
      const purchase = await request('/purchases/product', { token, method: 'POST', body: { productId, quantity: 1 } });
      assert.equal(purchase.status, 201, JSON.stringify(purchase.data));
      const checkout = await request('/purchases/cart', { token, method: 'POST', body: {} });
      assert.equal(checkout.status, 201, JSON.stringify(checkout.data));
      const history = await request('/purchases', { token });
      assert.equal(history.status, 200);
      assert.equal(history.data.purchases.length, 2);
      assert.ok(history.data.purchases.every(p => Array.isArray(p.items) && p.items.length));
    });

    await t.test('friends search and friend-request notifications preserve response fields', async () => {
      assert.equal((await request(`/friends/search?q=${username.toUpperCase()}`, { token: secondToken })).status, 200);
      const result = await request('/friends/request', { token: secondToken, method: 'POST', body: { username: username.toUpperCase() } });
      assert.ok([200, 201].includes(result.status), JSON.stringify(result.data));
      assert.equal((await request('/friends/requests', { token })).status, 200);
      const friendshipId = result.data.data.friendshipId;
      assert.equal((await request(`/friends/${friendshipId}/accept`, { token, method: 'POST', body: {} })).status, 200);
      const shared = await request('/wishlist/shares', { token, method: 'POST', body: { receiverId: users[1], productIds: [productId] } });
      assert.equal(shared.status, 201, JSON.stringify(shared.data));
      const shareId = shared.data.data.shareId;
      assert.equal((await request(`/wishlist/shares/${shareId}`, { token: secondToken })).status, 200);
      const feedback = await request(`/wishlist/shares/${shareId}/feedback`, { token: secondToken, method: 'POST', body: { reaction: 'LIKE', comment: 'Test feedback' } });
      assert.ok([200, 201].includes(feedback.status), JSON.stringify(feedback.data));
      assert.equal((await request('/settings', { token, method: 'PUT', body: { language: 'hi', communication: { email: false, sms: false, whatsapp: false } } })).status, 200);
    });

    await t.test('Google account persistence preserves identity and nullable usernames', async () => {
      const { findOrCreateGoogleUser } = await import('../controllers/googleAuthController.js');
      const profile = { googleId: `pg_test_${suffix}`, email: `pg-google-${suffix}@example.invalid`, fullName: 'Google Test User', avatarUrl: null };
      const created = await findOrCreateGoogleUser(profile);
      users.push(created.id);
      assert.equal(created.username, null);
      assert.equal((await findOrCreateGoogleUser(profile)).id, created.id);
    });

    await t.test('combo checkout commits every item in the same purchase', async () => {
      const insert = await db.prepare("INSERT INTO products(name,category,price,original_price,stock) VALUES ('Combo Test', 'Accessories', 450, 450, 10)").run();
      secondProductId = insert.lastInsertRowid;
      const result = await request('/purchases/combo', { token, method: 'POST', body: { productIds: [productId, secondProductId] } });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      assert.equal(result.data.purchase.items.length, 2);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const id of users) await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (productId) await db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    if (secondProductId) await db.prepare('DELETE FROM products WHERE id = ?').run(secondProductId);
    await db.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await db.close();
  }
});
