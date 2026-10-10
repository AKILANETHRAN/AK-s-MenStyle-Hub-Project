const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

console.log('====================================================');
console.log('AK\'S MEN STYLE — CATALOG DATA INTEGRITY VERIFICATION');
console.log('====================================================');

const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();

let errors = [];
let passedChecks = 0;

// 1. Exactly 100 products with continuous IDs 1 to 100
if (products.length !== 100) {
  errors.push(`Expected exactly 100 products, found ${products.length}`);
} else {
  passedChecks++;
  console.log('✓ Product count: Exactly 100 products found.');
}

const ids = products.map(p => p.id);
const expectedIds = Array.from({ length: 100 }, (_, i) => i + 1);
const missingIds = expectedIds.filter(id => !ids.includes(id));
if (missingIds.length > 0) {
  errors.push(`Missing product IDs: ${missingIds.join(', ')}`);
} else {
  passedChecks++;
  console.log('✓ Continuous IDs 1..100 verified.');
}

// 2. Price check: 400 <= price <= 700
const invalidPrices = products.filter(p => p.price < 400 || p.price > 700);
if (invalidPrices.length > 0) {
  errors.push(`${invalidPrices.length} products have prices outside ₹400–₹700: ${invalidPrices.map(p => `#${p.id}:₹${p.price}`).slice(0, 5).join(', ')}`);
} else {
  passedChecks++;
  const minP = Math.min(...products.map(p => p.price));
  const maxP = Math.max(...products.map(p => p.price));
  console.log(`✓ Selling prices: All 100 products are between ₹400 and ₹700 (min: ₹${minP}, max: ₹${maxP}).`);
}

// 3. Discount check: strictly 0, 20, 30, 40
const allowedDiscounts = [0, 20, 30, 40];
const invalidDiscounts = products.filter(p => !allowedDiscounts.includes(p.discount_percent));
if (invalidDiscounts.length > 0) {
  errors.push(`${invalidDiscounts.length} products have discounts outside [0, 20, 30, 40]: ${invalidDiscounts.map(p => `#${p.id}:${p.discount_percent}%`).slice(0, 5).join(', ')}`);
} else {
  passedChecks++;
  const discountCounts = { 0: 0, 20: 0, 30: 0, 40: 0 };
  products.forEach(p => discountCounts[p.discount_percent]++);
  console.log(`✓ Discounts strictly allowed values: 0% (${discountCounts[0]}), 20% (${discountCounts[20]}), 30% (${discountCounts[30]}), 40% (${discountCounts[40]}).`);
}

// 4. Initial stock check: 10 <= stock <= 20
const invalidStocks = products.filter(p => p.stock < 10 || p.stock > 20);
if (invalidStocks.length > 0) {
  errors.push(`${invalidStocks.length} products have stock outside 10–20: ${invalidStocks.map(p => `#${p.id}:${p.stock}`).slice(0, 5).join(', ')}`);
} else {
  passedChecks++;
  const minS = Math.min(...products.map(p => p.stock));
  const maxS = Math.max(...products.map(p => p.stock));
  console.log(`✓ Stock normalization: All 100 products have 10–20 units (min: ${minS}, max: ${maxS}).`);
}

// 5. Product display images: valid and existing
let missingDisplayImages = [];
const publicDir = path.resolve(__dirname, '../public');
const frontendPublicDir = path.resolve(__dirname, '../../stylehub-frontend/public');

for (const p of products) {
  if (!p.image || typeof p.image !== 'string' || !p.image.trim()) {
    missingDisplayImages.push(`#${p.id} missing image url`);
    continue;
  }
  const relPath = p.image.replace(/^\//, '');
  const localFile1 = path.join(publicDir, relPath);
  const localFile2 = path.join(frontendPublicDir, relPath);
  if (!fs.existsSync(localFile1) && !fs.existsSync(localFile2)) {
    missingDisplayImages.push(`#${p.id}: ${p.image}`);
  }
}

if (missingDisplayImages.length > 0) {
  errors.push(`Missing display images on disk: ${missingDisplayImages.slice(0, 5).join(', ')}`);
} else {
  passedChecks++;
  console.log('✓ Product images: All 100 products have valid, verified display images.');
}

// 6. Products 1-50: garment_image exists & vton_supported = 1
const invalidVton1to50 = products.slice(0, 50).filter(p => {
  if (p.vton_supported !== 1 || !p.garment_image) return true;
  const relPath = p.garment_image.replace(/^\//, '');
  const f1 = path.join(publicDir, relPath);
  const f2 = path.join(frontendPublicDir, relPath);
  return !fs.existsSync(f1) && !fs.existsSync(f2);
});

if (invalidVton1to50.length > 0) {
  errors.push(`Products 1-50 invalid VTON: ${invalidVton1to50.map(p => `#${p.id}`).join(', ')}`);
} else {
  passedChecks++;
  console.log('✓ Products 1–50: Exactly 50 audited garments exist with vton_supported = 1.');
}

// 7. Products 51-100: garment_image = NULL & vton_supported = 0
const invalidVton51to100 = products.slice(50).filter(p => p.vton_supported !== 0 || p.garment_image !== null);
if (invalidVton51to100.length > 0) {
  errors.push(`Products 51-100 invalid VTON: ${invalidVton51to100.map(p => `#${p.id}`).join(', ')}`);
} else {
  passedChecks++;
  console.log('✓ Products 51–100: Exactly 50 accessories have garment_image = NULL & vton_supported = 0.');
}

console.log('----------------------------------------------------');
if (errors.length > 0) {
  console.error('❌ VERIFICATION FAILED with errors:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log(`✅ ALL ${passedChecks} AUDIT CHECKS PASSED PERFECTLY!`);
  process.exit(0);
}
