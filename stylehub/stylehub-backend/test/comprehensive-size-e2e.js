process.env.NODE_ENV = 'test';
import Database from 'better-sqlite3';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const db = new Database('config/stylehub.sqlite');
const JWT_SECRET = process.env.JWT_SECRET || 'stylehub-super-secret-jwt-key-2025';

async function runComprehensiveE2ETests() {
  console.log('========================================================');
  console.log("AK'S MEN STYLE — COMPREHENSIVE SIZE E2E REGRESSION SUITE");
  console.log('========================================================\n');

  // Start server on an ephemeral port
  const server = app.listen(0);
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral test server running at ${BASE_URL}\n`);

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      server.close();
      throw new Error(`Assertion failed: ${message}`);
    }
    passed++;
    console.log(`✓ PASS: ${message}`);
  }

  try {
    // Find or create test user
    let testUser = db.prepare("SELECT * FROM users WHERE email = 'e2e_size_test@stylehub.com'").get();
    if (!testUser) {
      db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, phone, address, city, state, pincode, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'e2e_size_tester',
        'e2e_size_test@stylehub.com',
        '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
        'E2E Size Tester',
        '9876543210',
        '42 Luxury Boulevard',
        'Chennai',
        'Tamil Nadu',
        '600002',
        'USER'
      );
      testUser = db.prepare("SELECT * FROM users WHERE email = 'e2e_size_test@stylehub.com'").get();
    }

    const token = jwt.sign(
      { userId: testUser.id, username: testUser.username, email: testUser.email, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 1. PRODUCT API: SIZES METADATA
    console.log('\n--- 1. Product API Size Metadata ---');
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    assert(productsRes.status === 200, 'GET /api/products returns 200');
    const productsData = await productsRes.json();
    const products = productsData.products || productsData;
    assert(Array.isArray(products) && products.length === 100, 'Catalog contains 100 products');

    const topProduct = products.find(p => ['Shirts', 'T-Shirts', 'Hoodies', 'Jackets'].includes(p.category));
    const bottomProduct = products.find(p => p.category === 'Pants & Trousers');
    const watchProduct = products.find(p => p.category === 'Watches');
    const shoeProduct = products.find(p => p.category === 'Shoes');

    assert(topProduct && Array.isArray(topProduct.sizes) && topProduct.sizes.length === 5, 'Tops expose sizes: ["S","M","L","XL","XXL"]');
    assert(topProduct.sizes.join(',') === 'S,M,L,XL,XXL', 'Tops sizes exactly match S,M,L,XL,XXL');
    assert(bottomProduct && Array.isArray(bottomProduct.sizes) && bottomProduct.sizes.length === 5, 'Bottoms expose sizes: ["S","M","L","XL","XXL"]');
    assert(watchProduct && Array.isArray(watchProduct.sizes) && watchProduct.sizes.length === 0, 'Watches expose sizes: []');
    assert(shoeProduct && Array.isArray(shoeProduct.sizes) && shoeProduct.sizes.length === 0, 'Shoes expose sizes: []');

    // Single product endpoint
    const singleTopRes = await fetch(`${BASE_URL}/api/products/${topProduct.id}`);
    assert(singleTopRes.status === 200, `GET /api/products/${topProduct.id} returns 200`);
    const singleTopData = await singleTopRes.json();
    assert(singleTopData.sizes?.join(',') === 'S,M,L,XL,XXL', 'Single clothing product returns sizes S,M,L,XL,XXL');

    const singleWatchRes = await fetch(`${BASE_URL}/api/products/${watchProduct.id}`);
    assert(singleWatchRes.status === 200, `GET /api/products/${watchProduct.id} returns 200`);
    const singleWatchData = await singleWatchRes.json();
    assert(singleWatchData.sizes?.length === 0, 'Single accessory returns empty sizes []');

    // 2. BACKEND VALIDATION FOR CLOTHING & ACCESSORIES
    console.log('\n--- 2. Backend Size Validation ---');
    // Clothing without size -> 400
    const noSizeRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1 })
    });
    assert(noSizeRes.status === 400, 'Clothing add-to-cart without size is rejected with 400');
    const noSizeData = await noSizeRes.json();
    assert(noSizeData.message?.toLowerCase().includes('size'), 'Error message specifies size is required');

    // Clothing with invalid size -> 400
    const invalidSizeRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1, size: 'XS' })
    });
    assert(invalidSizeRes.status === 400, 'Clothing add-to-cart with invalid size (XS) is rejected with 400');

    const badStringSizeRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1, size: 'XXXL' })
    });
    assert(badStringSizeRes.status === 400, 'Clothing add-to-cart with invalid size (XXXL) is rejected with 400');

    // 3. CART: SIZE PERSISTENCE & VARIANTS
    console.log('\n--- 3. Cart Size Persistence & Variants ---');
    // Clear cart first
    await fetch(`${BASE_URL}/api/cart`, { method: 'DELETE', headers: authHeaders });

    // Add Size M of top
    const addMRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1, size: 'M' })
    });
    assert(addMRes.status === 200, 'Add clothing size M to cart succeeds');

    // Add Size L of same top
    const addLRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1, size: 'L' })
    });
    assert(addLRes.status === 200, 'Add clothing size L of same product to cart succeeds');

    // Add accessory without size
    const addWatchRes = await fetch(`${BASE_URL}/api/cart/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: watchProduct.id, quantity: 1 })
    });
    assert(addWatchRes.status === 200, 'Add accessory without size to cart succeeds');

    // Get cart and verify separate items
    const cartRes = await fetch(`${BASE_URL}/api/cart`, { headers: authHeaders });
    assert(cartRes.status === 200, 'GET /api/cart returns 200');
    const cartData = await cartRes.json();
    const cartItems = cartData.data?.items || cartData.items || [];
    assert(cartItems.length === 3, 'Cart contains 3 distinct items (Top M, Top L, Watch)');

    const cartTopM = cartItems.find(it => it.productId === topProduct.id && it.size === 'M');
    const cartTopL = cartItems.find(it => it.productId === topProduct.id && it.size === 'L');
    const cartWatch = cartItems.find(it => it.productId === watchProduct.id);

    assert(cartTopM && cartTopM.size === 'M', 'Cart item 1 has size M');
    assert(cartTopL && cartTopL.size === 'L', 'Cart item 2 has size L (separate variant)');
    assert(cartWatch && cartWatch.size === null, 'Cart accessory has size null');

    // Update quantity of size M
    const updateQtyRes = await fetch(`${BASE_URL}/api/cart/items/${topProduct.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ quantity: 2, size: 'M' })
    });
    assert(updateQtyRes.status === 200, 'Update quantity for size M succeeds');

    const cartAfterQtyRes = await fetch(`${BASE_URL}/api/cart`, { headers: authHeaders });
    const cartAfterQtyData = await cartAfterQtyRes.json();
    const cartAfterQtyItems = cartAfterQtyData.data?.items || cartAfterQtyData.items || [];
    const updatedTopM = cartAfterQtyItems.find(it => it.productId === topProduct.id && it.size === 'M');
    const untouchedTopL = cartAfterQtyItems.find(it => it.productId === topProduct.id && it.size === 'L');
    assert(updatedTopM.quantity === 2, 'Top M quantity updated to 2');
    assert(untouchedTopL.quantity === 1, 'Top L quantity remained 1');

    // Delete size M specifically
    const delMRes = await fetch(`${BASE_URL}/api/cart/items/${topProduct.id}?size=M`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(delMRes.status === 200, 'DELETE /api/cart/items/:id?size=M succeeds');

    const cartAfterDelRes = await fetch(`${BASE_URL}/api/cart`, { headers: authHeaders });
    const cartAfterDelData = await cartAfterDelRes.json();
    const cartAfterDelItems = cartAfterDelData.data?.items || cartAfterDelData.items || [];
    const remainingM = cartAfterDelItems.find(it => it.productId === topProduct.id && it.size === 'M');
    const remainingL = cartAfterDelItems.find(it => it.productId === topProduct.id && it.size === 'L');
    assert(!remainingM, 'Top M removed from cart');
    assert(remainingL && remainingL.size === 'L', 'Top L remains intact in cart');

    // 4. DIRECT PURCHASE WITH SIZE
    console.log('\n--- 4. Direct Single Purchase With Size ---');
    // Direct purchase clothing with no size -> 400
    const badDirectPur = await fetch(`${BASE_URL}/api/purchases/product`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1 })
    });
    assert(badDirectPur.status === 400, 'Direct clothing purchase without size rejected with 400');

    // Direct purchase clothing with size M -> 201
    const directPurRes = await fetch(`${BASE_URL}/api/purchases/product`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id, quantity: 1, size: 'M' })
    });
    assert(directPurRes.status === 201, 'Direct clothing purchase with size M returns 201 Created');
    const directPurData = await directPurRes.json();
    const purchasedItem = directPurData.purchase?.items?.[0];
    assert(purchasedItem && purchasedItem.size === 'M', 'Direct purchase item record contains size M');

    // Direct purchase accessory -> size null
    const directAccessoryRes = await fetch(`${BASE_URL}/api/purchases/product`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: watchProduct.id, quantity: 1 })
    });
    assert(directAccessoryRes.status === 201, 'Direct accessory purchase returns 201 Created');
    const directAccData = await directAccessoryRes.json();
    const purchasedAccItem = directAccData.purchase?.items?.[0];
    assert(purchasedAccItem && purchasedAccItem.size === null, 'Direct accessory purchase item has size null');

    // 5. COMPLETE THE LOOK COMBO PURCHASE
    console.log('\n--- 5. Complete the Look Outfit Combo Purchase ---');
    const comboPayload = {
      items: [
        { productId: topProduct.id, size: 'XL' },
        { productId: bottomProduct.id, size: 'L' },
        { productId: shoeProduct.id, size: null },
        { productId: watchProduct.id, size: null }
      ]
    };

    const comboPurRes = await fetch(`${BASE_URL}/api/purchases/combo`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(comboPayload)
    });
    assert(comboPurRes.status === 201, 'Complete the Look combo purchase returns 201 Created');
    const comboPurData = await comboPurRes.json();
    const comboPurItems = comboPurData.purchase?.items || [];
    assert(comboPurItems.length === 4, 'Combo purchase contains 4 items');

    const comboTop = comboPurItems.find(it => it.product_id === topProduct.id);
    const comboBottom = comboPurItems.find(it => it.product_id === bottomProduct.id);
    const comboShoe = comboPurItems.find(it => it.product_id === shoeProduct.id);
    const comboWatch = comboPurItems.find(it => it.product_id === watchProduct.id);

    assert(comboTop && comboTop.size === 'XL', 'Combo anchor clothing stores size XL');
    assert(comboBottom && comboBottom.size === 'L', 'Combo bottom clothing stores size L');
    assert(comboShoe && comboShoe.size === null, 'Combo shoes store size null');
    assert(comboWatch && comboWatch.size === null, 'Combo watch stores size null');

    // 6. PURCHASE HISTORY SNAPSHOT
    console.log('\n--- 6. Purchase History Snapshot ---');
    const historyRes = await fetch(`${BASE_URL}/api/purchases`, { headers: authHeaders });
    assert(historyRes.status === 200, 'GET /api/purchases returns 200');
    const historyData = await historyRes.json();
    const latestPurchase = historyData.purchases?.[0];
    assert(latestPurchase, 'Purchase history returns confirmed purchases');
    const histItems = latestPurchase.items || [];
    const clothingHistItem = histItems.find(it => it.size !== null);
    const accHistItem = histItems.find(it => it.size === null);
    assert(clothingHistItem && ['S', 'M', 'L', 'XL', 'XXL'].includes(clothingHistItem.size), 'Purchase history displays permanent size snapshot for clothing');
    assert(accHistItem && accHistItem.size === null, 'Purchase history omits size for accessories');

    // 7. VTON AND GARMENT INTEGRITY
    console.log('\n--- 7. VTON and Garment Image Integrity ---');
    const vtonGarments = db.prepare("SELECT COUNT(*) as count FROM products WHERE vton_supported = 1 AND garment_image IS NOT NULL").get();
    assert(vtonGarments.count === 50, 'All 50 studio garments retain valid vton_supported = 1 and non-null garment_image');

    const accessoriesNonVton = db.prepare("SELECT COUNT(*) as count FROM products WHERE vton_supported = 0 AND garment_image IS NULL").get();
    assert(accessoriesNonVton.count === 50, 'All 50 accessories remain vton_supported = 0 with garment_image NULL');

    // 8. WISHLIST INTEGRITY
    console.log('\n--- 8. Wishlist Independence ---');
    const wishRes = await fetch(`${BASE_URL}/api/wishlist/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ productId: topProduct.id })
    });
    assert([200, 201].includes(wishRes.status), 'Product can be wishlisted without size selection');

    // Clean up test user purchases and cart
    db.prepare('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM cart WHERE user_id = ?)').run(testUser.id);
    db.prepare('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE user_id = ?)').run(testUser.id);
    db.prepare('DELETE FROM purchases WHERE user_id = ?').run(testUser.id);

    console.log(`\n========================================================`);
    console.log(`ALL COMPREHENSIVE E2E TESTS PASSED (${passed}/${total})`);
    console.log(`========================================================\n`);
  } finally {
    server.close();
  }
}

runComprehensiveE2ETests().catch(err => {
  console.error('\nE2E Test Execution Error:', err);
  process.exit(1);
});
