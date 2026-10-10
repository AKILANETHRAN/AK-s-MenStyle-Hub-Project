const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

console.log('--- NORMALIZING AK\'S MEN STYLE CATALOG ---');

const allowedDiscounts = [0, 20, 30, 40];

// Deterministic selling price generator strictly between 400 and 700
function getNormalizedSellingPrice(id, currentPrice) {
  // Candidate price points between 400 and 700
  const pricePalette = [
    420, 450, 479, 499, 520, 549, 570, 599, 620, 649, 670, 699, 459, 489, 519, 539, 569, 589, 619, 639, 659, 689
  ];
  // Map based on existing price ranking / id to maintain relative tier
  const index = (id * 13 + Math.round(currentPrice || 500)) % pricePalette.length;
  const price = pricePalette[index];
  if (price < 400 || price > 700) {
    throw new Error(`Generated price ${price} outside ₹400-₹700 range!`);
  }
  return price;
}

// Deterministic discount generator: 0, 20, 30, 40
function getNormalizedDiscount(id) {
  // Deterministic variety across the 4 allowed values
  const pattern = [20, 30, 0, 40, 20, 0, 30, 40, 0, 30, 20, 40];
  return pattern[id % pattern.length];
}

// Deterministic stock generator strictly between 10 and 20
function getNormalizedStock(id) {
  return 10 + ((id * 7 + 4) % 11); // 10..20 inclusive
}

const products = db.prepare('SELECT id, name, price, original_price, discount_percent, stock FROM products ORDER BY id ASC').all();

console.log(`Found ${products.length} products to normalize.`);

const updateStmt = db.prepare(`
  UPDATE products
  SET price = @price,
      original_price = @original_price,
      discount_percent = @discount_percent,
      stock = @stock,
      status = 'IN_STOCK',
      updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
`);

const normalizeTx = db.transaction(() => {
  for (const p of products) {
    const finalSellingPrice = getNormalizedSellingPrice(p.id, p.price);
    const discount = getNormalizedDiscount(p.id);
    let originalPrice;
    if (discount === 0) {
      originalPrice = finalSellingPrice;
    } else {
      originalPrice = Math.round(finalSellingPrice / (1 - discount / 100));
    }
    const initialStock = getNormalizedStock(p.id);

    updateStmt.run({
      id: p.id,
      price: finalSellingPrice,
      original_price: originalPrice,
      discount_percent: discount,
      stock: initialStock
    });
  }
});

normalizeTx();

console.log('✓ Successfully normalized all 100 products!');
