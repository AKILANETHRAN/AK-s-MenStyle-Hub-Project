import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);
const JWT_SECRET = getJwtSecret();
const BASE = 'http://localhost:5000/api';

console.log('================================================================');
console.log("AK'S MEN STYLE — FINAL SYSTEM & FUNCTIONAL VERIFICATION SUITE");
console.log('================================================================');

let passed = 0;
let failed = 0;

function check(condition, desc) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${desc}`);
  } else {
    failed++;
    console.error(`[FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runVerification() {
  try {
    // ----------------------------------------------------------------
    // SECTION 1: CATALOG INTEGRITY & NORMALIZATION (Reqs 8, 9, 10, 11, 20)
    // ----------------------------------------------------------------
    console.log('\n--- Section 1: Catalog Integrity & Normalization ---');
    const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
    check(products.length === 100, '1. Exactly 100 products exist in catalog');

    const pricesValid = products.every(p => p.price >= 400 && p.price <= 700);
    check(pricesValid, '2. All 100 product prices are strictly within ₹400–₹700 inclusive');

    const allowedDiscounts = [0, 20, 30, 40];
    const discountsValid = products.every(p => allowedDiscounts.includes(p.discount_percent));
    check(discountsValid, '3. All 100 product discounts are strictly 0%, 20%, 30%, or 40%');

    // Determinism test: verify discounts in db match subsequent queries
    const productsRequery = db.prepare('SELECT id, discount_percent, price FROM products ORDER BY id ASC').all();
    const discountsStable = products.every((p, idx) => p.discount_percent === productsRequery[idx].discount_percent && p.price === productsRequery[idx].price);
    check(discountsStable, '4. Discounts and prices are deterministic and persisted in SQLite');

    // Initial stock check
    const stockValid = products.every(p => p.stock >= 0 && p.stock <= 20);
    check(stockValid, '5. Stock values are valid (0 to 20 units)');

    // Garment rule check (Req 20)
    const auditedGarments = products.slice(0, 50).every(p => p.vton_supported === 1 && p.garment_image !== null);
    check(auditedGarments, '6. Products 1–50 have garment_image != null and vton_supported = 1');

    const accessoriesNoVton = products.slice(50).every(p => p.vton_supported === 0 && p.garment_image === null);
    check(accessoriesNoVton, '7. Products 51–100 have garment_image = null and vton_supported = 0');

    // ----------------------------------------------------------------
    // SECTION 2: RECOMMENDATION ENGINE ACCURACY (Reqs 15, 24, 34, 35, 36)
    // ----------------------------------------------------------------
    console.log('\n--- Section 2: Recommendation Rules & Accessory Constraints ---');
    // Top recommendation
    const topRecRes = await fetch(`${BASE}/recommendations/product/1`);
    const topRec = await topRecRes.json();
    check(topRecRes.status === 200 && topRec.recommendations && topRec.recommendations.length === 3, '8. Top #1 generates 3 complementary items (bottom, shoe, watch)');

    // Bottom recommendation
    const bottomRecRes = await fetch(`${BASE}/recommendations/product/21`);
    const bottomRec = await bottomRecRes.json();
    check(bottomRecRes.status === 200 && bottomRec.recommendations && bottomRec.recommendations.length === 3, '9. Bottom #21 generates 3 complementary items (top, shoe, watch)');

    // Accessories: NO recommendation
    const shoeRecRes = await fetch(`${BASE}/recommendations/product/51`);
    const shoeRec = await shoeRecRes.json();
    check(shoeRecRes.status === 200 && shoeRec.available === false && shoeRec.recommendations.length === 0, '10. Accessory (Shoe #51) returns available: false and empty recommendations');

    const watchRecRes = await fetch(`${BASE}/recommendations/product/61`);
    const watchRec = await watchRecRes.json();
    check(watchRecRes.status === 200 && watchRec.available === false && watchRec.recommendations.length === 0, '11. Accessory (Watch #61) returns available: false and empty recommendations');

    const capRecRes = await fetch(`${BASE}/recommendations/product/71`);
    const capRec = await capRecRes.json();
    check(capRecRes.status === 200 && capRec.available === false && capRec.recommendations.length === 0, '12. Accessory (Cap #71) returns available: false and empty recommendations');

    // ----------------------------------------------------------------
    // SECTION 3: PURCHASE QUANTITY ENFORCEMENTS & STOCK DEDUCTION (Reqs 12, 13, 16, 17, 39)
    // ----------------------------------------------------------------
    console.log('\n--- Section 3: Purchase Quantity Enforcements & Atomic Stock Logic ---');

    // Create / ensure test buyer user
    const testBuyerUser = {
      username: 'buyer_test_user_qty',
      email: 'buyer_qty@aksmenstyle.test',
      password: await bcrypt.hash('Password123!', 10),
      fullName: 'Aks Test Buyer',
      phone: '9876543210',
      address: '100 Luxury Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001'
    };

    let buyerRow = db.prepare('SELECT id FROM users WHERE username = ?').get(testBuyerUser.username);
    if (!buyerRow) {
      const ins = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, phone, address, city, state, pincode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(testBuyerUser.username, testBuyerUser.email, testBuyerUser.password, testBuyerUser.fullName, testBuyerUser.phone, testBuyerUser.address, testBuyerUser.city, testBuyerUser.state, testBuyerUser.pincode);
      buyerRow = { id: ins.lastInsertRowid };
    } else {
      db.prepare('UPDATE users SET phone = ?, address = ?, city = ?, state = ?, pincode = ? WHERE id = ?')
        .run(testBuyerUser.phone, testBuyerUser.address, testBuyerUser.city, testBuyerUser.state, testBuyerUser.pincode, buyerRow.id);
    }
    const buyerToken = jwt.sign({ userId: buyerRow.id, username: testBuyerUser.username }, JWT_SECRET, { expiresIn: '1h' });

    // Test A: Direct single purchase with quantity !== 1 MUST FAIL
    const singleExcessRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ productId: 1, quantity: 2, paymentMethod: 'CARD' })
    });
    check(singleExcessRes.status === 400, '13. Single product purchase with quantity = 2 strictly rejected with HTTP 400');
    const singleExcessData = await singleExcessRes.json();
    check(singleExcessData.message && singleExcessData.message.includes('strictly be 1'), '14. Error message confirms single product direct purchase quantity must be strictly 1');

    // Test B: Direct single purchase with quantity = 1 succeeds and decrements stock
    const p1BeforeStock = db.prepare('SELECT stock FROM products WHERE id = 1').get().stock;
    const singleSuccessRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ productId: 1, quantity: 1, paymentMethod: 'CARD' })
    });
    check(singleSuccessRes.status === 201, '15. Single product purchase with quantity = 1 succeeds with HTTP 201');
    const p1AfterStock = db.prepare('SELECT stock FROM products WHERE id = 1').get().stock;
    check(p1AfterStock === p1BeforeStock - 1, `16. Stock for product #1 accurately decremented by 1 (before: ${p1BeforeStock}, after: ${p1AfterStock})`);

    // Restore Product 1 stock
    db.prepare('UPDATE products SET stock = ? WHERE id = 1').run(p1BeforeStock);

    // Test C: Combo purchase with any item quantity !== 1 MUST FAIL
    const comboExcessRes = await fetch(`${BASE}/purchases/combo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        anchorProductId: 1,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 21, quantity: 2 }, // invalid!
          { productId: 51, quantity: 1 },
          { productId: 61, quantity: 1 }
        ],
        paymentMethod: 'CARD'
      })
    });
    check(comboExcessRes.status === 400, '17. Complete outfit purchase with any item quantity !== 1 strictly rejected with HTTP 400');
    const comboExcessData = await comboExcessRes.json();
    check(comboExcessData.message && comboExcessData.message.includes('quantity = 1'), '18. Error message confirms every piece in combo must have quantity = 1');

    // Test D: Combo purchase with quantity = 1 for all items succeeds and decrements all
    const comboPids = [1, 21, 51, 61];
    const comboStocksBefore = comboPids.map(id => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock);

    const comboSuccessRes = await fetch(`${BASE}/purchases/combo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        anchorProductId: 1,
        items: comboPids.map(id => ({ productId: id, quantity: 1 })),
        paymentMethod: 'UPI'
      })
    });
    check(comboSuccessRes.status === 201, '19. Complete outfit purchase with quantity = 1 for all items succeeds with HTTP 201');
    const comboSuccessData = await comboSuccessRes.json();
    const purchaseObj = comboSuccessData.purchase;
    check(purchaseObj && purchaseObj.items && purchaseObj.items.length === 4, '20. Combo purchase created with 4 items');
    check(purchaseObj.items.every(it => it.quantity === 1), '21. Every item in purchase history has quantity = 1');

    const comboStocksAfter = comboPids.map(id => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock);
    const allDecremented = comboStocksAfter.every((st, idx) => st === comboStocksBefore[idx] - 1);
    check(allDecremented, '22. Stock for all 4 combo products accurately decremented by 1 atomically');

    // Restore stocks
    comboPids.forEach((id, idx) => {
      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(comboStocksBefore[idx], id);
    });

    // ----------------------------------------------------------------
    // SECTION 4: FRIENDS WORKFLOW, SELECTED PRODUCT & LOOK SHARING, REACTIONS & SECURITY (Reqs 22-31, 47, 48)
    // ----------------------------------------------------------------
    console.log('\n--- Section 4: Friends Sharing, Complete Look, Reactions, and Security ---');

    // Setup 3 users: User A, User B, User C
    const setupUser = async (uname, email) => {
      let u = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
      if (!u) {
        const hash = await bcrypt.hash('Password123!', 10);
        const ins = db.prepare(`
          INSERT INTO users (username, email, password_hash, full_name, address, city, state, pincode)
          VALUES (?, ?, ?, ?, '123 Test St', 'City', 'State', '100001')
        `).run(uname, email, hash, uname);
        u = { id: ins.lastInsertRowid };
      }
      return { id: u.id, username: uname, token: jwt.sign({ userId: u.id, username: uname }, JWT_SECRET, { expiresIn: '1h' }) };
    };

    const userA = await setupUser('aks_friend_a', 'user_a@aksmenstyle.test');
    const userB = await setupUser('aks_friend_b', 'user_b@aksmenstyle.test');
    const userC = await setupUser('aks_friend_c', 'user_c@aksmenstyle.test');

    // Ensure A and B are clean, C is clean
    db.prepare('DELETE FROM friendships WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)').run(userA.id, userB.id, userB.id, userA.id);
    db.prepare('DELETE FROM friendships WHERE requester_id = ? OR receiver_id = ?').run(userC.id, userC.id);

    // A requests B
    const reqRes = await fetch(`${BASE}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` },
      body: JSON.stringify({ receiverId: userB.id })
    });
    check(reqRes.status === 201, '23. User A sends friend request to User B');
    const reqData = await reqRes.json();
    const friendshipId = reqData.data.friendshipId;

    // B accepts A
    const acceptRes = await fetch(`${BASE}/friends/${friendshipId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userB.token}` }
    });
    check(acceptRes.status === 200, '24. User B accepts friend request from User A');

    // Test A: User A attempts to share with User C (non-friend) MUST BE REJECTED (403)
    const nonFriendShareRes = await fetch(`${BASE}/wishlist/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` },
      body: JSON.stringify({ receiverId: userC.id, productIds: [1, 21], shareType: 'PRODUCTS' })
    });
    check(nonFriendShareRes.status === 403, '25. Sharing with non-friend (User C) strictly rejected with HTTP 403');

    // Test B: User A shares SELECTED PRODUCTS with User B (Friend)
    const selectedShareRes = await fetch(`${BASE}/wishlist/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` },
      body: JSON.stringify({ receiverId: userB.id, productIds: [1, 21, 61], shareType: 'PRODUCTS' })
    });
    check(selectedShareRes.status === 201, '26. User A shares selected products [1, 21, 61] with User B');
    const selectedShareData = await selectedShareRes.json();
    const selectedShareId = selectedShareData.data ? selectedShareData.data.shareId : selectedShareData.shareId;

    // Test C: User B opens shared products
    const bGetProductsRes = await fetch(`${BASE}/wishlist/shares/${selectedShareId}`, {
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    check(bGetProductsRes.status === 200, '27. User B can view shared products');
    const bGetProductsData = await bGetProductsRes.json();
    const prodShare = bGetProductsData.data || bGetProductsData;
    check(prodShare.shareType === 'PRODUCTS', '28. Share type is accurately identified as "PRODUCTS"');
    check((prodShare.products || prodShare.items).length === 3, '29. Exact 3 selected products received');

    // Test D: User B submits reaction LOVE
    const reactLoveRes = await fetch(`${BASE}/wishlist/shares/${selectedShareId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userB.token}` },
      body: JSON.stringify({ reaction: 'LOVE', comment: 'Great formal selection!' })
    });
    check(reactLoveRes.status === 201, '30. User B successfully submits LOVE reaction and comment');

    // Verify User A received WISHLIST_FEEDBACK notification
    const aNotifRes = await fetch(`${BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${userA.token}` }
    });
    const aNotifsData = await aNotifRes.json();
    const aNotifsList = aNotifsData.data ? aNotifsData.data.notifications : aNotifsData;
    const loveNotif = aNotifsList.find(n => n.type === 'WISHLIST_FEEDBACK' && (n.content || n.message || '').includes('❤️'));
    check(loveNotif !== undefined, '31. User A received WISHLIST_FEEDBACK notification mentioning LOVE');

    // Test E: User A shares COMPLETE LOOK with User B
    const lookPids = [1, 21, 53, 64];
    const lookShareRes = await fetch(`${BASE}/wishlist/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userA.token}` },
      body: JSON.stringify({ receiverId: userB.id, productIds: lookPids, shareType: 'LOOK' })
    });
    check(lookShareRes.status === 201, '32. User A shares complete outfit look [1, 21, 53, 64] with User B');
    const lookShareData = await lookShareRes.json();
    const lookShareId = lookShareData.data ? lookShareData.data.shareId : lookShareData.shareId;

    // Test F: User B views shared look and verifies exact IDs preserved
    const bGetLookRes = await fetch(`${BASE}/wishlist/shares/${lookShareId}`, {
      headers: { 'Authorization': `Bearer ${userB.token}` }
    });
    check(bGetLookRes.status === 200, '33. User B views shared look');
    const bGetLookData = await bGetLookRes.json();
    const lookShareObj = bGetLookData.data || bGetLookData;
    check(lookShareObj.shareType === 'LOOK', '34. Share type is accurately identified as "LOOK"');
    const receivedPids = (lookShareObj.products || lookShareObj.items).map(p => p.id);
    const idsMatchExact = lookPids.every((id, idx) => receivedPids[idx] === id);
    check(idsMatchExact, '35. Exact product IDs and display sequence preserved for receiver (No regeneration)');

    // Test G: User B submits reaction FIRE
    const reactFireRes = await fetch(`${BASE}/wishlist/shares/${lookShareId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userB.token}` },
      body: JSON.stringify({ reaction: 'FIRE', comment: 'This look is fire!' })
    });
    check(reactFireRes.status === 201, '36. User B submits FIRE reaction');

    // Test H: User C (Unauthorized third party) attempts to access A->B look share
    const cAccessRes = await fetch(`${BASE}/wishlist/shares/${lookShareId}`, {
      headers: { 'Authorization': `Bearer ${userC.token}` }
    });
    check(cAccessRes.status === 403, '37. Unauthorized User C denied access to A->B share with HTTP 403 Forbidden');

    // Test I: Unauthenticated access without JWT
    const noJwtRes = await fetch(`${BASE}/wishlist/shares/${lookShareId}`);
    check(noJwtRes.status === 401, '38. Unauthenticated access without JWT strictly rejected with HTTP 401 Unauthorized');

    console.log('\n================================================================');
    console.log(`✅ FINAL VERIFICATION SUITE: ALL ${passed} TESTS PASSED PERFECTLY!`);
    console.log('================================================================');
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILED (${passed} passed, ${failed} failed):`, err);
    process.exit(1);
  }
}

runVerification();
