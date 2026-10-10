import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.STYLEHUB_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
const { default: app } = await import('../server.js');
const { default: db } = await import('../config/database.js');

const insertProduct = db.prepare(`INSERT INTO products
  (name, category, price, original_price, stock) VALUES (?, ?, 500, 600, 10)`);
for (let i = 1; i <= 25; i += 1) insertProduct.run(`Pagination Shirt ${i}`, 'Shirts');
const insertUser = db.prepare(`INSERT INTO users
  (username, full_name, email, password_hash) VALUES (?, ?, ?, 'test-hash')`);
for (let i = 1; i <= 22; i += 1) insertUser.run(`page_user_${i}`, `Page User ${i}`, `page${i}@example.test`);
db.prepare("UPDATE users SET role = 'ADMIN' WHERE id = 1").run();
const insertPurchase = db.prepare(`INSERT INTO purchases
  (user_id, purchase_type, total_amount, delivery_name, delivery_phone,
   delivery_address, delivery_city, delivery_state, delivery_pincode)
  VALUES (?, 'SINGLE', 500, 'Test User', '9999999999', 'Test Street', 'Chennai', 'TN', '600001')`);
for (let i = 0; i < 23; i += 1) insertPurchase.run(2);
insertPurchase.run(1);

const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const base = `http://127.0.0.1:${server.address().port}`;
const secret = process.env.JWT_SECRET || 'stylehub_secure_jwt_secret_key_2026';
const adminHeaders = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, secret)}` };
const userHeaders = { Authorization: `Bearer ${jwt.sign({ userId: 2 }, secret)}` };
const read = async (path, headers) => {
  const response = await fetch(`${base}${path}`, { headers });
  return { status: response.status, body: await response.json() };
};

try {
  const first = await read('/api/products?page=1&limit=12&category=Shirts');
  const second = await read('/api/products?page=2&limit=12&category=Shirts');
  assert.equal(first.status, 200);
  assert.equal(first.body.pagination.total, 26);
  assert.equal(first.body.pagination.totalPages, 3);
  assert.equal(first.body.products.length, 12);
  assert.equal(second.body.products.length, 12);
  assert.notEqual(first.body.products[0].id, second.body.products[0].id);
  assert.equal((await read('/api/products?page=3&limit=12&category=Shirts')).body.products.length, 2);
  assert.equal((await read('/api/products?page=1&search=no-such-item')).body.pagination.total, 0);
  assert.equal((await read('/api/products?page=0')).status, 400);
  assert.ok(Array.isArray((await read('/api/products')).body));

  const ownPurchases = await read('/api/purchases?page=2&limit=10', userHeaders);
  assert.equal(ownPurchases.body.pagination.total, 23);
  assert.equal(ownPurchases.body.purchases.length, 10);
  assert.ok(ownPurchases.body.purchases.every(purchase => purchase.user_id === 2));
  assert.equal((await read('/api/admin/users?page=2&limit=20', userHeaders)).status, 403);

  const adminProducts = await read('/api/admin/products?page=2&limit=20', adminHeaders);
  assert.equal(adminProducts.body.pagination.total, 28);
  assert.equal(adminProducts.body.products.length, 8);
  const adminUsers = await read('/api/admin/users?page=2&limit=20', adminHeaders);
  assert.equal(adminUsers.body.pagination.total, 24);
  assert.equal(adminUsers.body.users.length, 4);
  const adminPurchases = await read('/api/admin/purchases?page=3&limit=10', adminHeaders);
  assert.equal(adminPurchases.body.pagination.total, 24);
  assert.equal(adminPurchases.body.purchases.length, 4);
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
}

console.log('Catalog, admin, and purchase pagination checks passed.');
