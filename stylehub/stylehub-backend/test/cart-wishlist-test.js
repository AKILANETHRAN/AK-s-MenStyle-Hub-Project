import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('--- AK\'s MEN STYLE Phase 6: Cart & Wishlist Verification Suite ---');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Ensure test users exist
db.prepare(`
  INSERT OR IGNORE INTO users (id, username, full_name, email, password_hash)
  VALUES (901, 'testuser_a', 'Test User A', 'usera@example.com', 'hash_a'),
         (902, 'testuser_b', 'Test User B', 'userb@example.com', 'hash_b')
`).run();

// Clean existing cart & wishlist for test users
db.prepare('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM cart WHERE user_id IN (901, 902))').run();
db.prepare('DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE user_id IN (901, 902))').run();

// 2. Test Cart Creation
db.prepare('INSERT OR IGNORE INTO cart (user_id) VALUES (?)').run(901);
const cartA = db.prepare('SELECT * FROM cart WHERE user_id = ?').get(901);
assert(cartA && cartA.user_id === 901, '1. Cart successfully created for user 901');

// 3. Test Cart Item Creation
// Product 1: stock > 0
const prod1 = db.prepare('SELECT * FROM products WHERE id = 1').get();
assert(prod1 && prod1.stock > 0, 'Verified Product 1 exists and is in stock');

db.prepare(`
  INSERT INTO cart_items (cart_id, product_id, quantity)
  VALUES (?, ?, 2)
`).run(cartA.id, 1);

const cartItem1 = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartA.id, 1);
assert(cartItem1 && cartItem1.quantity === 2, '2. Cart item created with quantity 2');

// 4. Test Duplicate Prevention via UNIQUE(cart_id, product_id)
let duplicateThrew = false;
try {
  db.prepare(`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (?, ?, 1)
  `).run(cartA.id, 1);
} catch (e) {
  duplicateThrew = true;
}
assert(duplicateThrew, '3. Duplicate cart item correctly prevented by UNIQUE(cart_id, product_id)');

// 5. Test Upsert / Quantity Increase
db.prepare(`
  INSERT INTO cart_items (cart_id, product_id, quantity)
  VALUES (?, 1, 3)
  ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = quantity + 1
`).run(cartA.id);

const updatedItem1 = db.prepare('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartA.id, 1);
assert(updatedItem1 && updatedItem1.quantity === 3, '4. Upsert correctly updated quantity to 3 without creating duplicate row');

// 6. Test Quantity Update
db.prepare('UPDATE cart_items SET quantity = 4 WHERE cart_id = ? AND product_id = ?').run(cartA.id, 1);
const quantityUpdated = db.prepare('SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartA.id, 1);
assert(quantityUpdated && quantityUpdated.quantity === 4, '5. Cart item quantity updated to 4');

// 7. Test Remove Cart Item
db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartA.id, 1);
const removedItem = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartA.id, 1);
assert(!removedItem, '6. Cart item successfully removed from cart');

// 8. Test Clear Cart
db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, 1, 1), (?, 2, 2)').run(cartA.id, cartA.id);
const countBefore = db.prepare('SELECT COUNT(*) as c FROM cart_items WHERE cart_id = ?').get(cartA.id).c;
assert(countBefore === 2, 'Added 2 items before clearing cart');

db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartA.id);
const countAfter = db.prepare('SELECT COUNT(*) as c FROM cart_items WHERE cart_id = ?').get(cartA.id).c;
assert(countAfter === 0, '7. Clear cart successfully removed all items from cart');

// 9. Test Wishlist Creation
db.prepare('INSERT OR IGNORE INTO wishlists (user_id) VALUES (?)').run(901);
const wishA = db.prepare('SELECT * FROM wishlists WHERE user_id = ?').get(901);
assert(wishA && wishA.user_id === 901, '8. Wishlist successfully created for user 901');

// 10. Test Wishlist Item Creation
db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, 5)').run(wishA.id);
const wishItem5 = db.prepare('SELECT * FROM wishlist_items WHERE wishlist_id = ? AND product_id = 5').get(wishA.id);
assert(wishItem5 && wishItem5.product_id === 5, '9. Wishlist item created');

// 11. Test Duplicate Wishlist Prevention via UNIQUE(wishlist_id, product_id)
let wishDuplicateThrew = false;
try {
  db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, 5)').run(wishA.id);
} catch (e) {
  wishDuplicateThrew = true;
}
assert(wishDuplicateThrew, '10. Duplicate wishlist item correctly prevented by UNIQUE constraint');

