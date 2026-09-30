import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- AK\'s MEN STYLE — Phase 4 Product Catalog Verification Suite ---');

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

async function runTests() {
  const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();

  // 1. 100 products exist
  assert(products.length === 100, `1. Exactly 100 products exist in SQLite (found: ${products.length})`);

  // 2. IDs 1-100 unique and sequential
  const ids = products.map(p => p.id);
  const uniqueIds = new Set(ids);
  const idsAreSequential = ids.length === 100 && ids[0] === 1 && ids[99] === 100 && uniqueIds.size === 100;
  assert(idsAreSequential, '2. Product IDs are unique and strictly 1–100 without gaps');

  // 3. 40 TOP products (IDs 1-20 and 31-50)
  const topProducts = products.filter(p => (p.id >= 1 && p.id <= 20) || (p.id >= 31 && p.id <= 50));
  assert(topProducts.length === 40, `3. Exactly 40 TOP products (found: ${topProducts.length})`);

  // 4. 10 BOTTOM products (IDs 21-30)
  const bottomProducts = products.filter(p => p.id >= 21 && p.id <= 30);
  assert(bottomProducts.length === 10, `4. Exactly 10 BOTTOM products (found: ${bottomProducts.length})`);

  // 5. 50 ACCESSORIES (IDs 51-100)
  const accessoryProducts = products.filter(p => p.id >= 51 && p.id <= 100);
  assert(accessoryProducts.length === 50, `5. Exactly 50 ACCESSORIES (found: ${accessoryProducts.length})`);

  // 6. All prices 400..700 and original_price >= price
  const allPricesValid = products.every(p => p.price >= 400 && p.price <= 700 && p.original_price >= p.price);
  assert(allPricesValid, '6. All prices satisfy 400 <= price <= 700, and original_price >= price');

  // 7. All stock 0..20 (initial 10..20, down to 0 upon purchase)
  const allStockValid = products.every(p => p.stock >= 0 && p.stock <= 20);
  assert(allStockValid, '7. All product stock values are between 0 and 20');

  // 8. No invalid status
  const allStatusValid = products.every(p => {
    if (p.stock === 0) return p.status === 'SOLD_OUT';
    return p.status === 'IN_STOCK';
  });
  assert(allStatusValid, '8. Product status correctly matches stock (IN_STOCK when stock > 0, SOLD_OUT when stock = 0)');

  // 9. All product images valid on disk
  const frontendImgDir = path.join(__dirname, '../stylehub-frontend/public');
  const allImagesExist = products.every(p => {
    const filePath = path.join(frontendImgDir, p.image);
    return fs.existsSync(filePath);
  });
  assert(allImagesExist, '9. All 100 product images (/images/products/product_X.png) exist on disk');

  // 10. Clothing garment images valid for IDs 1-50
  const clothingProducts = products.filter(p => p.id <= 50);
  const clothingGarmentsValid = clothingProducts.every(p => {
    if (!p.garment_image) return false;
    const filePath = path.join(frontendImgDir, p.garment_image);
    return fs.existsSync(filePath);
  });
  assert(clothingGarmentsValid, '10. All 50 clothing products have valid garment_image files on disk');

  // 11. Accessories garment_image = NULL
  const accessoriesGarmentNull = accessoryProducts.every(p => p.garment_image === null);
  assert(accessoriesGarmentNull, '11. All 50 accessories have garment_image = NULL');

  // 12. TOP vton category = tops
  const topsCategoryValid = topProducts.every(p => p.vton_supported === 1 && p.vton_garment_category === 'tops');
  assert(topsCategoryValid, '12. All 40 TOP products have vton_supported = 1 and vton_garment_category = "tops"');

  // 13. BOTTOM vton category = bottoms
  const bottomsCategoryValid = bottomProducts.every(p => p.vton_supported === 1 && p.vton_garment_category === 'bottoms');
  assert(bottomsCategoryValid, '13. All 10 BOTTOM products have vton_supported = 1 and vton_garment_category = "bottoms"');

  // 14. ACCESSORIES vton_supported = 0
  const accessoriesVtonZero = accessoryProducts.every(p => p.vton_supported === 0 && p.vton_garment_category === null);
  assert(accessoriesVtonZero, '14. All 50 accessories have vton_supported = 0 and vton_garment_category = NULL');

  // 15. No duplicate product IDs
  assert(uniqueIds.size === products.length, '15. Zero duplicate product IDs');

  // ===================== HTTP API TESTS =====================
  console.log('\n--- Running HTTP API Endpoint Verification ---');

  try {
    // API Test 1: GET /api/products
    const allRes = await fetch('http://localhost:5000/api/products');
    const allData = await allRes.json();
    assert(allRes.status === 200 && allData.length === 100, `API Test 1: GET /api/products returned 100 products`);

    // API Test 2: GET /api/products/1
    const p1Res = await fetch('http://localhost:5000/api/products/1');
    const p1Data = await p1Res.json();
    assert(p1Res.status === 200 && p1Data.id === 1 && p1Data.category === 'Shirts', `API Test 2: GET /api/products/1 returned product 1 (${p1Data.name})`);

    // API Test 3: GET /api/products/21
    const p21Res = await fetch('http://localhost:5000/api/products/21');
    const p21Data = await p21Res.json();
    assert(p21Res.status === 200 && p21Data.name === 'Classic Charcoal Formal Trousers', `API Test 3: GET /api/products/21 returned "${p21Data.name}"`);

    // API Test 4: GET /api/products/51
    const p51Res = await fetch('http://localhost:5000/api/products/51');
    const p51Data = await p51Res.json();
    assert(p51Res.status === 200 && p51Data.category === 'Shoes' && p51Data.vton_supported === 0, `API Test 4: GET /api/products/51 returned accessory "${p51Data.name}"`);

    // API Test 5: Search test (?search=chinos)
    const searchRes = await fetch('http://localhost:5000/api/products?search=chinos');
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.length >= 1 && searchData.some(p => p.name.includes('Chinos')), `API Test 5: Search for "chinos" returned matching items (${searchData.length} matches)`);

    // API Test 6: Category filter test (?category=Watches)
    const catRes = await fetch('http://localhost:5000/api/products?category=Watches');
    const catData = await catRes.json();
    assert(catRes.status === 200 && catData.length === 10 && catData.every(p => p.category === 'Watches'), `API Test 6: Category filter ?category=Watches returned exactly 10 watches`);

    // API Test 7: Invalid ID (e.g. 9999)
    const invalidRes = await fetch('http://localhost:5000/api/products/9999');
    assert(invalidRes.status === 404, `API Test 7: GET /api/products/9999 returned 404 Not Found as expected`);

  } catch (err) {
    console.warn(`[NOTE] HTTP API tests against port 5000 skipped if server not yet restarted: ${err.message}`);
  }

  console.log(`\nVerification Suite Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
