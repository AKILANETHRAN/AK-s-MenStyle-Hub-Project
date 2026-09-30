import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';
const FRONTEND_PUBLIC = path.resolve(__dirname, '../../stylehub-frontend/public');
const BACKEND_PUBLIC = path.resolve(__dirname, '../public');

async function runTests() {
  console.log('====================================================');
  console.log("AK's MEN STYLE — PHASE 5 AUTOMATED VERIFICATION SUITE");
  console.log('====================================================\n');

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

  // 1. Fetch All Products
  const resAll = await fetch(`${BASE_URL}/api/products`);
  const allProducts = await resAll.json();
  assert(allProducts.length === 100, `Catalog contains exactly 100 products (got ${allProducts.length})`);

  // 2. Normal Product Photos & Garment Separation Verification
  let displayPhotosExist = 0;
  let garmentsExist = 0;
  let accessoriesNullGarment = 0;
  let separateImagePaths = 0;

  for (const p of allProducts) {
    const displayRel = p.image.replace(/^\//, '');
    const displayFsFront = path.join(FRONTEND_PUBLIC, displayRel);
    if (fs.existsSync(displayFsFront) && fs.statSync(displayFsFront).size > 0) {
      displayPhotosExist++;
    }

    if (p.id <= 50) {
      assert(p.vton_supported === 1, `Product #${p.id} has vton_supported === 1`);
      assert(p.garment_image !== null, `Product #${p.id} has garment_image set`);
      assert(p.image !== p.garment_image, `Product #${p.id} image (${p.image}) is strictly distinct from garment_image (${p.garment_image})`);
      
      const garmentRel = p.garment_image.replace(/^\//, '');
      const garmentFsFront = path.join(FRONTEND_PUBLIC, garmentRel);
      if (fs.existsSync(garmentFsFront) && fs.statSync(garmentFsFront).size > 0) {
        garmentsExist++;
      }
      separateImagePaths++;
    } else {
      assert(p.vton_supported === 0, `Accessory #${p.id} has vton_supported === 0`);
      assert(p.garment_image === null, `Accessory #${p.id} has garment_image === null`);
      accessoriesNullGarment++;
    }
  }

  assert(displayPhotosExist === 100, `All 100 product display photos exist and have non-zero file size`);
  assert(garmentsExist === 50, `All 50 garment-only isolated images exist for clothing IDs 1–50`);
  assert(accessoriesNullGarment === 50, `All 50 accessories (IDs 51–100) have garment_image === null`);
  assert(separateImagePaths === 50, `All 50 clothing products maintain separate image and garment_image`);

  // 3. Search Tests
  console.log('\n--- 3. SEARCH TESTS ---');
  // 3a. Search "hoodie"
  const resHoodie = await fetch(`${BASE_URL}/api/products?search=hoodie`);
  const hoodies = await resHoodie.json();
  assert(hoodies.length > 0 && hoodies.every(h => 
    h.name.toLowerCase().includes('hoodie') ||
    h.category.toLowerCase().includes('hoodie') ||
    h.description.toLowerCase().includes('hoodie')
  ), `Search "hoodie" returned ${hoodies.length} matching items`);

  // 3b. Search "navy"
  const resNavy = await fetch(`${BASE_URL}/api/products?search=navy`);
  const navies = await resNavy.json();
  assert(navies.length > 0 && navies.every(n => 
    n.name.toLowerCase().includes('navy') ||
    n.color.toLowerCase().includes('navy') ||
    n.description.toLowerCase().includes('navy')
  ), `Search "navy" returned ${navies.length} items with navy color/name/description`);

  // 3c. Search "formal"
  const resFormal = await fetch(`${BASE_URL}/api/products?search=formal`);
  const formals = await resFormal.json();
  assert(formals.length > 0, `Search "formal" returned ${formals.length} items`);

  // 4. Category Filter Tests
  console.log('\n--- 4. CATEGORY FILTER TESTS ---');
  const testCategories = [
    'Shirts', 'T-Shirts', 'Hoodies', 'Jackets', 'Pants & Trousers',
    'Shoes', 'Watches', 'Caps', 'Belts', 'Sunglasses'
  ];
  for (const cat of testCategories) {
    const resCat = await fetch(`${BASE_URL}/api/products?category=${encodeURIComponent(cat)}`);
    const catItems = await resCat.json();
    assert(catItems.length > 0 && catItems.every(i => i.category.toLowerCase() === cat.toLowerCase()),
      `Category filter "${cat}" returned ${catItems.length} items`);
  }

  // 5. Price Filter Tests
  console.log('\n--- 5. PRICE FILTER TESTS ---');
  // Under ₹200
  const resU200 = await fetch(`${BASE_URL}/api/products?maxPrice=199`);
  const u200 = await resU200.json();
  assert(u200.length === 0, `Price filter "Under ₹200" correctly returned ${u200.length} items (verified min price in catalog is ₹299)`);

  // ₹200–₹400
  const res200_400 = await fetch(`${BASE_URL}/api/products?minPrice=200&maxPrice=400`);
  const p200_400 = await res200_400.json();
  assert(p200_400.length > 0 && p200_400.every(p => p.price >= 200 && p.price <= 400),
    `Price filter "₹200–₹400" returned ${p200_400.length} items (all within range)`);

  // ₹400–₹500
  const res400_500 = await fetch(`${BASE_URL}/api/products?minPrice=401&maxPrice=500`);
  const p400_500 = await res400_500.json();
  assert(p400_500.length > 0 && p400_500.every(p => p.price >= 401 && p.price <= 500),
    `Price filter "₹400–₹500" returned ${p400_500.length} items (all within range)`);

  // ₹500–₹700
  const res500_700 = await fetch(`${BASE_URL}/api/products?minPrice=501&maxPrice=700`);
  const p500_700 = await res500_700.json();
  assert(p500_700.length > 0 && p500_700.every(p => p.price >= 501 && p.price <= 700),
    `Price filter "₹500–₹700" returned ${p500_700.length} items (all within range)`);

  // 6. Discount Filter Tests
  console.log('\n--- 6. DISCOUNT FILTER TESTS ---');
  for (const minDisc of [10, 20, 30]) {
    const resDisc = await fetch(`${BASE_URL}/api/products?minDiscount=${minDisc}`);
    const discItems = await resDisc.json();
    assert(discItems.length > 0 && discItems.every(d => d.discount_percent >= minDisc),
      `Discount filter "${minDisc}%+" returned ${discItems.length} items with discount >= ${minDisc}%`);
  }

  // 7. Stock Filter Tests
  console.log('\n--- 7. STOCK FILTER TESTS ---');
  const resInStock = await fetch(`${BASE_URL}/api/products?stockStatus=in_stock`);
  const inStock = await resInStock.json();
  assert(inStock.length > 0 && inStock.every(s => s.stock > 0),
    `Stock filter "In Stock" returned ${inStock.length} items (all stock > 0)`);

  const resOutStock = await fetch(`${BASE_URL}/api/products?stockStatus=out_of_stock`);
  const outStock = await resOutStock.json();
  assert(outStock.length === 2 && outStock.every(s => s.stock === 0),
    `Stock filter "Out of Stock" returned ${outStock.length} items (all stock === 0)`);

  // 8. Sorting Tests
  console.log('\n--- 8. SORTING TESTS ---');
  // Price: Low -> High
  const resPriceAsc = await fetch(`${BASE_URL}/api/products?sort=price_asc`);
  const priceAsc = await resPriceAsc.json();
  let isPriceAsc = true;
  for (let i = 1; i < priceAsc.length; i++) {
    if (priceAsc[i].price < priceAsc[i - 1].price) { isPriceAsc = false; break; }
  }
  assert(isPriceAsc, `Sort "Price: Low → High" accurately sorted from ₹${priceAsc[0].price} to ₹${priceAsc[priceAsc.length - 1].price}`);

  // Price: High -> Low
  const resPriceDesc = await fetch(`${BASE_URL}/api/products?sort=price_desc`);
  const priceDesc = await resPriceDesc.json();
  let isPriceDesc = true;
  for (let i = 1; i < priceDesc.length; i++) {
    if (priceDesc[i].price > priceDesc[i - 1].price) { isPriceDesc = false; break; }
  }
  assert(isPriceDesc, `Sort "Price: High → Low" accurately sorted from ₹${priceDesc[0].price} to ₹${priceDesc[priceDesc.length - 1].price}`);

  // Discount: High -> Low
  const resDiscDesc = await fetch(`${BASE_URL}/api/products?sort=discount_desc`);
  const discDesc = await resDiscDesc.json();
  let isDiscDesc = true;
  for (let i = 1; i < discDesc.length; i++) {
    if (discDesc[i].discount_percent > discDesc[i - 1].discount_percent) { isDiscDesc = false; break; }
  }
  assert(isDiscDesc, `Sort "Discount: High → Low" accurately sorted from ${discDesc[0].discount_percent}% to ${discDesc[discDesc.length - 1].discount_percent}%`);

  // Name: A -> Z
  const resNameAsc = await fetch(`${BASE_URL}/api/products?sort=name_asc`);
  const nameAsc = await resNameAsc.json();
  let isNameAsc = true;
  for (let i = 1; i < nameAsc.length; i++) {
    if (nameAsc[i].name.localeCompare(nameAsc[i - 1].name) < 0) { isNameAsc = false; break; }
  }
  assert(isNameAsc, `Sort "Name: A → Z" accurately sorted alphabetically ("${nameAsc[0].name}" ... "${nameAsc[nameAsc.length - 1].name}")`);

  // 9. Specific Products Verification (Section 29)
  console.log('\n--- 9. SPECIFIC PRODUCTS VERIFICATION (Section 29) ---');
  const targetIds = [1, 5, 8, 14, 31, 34, 42, 21, 22, 25, 27, 30, 51, 61];
  for (const tid of targetIds) {
    const resP = await fetch(`${BASE_URL}/api/products/${tid}`);
    const p = await resP.json();
    assert(p.id === tid, `Product #${tid} fetched: "${p.name}"`);
    assert(p.image === `/images/products/product_${tid}.png`, `Product #${tid} display image is /images/products/product_${tid}.png`);
    if (tid <= 50) {
      assert(p.vton_supported === 1, `Product #${tid} is clothing with vton_supported === 1`);
      assert(p.garment_image === `/images/garments/product_${tid}.png`, `Product #${tid} garment_image is separate /images/garments/product_${tid}.png`);
    } else {
      assert(p.vton_supported === 0, `Accessory #${tid} has vton_supported === 0`);
      assert(p.garment_image === null, `Accessory #${tid} has garment_image === null (No VTON)`);
    }
  }

  console.log('\n====================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