// 12. Test Remove Wishlist Item
db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = 5').run(wishA.id);
const removedWish = db.prepare('SELECT * FROM wishlist_items WHERE wishlist_id = ? AND product_id = 5').get(wishA.id);
assert(!removedWish, '11. Wishlist item successfully removed');

// 13. Test User Isolation (User A vs User B)
db.prepare('INSERT OR IGNORE INTO cart (user_id) VALUES (?)').run(902);
const cartB = db.prepare('SELECT * FROM cart WHERE user_id = ?').get(902);

db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, 1, 2)').run(cartA.id);
db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, 21, 1)').run(cartB.id);

const itemsA = db.prepare('SELECT product_id FROM cart_items WHERE cart_id = ?').all(cartA.id).map(r => r.product_id);
const itemsB = db.prepare('SELECT product_id FROM cart_items WHERE cart_id = ?').all(cartB.id).map(r => r.product_id);

assert(itemsA.length === 1 && itemsA[0] === 1, '12a. User A sees only User A cart item (Product 1)');
assert(itemsB.length === 1 && itemsB[0] === 21, '12b. User B sees only User B cart item (Product 21)');

// 14. Test Persistence Across Independent DB Connection
db.close();

const reloadedDb = new Database(DB_PATH);
const reloadedCartA = reloadedDb.prepare('SELECT id FROM cart WHERE user_id = 901').get();
const reloadedItems = reloadedDb.prepare('SELECT product_id, quantity FROM cart_items WHERE cart_id = ?').all(reloadedCartA.id);
assert(reloadedItems.length === 1 && reloadedItems[0].product_id === 1 && reloadedItems[0].quantity === 2, '13. Cart items persist across independent database connection');

reloadedDb.close();

// --- HTTP API Verification ---
async function runApiTests() {
  const secret = getJwtSecret();
  const tokenA = jwt.sign({ userId: 901, email: 'usera@example.com' }, secret, { expiresIn: '1h' });
  const tokenB = jwt.sign({ userId: 902, email: 'userb@example.com' }, secret, { expiresIn: '1h' });

  const BASE = 'http://localhost:5000/api';

  // Test 1: Unauthenticated request rejected with 401
  const unauthRes = await fetch(`${BASE}/cart`);
  assert(unauthRes.status === 401, '14. GET /api/cart without JWT returns 401 Unauthorized');

  // Test 2: User A fetches cart
  const cartResA = await fetch(`${BASE}/cart`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const cartDataA = await cartResA.json();
  assert(cartResA.status === 200 && cartDataA.data.items.length === 1, '15. GET /api/cart for User A returns 1 item');

  // Test 3: Add to cart with quantity validation
  // Product 1 has stock <= 10. Let's try adding 9999 items
  const excessRes = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ productId: 1, quantity: 9999 })
  });
  assert(excessRes.status === 400, '16. POST /api/cart/items with quantity > stock is rejected with 400');

  // Test 4: Update cart quantity
  const putRes = await fetch(`${BASE}/cart/items/1`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ quantity: 3 })
  });
  const putData = await putRes.json();
  assert(putRes.status === 200 && putData.data.items[0].quantity === 3, '17. PUT /api/cart/items/1 successfully updated quantity to 3');

  // Test 5: Wishlist API toggle
  const wishPostRes = await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ productId: 10, action: 'toggle' })
  });
  const wishPostData = await wishPostRes.json();
  assert(wishPostRes.status === 200 && wishPostData.data.inWishlist === true, '18. POST /api/wishlist/items toggled item into wishlist');

  // Test 6: User isolation via API
  const cartResB = await fetch(`${BASE}/cart`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const cartDataB = await cartResB.json();
  assert(cartDataB.data.items.some(i => i.productId === 21) && !cartDataB.data.items.some(i => i.productId === 1), '19. API User isolation: User B does NOT see User A items');

  // Test 7: Clear cart
  const clearRes = await fetch(`${BASE}/cart`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const clearData = await clearRes.json();
  assert(clearRes.status === 200 && clearData.data.items.length === 0, '20. DELETE /api/cart cleared all items for User A');

  console.log(`\nCart & Wishlist Verification Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests().catch(err => {
  console.error('API testing error:', err);
  process.exit(1);
});
