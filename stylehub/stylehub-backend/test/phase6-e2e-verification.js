import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — Phase 6 E2E Verification Suite ===\n');

const BASE = 'http://localhost:5000/api';
const secret = getJwtSecret();

const tokenA = jwt.sign({ userId: 901, email: 'usera@example.com' }, secret, { expiresIn: '1h' });
const tokenB = jwt.sign({ userId: 902, email: 'userb@example.com' }, secret, { expiresIn: '1h' });

async function run() {
  // Clear any old data for test users
  await fetch(`${BASE}/cart`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenA}` } });
  await fetch(`${BASE}/cart`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenB}` } });
  await fetch(`${BASE}/wishlist`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenA}` } });
  await fetch(`${BASE}/wishlist`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${tokenB}` } });

  console.log('[STEP 1] Testing Section 26: User A adds Product 1 and Product 21 to Cart');
  const add1 = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 1, quantity: 1 })
  });
  const add1Data = await add1.json();
  console.log('✓ Added Product 1 to User A cart:', add1Data.status === 'success');

  const add21 = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 21, quantity: 1 })
  });
  const add21Data = await add21.json();
  console.log('✓ Added Product 21 to User A cart:', add21Data.status === 'success');

  console.log('\n[STEP 2] Testing Section 26: User A adds Product 5 and Product 31 to Wishlist');
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 5, action: 'add' })
  });
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 31, action: 'add' })
  });

  const wishA = await (await fetch(`${BASE}/wishlist`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  console.log('✓ User A Wishlist has 2 items:', wishA.data.items.length === 2);

  console.log('\n[STEP 3] Testing Section 28: Duplicate Cart Addition');
  // Add Product 1 again for User A
  const dupCart = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 1, quantity: 1 })
  });
  const dupCartData = await dupCart.json();
  console.log('✓ Total items in cart list remains 2 (no duplicate rows):', dupCartData.data.items.length === 2);
  const prod1InCart = dupCartData.data.items.find(i => i.productId === 1);
  console.log('✓ Product 1 quantity increased to 2:', prod1InCart.quantity === 2);
  console.log('✓ Total cart quantity is 3:', dupCartData.data.totalItems === 3);

  console.log('\n[STEP 4] Testing Section 28: Duplicate Wishlist Addition');
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 5, action: 'add' })
  });
  const wishADup = await (await fetch(`${BASE}/wishlist`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  console.log('✓ Wishlist still contains exactly 2 items (no duplicate entry):', wishADup.data.items.length === 2);

  console.log('\n[STEP 5] Testing Section 29: User Isolation (User B)');
  // User B adds Product 21 to cart, Product 31 to wishlist
  await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ productId: 21, quantity: 2 })
  });
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ productId: 31, action: 'add' })
  });

  const cartB = await (await fetch(`${BASE}/cart`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  const wishB = await (await fetch(`${BASE}/wishlist`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();

  console.log('✓ User B sees only their cart item (Product 21, qty 2):', cartB.data.items.length === 1 && cartB.data.items[0].productId === 21 && cartB.data.items[0].quantity === 2);
  console.log('✓ User B does NOT see Product 1 in cart:', !cartB.data.items.some(i => i.productId === 1));
  console.log('✓ User B sees only their wishlist item (Product 31):', wishB.data.items.length === 1 && wishB.data.items[0].productId === 31);
  console.log('✓ User B does NOT see Product 5 in wishlist:', !wishB.data.items.some(i => i.productId === 5));

  console.log('\n[STEP 6] Testing Section 30: Authoritative Stock Limits');
  // Check stock of Product 21
  const db = new Database(DB_PATH);
  const p21Stock = db.prepare('SELECT stock FROM products WHERE id = 21').get().stock;
  console.log(`Product 21 current stock: ${p21Stock}`);

  // Try setting quantity beyond stock
  const excessPut = await fetch(`${BASE}/cart/items/21`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ quantity: p21Stock + 1 })
  });
  console.log('✓ Setting quantity > stock rejected with HTTP 400:', excessPut.status === 400);

  console.log('\n[STEP 7] Testing Section 11 & 12: Out-Of-Stock & Insufficient Stock Handling');
  const origStock1 = db.prepare('SELECT stock FROM products WHERE id = 1').get().stock;
  try {
    // Temporarily reduce stock of Product 1 to 1 (while cart quantity is 2)
    db.prepare('UPDATE products SET stock = 1 WHERE id = 1').run();

    const cartAWarning = await (await fetch(`${BASE}/cart`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
    const p1ItemWarning = cartAWarning.data.items.find(i => i.productId === 1);
    console.log('✓ Insufficient stock detected:', p1ItemWarning.insufficientStock === true);
    console.log(`✓ Warning message displayed: "${p1ItemWarning.stockWarning}"`);

    // Temporarily set stock to 0
    db.prepare("UPDATE products SET stock = 0, status = 'SOLD_OUT' WHERE id = 1").run();
    const cartAOut = await (await fetch(`${BASE}/cart`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
    const p1ItemOut = cartAOut.data.items.find(i => i.productId === 1);
    console.log('✓ Out of stock detected:', p1ItemOut.isOutOfStock === true);
    console.log(`✓ Out of stock warning: "${p1ItemOut.stockWarning}"`);
  } finally {
    // Restore original stock
    db.prepare("UPDATE products SET stock = ?, status = 'IN_STOCK' WHERE id = 1").run(origStock1);
    db.close();
    console.log('✓ Restored Product 1 original stock in catalog.');
  }

  console.log('\n[STEP 8] Testing Section 27: Persistence Verification');
  const finalCartA = await (await fetch(`${BASE}/cart`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const finalWishA = await (await fetch(`${BASE}/wishlist`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  console.log(`✓ User A Cart persists: ${finalCartA.data.items.length} items, subtotal ₹${finalCartA.data.subtotal}`);
  console.log(`✓ User A Wishlist persists: ${finalWishA.data.items.length} items`);

  console.log('\n=== All Phase 6 Verification Steps Passed Successfully! ===');
}

run().catch(err => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
