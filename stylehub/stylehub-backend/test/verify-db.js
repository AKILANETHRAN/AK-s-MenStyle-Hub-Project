import db, { initDatabase } from '../config/database.js';

console.log('--- StyleHub SQLite Database Verification Suite ---');

// Initialize database
initDatabase();

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

try {
  // 1. Verify all 14 requested tables exist
  const expectedTables = [
    'users',
    'products',
    'cart',
    'cart_items',
    'wishlists',
    'wishlist_items',
    'friendships',
    'wishlist_shares',
    'wishlist_feedback',
    'orders',
    'order_items',
    'outfit_recommendations',
    'notifications',
    'try_on_results'
  ];

  const existingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(row => row.name);

  assert(existingTables.includes('users'), '1. users table exists');
  assert(existingTables.includes('products'), '2. products table exists');

  const allTablesExist = expectedTables.every(table => existingTables.includes(table));
  assert(allTablesExist, `3. All 14 requested tables exist (${existingTables.length} tables found)`);

  // 2. Foreign keys enabled
  const fkStatus = db.pragma('foreign_keys', { simple: true });
  assert(fkStatus === 1, '4. Foreign keys enabled (PRAGMA foreign_keys = 1)');

  // 3. Unique username works (including case-insensitive NOCASE)
  let usernameDuplicateCaught = false;
  try {
    db.prepare(`
      INSERT INTO users (username, full_name, email, password_hash)
      VALUES ('ALEX_TURNER', 'Duplicate Username Test', 'different_email@example.com', 'hash')
    `).run();
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      usernameDuplicateCaught = true;
    }
  }
  assert(usernameDuplicateCaught, '5. Unique username works (case-insensitive UNIQUE constraint enforced)');

  // 4. Unique email works
  let emailDuplicateCaught = false;
  try {
    db.prepare(`
      INSERT INTO users (username, full_name, email, password_hash)
      VALUES ('unique_user_3', 'Duplicate Email Test', 'alex.turner@example.local', 'hash')
    `).run();
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      emailDuplicateCaught = true;
    }
  }
  assert(emailDuplicateCaught, '6. Unique email works (UNIQUE constraint enforced)');

  // Fetch test users & products
  const user1 = db.prepare("SELECT id FROM users WHERE username = 'alex_turner'").get();
  const user2 = db.prepare("SELECT id FROM users WHERE username = 'marcus_vance'").get();
  const product1 = db.prepare("SELECT id FROM products LIMIT 1").get();
  const product2 = db.prepare("SELECT id FROM products LIMIT 1 OFFSET 1").get();

  assert(!!user1 && !!user2 && !!product1 && !!product2, 'Seeded test users and products available for relationship checks');

  // 5. Cart & cart_items relation
  let cartId;
  const existingCart = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(user1.id);
  if (existingCart) {
    cartId = existingCart.id;
  } else {
    const cartRes = db.prepare('INSERT INTO cart (user_id) VALUES (?)').run(user1.id);
    cartId = cartRes.lastInsertRowid;
  }

  // Insert cart item
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
  db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(cartId, product1.id, 2);

  const cartItem = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, product1.id);
  assert(cartItem && cartItem.quantity === 2, '7. Cart and cart_items relation works');

  // Test duplicate cart item constraint
  let duplicateCartItemCaught = false;
  try {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(cartId, product1.id, 1);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      duplicateCartItemCaught = true;
    }
  }
  assert(duplicateCartItemCaught, '7b. Duplicate cart_item per cart correctly prevented by UNIQUE(cart_id, product_id)');

  // 6. Wishlist & wishlist_items relation
  let wishlistId;
  const existingWishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(user1.id);
  if (existingWishlist) {
    wishlistId = existingWishlist.id;
  } else {
    const wishRes = db.prepare('INSERT INTO wishlists (user_id) VALUES (?)').run(user1.id);
    wishlistId = wishRes.lastInsertRowid;
  }

  db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ?').run(wishlistId);
  db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)').run(wishlistId, product1.id);

  const wishItem = db.prepare('SELECT * FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?').get(wishlistId, product1.id);
  assert(!!wishItem, '8. Wishlist and wishlist_items relation works');

  // 7. Friendship relation
  db.prepare('DELETE FROM friendships WHERE requester_id = ? AND receiver_id = ?').run(user1.id, user2.id);
  db.prepare('INSERT INTO friendships (requester_id, receiver_id, status) VALUES (?, ?, ?)').run(user1.id, user2.id, 'ACCEPTED');

  const friendship = db.prepare('SELECT * FROM friendships WHERE requester_id = ? AND receiver_id = ?').get(user1.id, user2.id);
  assert(friendship && friendship.status === 'ACCEPTED', '9. Friendship relation works');

  // Test self-friendship check constraint
  let selfFriendshipCaught = false;
  try {
    db.prepare('INSERT INTO friendships (requester_id, receiver_id) VALUES (?, ?)').run(user1.id, user1.id);
  } catch (err) {
    if (err.message.includes('CHECK constraint failed')) {
      selfFriendshipCaught = true;
    }
  }
  assert(selfFriendshipCaught, '9b. Self-friendship (requester_id != receiver_id) correctly prevented');

  // 8. Order relation
  const testOrderNumber = `ORD-TEST-${Date.now()}`;
  const orderRes = db.prepare(`
    INSERT INTO orders (order_number, user_id, status, subtotal, total_amount, delivery_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(testOrderNumber, user1.id, 'PLACED', 499.00, 499.00, '221B Baker St, London');

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderRes.lastInsertRowid);
  assert(order && order.order_number === testOrderNumber, '10. Order relation works');

  // 9. Order items relation (snapshot test)
  const orderItemRes = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, discount, final_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(order.id, product1.id, 'Snapshot Name', 'snapshot.jpg', 1, 499.00, 0, 499.00);

  const orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(orderItemRes.lastInsertRowid);
  assert(orderItem && orderItem.product_name === 'Snapshot Name', '11. Order items relation works with snapshot fields');

  // 10. Try_on_results relation
  const tryOnRes = db.prepare(`
    INSERT INTO try_on_results (user_id, product_id, user_image_path, garment_image_path, category, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user1.id, product1.id, '/uploads/user.png', '/uploads/garment.png', 'tops', 'PROCESSING');

  const tryOn = db.prepare('SELECT * FROM try_on_results WHERE id = ?').get(tryOnRes.lastInsertRowid);
  assert(tryOn && tryOn.status === 'PROCESSING', '12. Try_on_results relation works');

  // 11. Foreign-key violation test (inserting child with non-existent parent must fail)
  let fkErrorCaught = false;
  try {
    db.prepare('INSERT INTO cart (user_id) VALUES (?)').run(999999);
  } catch (err) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      fkErrorCaught = true;
    }
  }
  assert(fkErrorCaught, '13. Invalid foreign-key insertion is properly rejected by SQLite');

} catch (e) {
  console.error('Unexpected error during verification:', e);
  failed++;
}

console.log(`\nVerification Complete: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
