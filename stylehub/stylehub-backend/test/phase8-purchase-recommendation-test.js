import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — Phase 8: Recommendation Uniqueness & Simple Purchase Test Suite ===\n');

const BASE = 'http://localhost:5000/api';
const secret = getJwtSecret();

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

// Setup test users:
// User 981: Incomplete address initially
// User 982: Complete address
// User 983: Second user for isolation check
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash, phone, address, city, state, pincode)
  VALUES 
    (981, 'buyer_no_addr', 'No Address User', 'buyer_no_addr@example.com', 'hash_981', NULL, NULL, NULL, NULL, NULL),
    (982, 'buyer_complete', 'John Doe', 'buyer_complete@example.com', 'hash_982', '+91 9876543210', '42 Fashion Blvd', 'Chennai', 'Tamil Nadu', '600001'),
    (983, 'buyer_isolation', 'Alice Smith', 'buyer_isolation@example.com', 'hash_983', '+91 9876543211', '10 Park Avenue', 'Mumbai', 'Maharashtra', '400001')
`).run();

const tokenNoAddr = jwt.sign({ userId: 981, email: 'buyer_no_addr@example.com' }, secret, { expiresIn: '1h' });
const tokenComplete = jwt.sign({ userId: 982, email: 'buyer_complete@example.com' }, secret, { expiresIn: '1h' });
const tokenOther = jwt.sign({ userId: 983, email: 'buyer_isolation@example.com' }, secret, { expiresIn: '1h' });

async function runTests() {
  try {
    // -------------------------------------------------------------
    // SECTION 1: RECOMMENDATION ELIGIBILITY & BASIC RULES
    // -------------------------------------------------------------
    console.log('--- 1. Recommendation Eligibility Tests (Sections 24 & 27) ---');

    // Test 1: Invalid product ID
    const recInvalid = await fetch(`${BASE}/recommendations/product/abc`);
    assert(recInvalid.status === 400, '1. GET /api/recommendations/product/abc returns 400 Bad Request');

    // Test 2: Non-existent product ID
    const recNotFound = await fetch(`${BASE}/recommendations/product/9999`);
    assert(recNotFound.status === 404, '2. GET /api/recommendations/product/9999 returns 404 Not Found');

    // Test 3: TOP #1 -> recommendation exists
    const rec1Res = await fetch(`${BASE}/recommendations/product/1`);
    assert(rec1Res.status === 200, '3. TOP #1 returns 200 OK');
    const rec1Data = await rec1Res.json();
    assert(rec1Data.status === 'success' && rec1Data.available === true, '4. TOP #1 recommendation is available');
    assert(rec1Data.recommendations.length === 3, '5. TOP #1 returns exactly 3 complementary items (Bottom, Shoes, Watch)');
    const sig1 = rec1Data.signature;
    assert(!!sig1, `6. TOP #1 has valid signature: ${sig1}`);

    // Test 7: TOP #2 -> recommendation exists and signature differs from #1
    const rec2Res = await fetch(`${BASE}/recommendations/product/2`);
    const rec2Data = await rec2Res.json();
    assert(rec2Data.available === true, '7. TOP #2 recommendation is available');
    assert(rec2Data.signature !== sig1, `8. TOP #2 signature (${rec2Data.signature}) strictly differs from #1 (${sig1})`);

    // Test 9: TOP #10 -> recommendation exists and signature differs
    const rec10Res = await fetch(`${BASE}/recommendations/product/10`);
    const rec10Data = await rec10Res.json();
    assert(rec10Data.available === true, '9. TOP #10 recommendation is available');
    assert(rec10Data.signature !== sig1 && rec10Data.signature !== rec2Data.signature, '10. TOP #10 signature differs from previous anchors');

    // Test 11: BOTTOM #21 -> recommendation exists
    const rec21Res = await fetch(`${BASE}/recommendations/product/21`);
    const rec21Data = await rec21Res.json();
    assert(rec21Data.available === true, '11. BOTTOM #21 recommendation is available');
    assert(rec21Data.recommendations.some(r => r.slot === 'Top'), '12. BOTTOM #21 includes Top slot');
    const sig21 = rec21Data.signature;

    // Test 13: BOTTOM #22 -> recommendation exists and signature differs from #21
    const rec22Res = await fetch(`${BASE}/recommendations/product/22`);
    const rec22Data = await rec22Res.json();
    assert(rec22Data.available === true, '13. BOTTOM #22 recommendation is available');
    assert(rec22Data.signature !== sig21, `14. BOTTOM #22 signature (${rec22Data.signature}) strictly differs from #21 (${sig21})`);

    // Test 15-19: ACCESSORIES (51, 61, 71, 81, 91) -> NO RECOMMENDATION (available: false)
    const accessoryChecks = [
      { id: 51, name: 'Shoes' },
      { id: 61, name: 'Watches' },
      { id: 71, name: 'Caps' },
      { id: 81, name: 'Belts' },
      { id: 91, name: 'Sunglasses' }
    ];

    for (const acc of accessoryChecks) {
      const accRes = await fetch(`${BASE}/recommendations/product/${acc.id}`);
      assert(accRes.status === 200, `15. Accessory #${acc.id} (${acc.name}) returns 200 OK`);
      const accData = await accRes.json();
      assert(
        accData.available === false && accData.reason.includes('tops and bottoms'),
        `16. Accessory #${acc.id} (${acc.name}) strictly rejects recommendation with available: false`
      );
    }

    // -------------------------------------------------------------
    // SECTION 2: 100% UNIQUE SIGNATURE TEST ACROSS ALL 50 CLOTHING ITEMS (Section 25)
    // -------------------------------------------------------------
    console.log('\n--- 2. Full Catalog Uniqueness Test Across All 50 Tops & Bottoms ---');

    const clothingProducts = db.prepare('SELECT id, name, vton_garment_category FROM products WHERE vton_supported = 1 ORDER BY id ASC').all();
    assert(clothingProducts.length === 50, `17. Exactly 50 VTON clothing products exist (found: ${clothingProducts.length})`);

    const signaturesCollected = [];
    const signaturesSet = new Set();

    for (const item of clothingProducts) {
      const res = await fetch(`${BASE}/recommendations/product/${item.id}`);
      const data = await res.json();
      assert(data.available === true, `Recommendation available for clothing #${item.id} (${item.name})`);
      assert(!!data.signature, `Valid signature returned for clothing #${item.id}`);

      signaturesCollected.push({
        id: item.id,
        name: item.name,
        category: item.vton_garment_category,
        sig: data.signature
      });
      signaturesSet.add(data.signature);
    }

    const duplicatesCount = signaturesCollected.length - signaturesSet.size;
    assert(duplicatesCount === 0, `18. UNIQUE COMPLETE-THE-LOOK COMBINATIONS: ${signaturesSet.size}/${signaturesCollected.length} (Duplicates: ${duplicatesCount})`);
    assert(signaturesSet.size === 50, '19. Exactly 50 unique combination signatures allocated for all 50 clothing anchors');

    // -------------------------------------------------------------
    // SECTION 3: OUT-OF-STOCK TEST & DYNAMIC RE-ALLOCATION (Section 26)
    // -------------------------------------------------------------
    console.log('\n--- 3. Out-Of-Stock Test & Dynamic Re-Allocation ---');

    // Read current recommendation for Top #1
    const rec1Current = await fetch(`${BASE}/recommendations/product/1`).then(r => r.json());
    const firstRecItem = rec1Current.recommendations[0].product;
    const originalStock = firstRecItem.stock;

    // Temporarily mark the recommended item as SOLD_OUT (stock = 0)
    db.prepare("UPDATE products SET stock = 0, status = 'SOLD_OUT' WHERE id = ?").run(firstRecItem.id);

    // Re-fetch recommendations for Top #1
    const rec1AfterOos = await fetch(`${BASE}/recommendations/product/1`).then(r => r.json());
    assert(rec1AfterOos.available === true, '20. Recommendation regenerated successfully when prior piece went OOS');
    const oosFound = rec1AfterOos.recommendations.some(r => r.product.id === firstRecItem.id);
    assert(!oosFound, `21. Out-of-stock product #${firstRecItem.id} was excluded from regenerated outfit`);
    assert(rec1AfterOos.recommendations.every(r => r.product.stock > 0), '22. All newly recommended pieces have stock > 0');

    // Restore stock
    db.prepare("UPDATE products SET stock = ?, status = 'IN_STOCK' WHERE id = ?").run(originalStock, firstRecItem.id);
    // Refresh Top #1
    await fetch(`${BASE}/recommendations/product/1`);

    // -------------------------------------------------------------
    // SECTION 4: SINGLE PRODUCT & COMBO PURCHASE FLOW REGRESSION (Section 28)
    // -------------------------------------------------------------
    console.log('\n--- 4. Purchase Flow & Regression Verification ---');

    // Unauthenticated purchase rejected
    const unauthRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 1, quantity: 1 })
    });
    assert(unauthRes.status === 401, '23. POST /api/purchases/product without JWT returns 401');

    // Incomplete address rejected
    const noAddrRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenNoAddr}`
      },
      body: JSON.stringify({ productId: 1, quantity: 1 })
    });
    assert(noAddrRes.status === 400, '24. Purchase rejected when user delivery address is incomplete');

    // Purchase Single Accessory (Shoe #51) - MUST purchase ONLY Shoe #51, no combo
    const shoe51Before = db.prepare('SELECT stock, price FROM products WHERE id = 51').get();
    const purchaseShoeRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenComplete}`
      },
      body: JSON.stringify({ productId: 51, quantity: 1 })
    });
    assert(purchaseShoeRes.status === 201, '25. Accessory #51 purchased individually with 201 Created');
    const shoeData = await purchaseShoeRes.json();
    assert(shoeData.purchase.items.length === 1 && shoeData.purchase.items[0].product_id === 51, '26. Accessory purchase contains ONLY selected accessory (no combo)');
    assert(shoeData.purchase.purchase_type === 'SINGLE', '27. Accessory purchase_type is SINGLE');

    // Purchase Top #1 Single (BUY PRODUCT ONLY)
    const p1Before = db.prepare('SELECT stock, price FROM products WHERE id = 1').get();
    const purchaseSingleRes = await fetch(`${BASE}/purchases/product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenComplete}`
      },
      body: JSON.stringify({ productId: 1, quantity: 1 })
    });
    assert(purchaseSingleRes.status === 201, '28. Top #1 BUY PRODUCT ONLY succeeds with 201 Created');
    const singleData = await purchaseSingleRes.json();
    assert(singleData.purchase.items.length === 1 && singleData.purchase.items[0].product_id === 1, '29. Single top purchase contains only Product #1');
    const createdPurchaseId = singleData.purchase.id;

    // Purchase Combo (PURCHASE COMPLETE OUTFIT)
    const recForCombo = await fetch(`${BASE}/recommendations/product/2`).then(r => r.json());
    const comboProductIds = [2, ...recForCombo.recommendations.map(r => r.product.id)];
    const comboRes = await fetch(`${BASE}/purchases/combo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenComplete}`
      },
      body: JSON.stringify({ productIds: comboProductIds })
    });
    assert(comboRes.status === 201, '30. PURCHASE COMPLETE OUTFIT succeeds with 201 Created');
    const comboData = await comboRes.json();
    assert(comboData.purchase.purchase_type === 'COMBO', '31. Combo purchase_type is COMBO');
    assert(comboData.purchase.items.length === 4, '32. Combo contains anchor + 3 complementary items (4 total pieces)');

    // -------------------------------------------------------------
    // SECTION 5: SECURITY & USER ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 5. Security & User Isolation ---');

    // Owner (User 982) accesses purchase
    const ownerRes = await fetch(`${BASE}/purchases/${createdPurchaseId}`, {
      headers: { 'Authorization': `Bearer ${tokenComplete}` }
    });
    assert(ownerRes.status === 200, '33. Owner (User 982) can access their purchase');

    // Other user (User 983) is 403 Forbidden
    const intruderRes = await fetch(`${BASE}/purchases/${createdPurchaseId}`, {
      headers: { 'Authorization': `Bearer ${tokenOther}` }
    });
    assert(intruderRes.status === 403, '34. Other user (User 983) strictly rejected with 403 Forbidden');

    // Verify absence of tracking fields
    const dbRow = db.prepare('SELECT * FROM purchases WHERE id = ?').get(createdPurchaseId);
    assert(dbRow.shipment_status === undefined && dbRow.tracking_number === undefined, '35. Purchases table has strictly zero shipment/delivery tracking columns');

    // Restore stock for affected products
    db.prepare('UPDATE products SET stock = ?, status = ? WHERE id = 51').run(shoe51Before.stock, 'IN_STOCK');
    db.prepare('UPDATE products SET stock = ?, status = ? WHERE id = 1').run(p1Before.stock, 'IN_STOCK');
    for (const pid of comboProductIds) {
      db.prepare("UPDATE products SET stock = MIN(20, stock + 1), status = 'IN_STOCK' WHERE id = ?").run(pid);
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\nPhase 8 Refined Verification Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
