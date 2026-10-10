import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPublic = path.join(__dirname, '../../stylehub-frontend/public');
const backendPublic = path.join(__dirname, '../public');

console.log('--- AK\'s MEN STYLE — Image Asset & VTON Separation Validation ---');

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

const products = db.prepare('SELECT id, name, category, color, image, garment_image, vton_supported FROM products ORDER BY id ASC').all();

assert(products.length === 100, `Found 100 products in database for image validation`);

// 1. All 100 display photos exist on disk
const allDisplayImagesExist = products.every(p => {
  const fePath = path.join(frontendPublic, p.image);
  return fs.existsSync(fePath) && fs.statSync(fePath).size > 0;
});
assert(allDisplayImagesExist, '1. All 100 normal product display photos exist and have non-zero size on disk');

// 2. Garment image exists for clothing IDs 1-50
const clothingProducts = products.filter(p => p.id <= 50);
const allGarmentsExist = clothingProducts.every(p => {
  if (!p.garment_image) return false;
  const fePath = path.join(frontendPublic, p.garment_image);
  return fs.existsSync(fePath) && fs.statSync(fePath).size > 0;
});
assert(allGarmentsExist, '2. Dedicated garment_image exists for all 50 clothing products (IDs 1–50)');

// 3. Garment image is strictly NULL for accessories (IDs 51-100)
const accessoriesProducts = products.filter(p => p.id >= 51);
const allAccessoriesGarmentNull = accessoriesProducts.every(p => p.garment_image === null);
assert(allAccessoriesGarmentNull, '3. All 50 accessories have garment_image = NULL');

// 4. Image paths are properly formatted
const validImagePaths = products.every(p => p.image === `/images/products/product_${p.id}.png`);
assert(validImagePaths, '4. All product image paths follow canonical format /images/products/product_{id}.png');

// 5. Garment image paths are properly formatted
const validGarmentPaths = clothingProducts.every(p => p.garment_image === `/images/garments/product_${p.id}.png`);
assert(validGarmentPaths, '5. All garment image paths follow canonical format /images/garments/product_{id}.png');

// 6. Two separate image purposes verified
const imagesAreDistinct = clothingProducts.every(p => p.image !== p.garment_image);
assert(imagesAreDistinct, '6. Product display image and VTON garment image point to distinct locations');

// 7. No duplicate image mappings
const displayImageSet = new Set(products.map(p => p.image));
assert(displayImageSet.size === 100, '7. Zero duplicate display image paths (100 unique image URLs)');

// 8. No broken paths across frontend and backend public dirs
const noBrokenPaths = products.every(p => {
  const feDisplay = path.join(frontendPublic, p.image);
  const beDisplay = path.join(backendPublic, p.image);
  return fs.existsSync(feDisplay) && fs.existsSync(beDisplay);
});
assert(noBrokenPaths, '8. No broken paths across both frontend and backend static asset directories');

console.log(`\nImage Validation Complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
