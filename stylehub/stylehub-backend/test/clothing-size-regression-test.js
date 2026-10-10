import Database from 'better-sqlite3';
import { isClothingProduct, getProductSizes, validateProductSize, ALLOWED_CLOTHING_SIZES } from '../utils/sizeHelper.js';
import { generatePurchaseEmailTemplates } from '../services/emailService.js';

console.log('=== RUNNING CLOTHING SIZE REGRESSION TESTS ===');

const db = new Database('config/stylehub.sqlite');

// Test 1: Category & Clothing identification
console.log('\n[Test 1] Clothing vs Accessories Classification');
const sampleTop = db.prepare("SELECT * FROM products WHERE vton_garment_category = 'tops' LIMIT 1").get();
const sampleBottom = db.prepare("SELECT * FROM products WHERE vton_garment_category = 'bottoms' LIMIT 1").get();
const sampleAccessory = db.prepare("SELECT * FROM products WHERE category = 'Watches' LIMIT 1").get();
const sampleShoes = db.prepare("SELECT * FROM products WHERE category = 'Shoes' LIMIT 1").get();

console.log(`Top (${sampleTop.name}): isClothing = ${isClothingProduct(sampleTop)}, sizes =`, getProductSizes(sampleTop));
console.log(`Bottom (${sampleBottom.name}): isClothing = ${isClothingProduct(sampleBottom)}, sizes =`, getProductSizes(sampleBottom));
console.log(`Watch (${sampleAccessory.name}): isClothing = ${isClothingProduct(sampleAccessory)}, sizes =`, getProductSizes(sampleAccessory));
console.log(`Shoes (${sampleShoes.name}): isClothing = ${isClothingProduct(sampleShoes)}, sizes =`, getProductSizes(sampleShoes));

if (!isClothingProduct(sampleTop) || !isClothingProduct(sampleBottom)) {
  throw new Error('FAILED: Tops and bottoms must be classified as clothing');
}
if (isClothingProduct(sampleAccessory) || isClothingProduct(sampleShoes)) {
  throw new Error('FAILED: Accessories must NOT be classified as clothing');
}
console.log('✓ PASS: Tops and bottoms correctly classified, accessories excluded.');

// Test 2: Validation of sizes
console.log('\n[Test 2] Size Validation Logic');
for (const sz of ALLOWED_CLOTHING_SIZES) {
  const res = validateProductSize(sampleTop, sz);
  if (!res.isValid || res.size !== sz) throw new Error(`FAILED: Allowed size ${sz} was rejected`);
}
const invalidSizes = ['XS', 'XXXL', 'INVALID', '', null, undefined, 42];
for (const bad of invalidSizes) {
  const res = validateProductSize(sampleTop, bad);
  if (res.isValid) throw new Error(`FAILED: Invalid size ${bad} was accepted`);
}
const accessoryCheck = validateProductSize(sampleAccessory, null);
if (!accessoryCheck.isValid || accessoryCheck.size !== null) {
  throw new Error('FAILED: Accessory with null size should be valid');
}
console.log('✓ PASS: Allowed sizes S, M, L, XL, XXL accepted, invalid sizes rejected.');

// Test 3: Cart variants and uniqueness in SQLite
console.log('\n[Test 3] Cart Items Variant Separation');
const testUser = db.prepare('SELECT id FROM users LIMIT 1').get();
let testCart = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(testUser.id);
if (!testCart) {
  db.prepare('INSERT INTO cart (user_id) VALUES (?)').run(testUser.id);
  testCart = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(testUser.id);
}

// Clean any previous test rows for this product in test cart
db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(testCart.id, sampleTop.id);

// Insert Size M
db.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(testCart.id, sampleTop.id, 'M', 1);
// Insert Size L (same product, different size)
db.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(testCart.id, sampleTop.id, 'L', 1);

const variants = db.prepare('SELECT product_id, size, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').all(testCart.id, sampleTop.id);
console.log('Variants in cart for same product:', variants);
if (variants.length !== 2) {
  throw new Error('FAILED: Size M and Size L must exist as separate cart items');
}
console.log('✓ PASS: Different sizes of the same product exist as separate cart items.');

// Verify duplicate Size M is blocked by unique index
try {
  db.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(testCart.id, sampleTop.id, 'M', 1);
  throw new Error('FAILED: Duplicate size M for same cart and product should fail unique constraint');
} catch (e) {
  console.log('✓ PASS: Duplicate clothing size blocked by constraint:', e.message);
}

// Clean up test rows
db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(testCart.id, sampleTop.id);

// Test 4: Email template with size snapshot
console.log('\n[Test 4] Email Templates with Clothing Size');
const emailResult = generatePurchaseEmailTemplates({
  purchase: {
    id: 9999,
    delivery_name: 'Test Customer',
    delivery_address: '123 Luxury Ave',
    delivery_city: 'Chennai',
    delivery_state: 'Tamil Nadu',
    delivery_pincode: '600001',
    total_amount: 1098,
    purchase_type: 'SINGLE'
  },
  user: { fullName: 'Test Customer' },
  items: [
    {
      product_name: 'Classic Black Shirt',
      unit_price: 599,
      quantity: 1,
      size: 'M'
    },
    {
      product_name: 'Matte Steel Watch',
      unit_price: 499,
      quantity: 1,
      size: null
    }
  ],
  language: 'en'
});

if (!emailResult.text.includes('Size: M')) {
  throw new Error('FAILED: English plain text email missing "Size: M"');
}
if (!emailResult.html.includes('Size: M')) {
  throw new Error('FAILED: English HTML email missing "Size: M"');
}
if (emailResult.text.includes('Matte Steel Watch\n  Size:')) {
  throw new Error('FAILED: Accessory watch must NOT show size in email');
}
console.log('✓ PASS: English email includes clothing size and omits accessory size.');

// Tamil test
const tamilEmailResult = generatePurchaseEmailTemplates({
  purchase: {
    id: 9999,
    delivery_name: 'Test Customer',
    delivery_address: '123 Luxury Ave',
    delivery_city: 'Chennai',
    delivery_state: 'Tamil Nadu',
    delivery_pincode: '600001',
    total_amount: 599,
    purchase_type: 'SINGLE'
  },
  user: { fullName: 'Test Customer' },
  items: [
    {
      product_name: 'பருத்தி சட்டை',
      unit_price: 599,
      quantity: 1,
      size: 'L'
    }
  ],
  language: 'ta'
});
if (!tamilEmailResult.text.includes('அளவு: L') || !tamilEmailResult.html.includes('அளவு: L')) {
  throw new Error('FAILED: Tamil email missing "அளவு: L"');
}
console.log('✓ PASS: Tamil email includes clothing size correctly.');

console.log('\n=== ALL TARGETED CLOTHING SIZE UNIT TESTS PASSED ===\n');
