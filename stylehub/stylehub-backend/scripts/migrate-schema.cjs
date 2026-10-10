const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

console.log('--- STARTING SAFE SCHEMA AND CATALOG MIGRATION ---');

db.exec('PRAGMA foreign_keys = OFF;');

// 1. Migrate products table to remove stock <= 10 constraint and enforce price between 400 and 700
console.log('1. Migrating products table schema...');
db.exec(`
  CREATE TABLE products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    category TEXT NOT NULL,
    cloth_type TEXT,
    color TEXT,
    price REAL NOT NULL CHECK(price <= 700 AND price >= 400),
    original_price REAL NOT NULL CHECK(original_price >= price),
    discount_percent REAL DEFAULT 0 CHECK(discount_percent >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(status IN ('IN_STOCK', 'SOLD_OUT')),
    image TEXT,
    garment_image TEXT,
    vton_supported INTEGER DEFAULT 0 CHECK(vton_supported IN (0, 1)),
    vton_garment_category TEXT CHECK(vton_garment_category IN ('tops', 'bottoms') OR vton_garment_category IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Deterministic selling price generator strictly between 400 and 700
function getNormalizedSellingPrice(id, currentPrice) {
  const pricePalette = [
    420, 450, 479, 499, 520, 549, 570, 599, 620, 649, 670, 699, 459, 489, 519, 539, 569, 589, 619, 639, 659, 689
  ];
  const index = (id * 13 + Math.round(currentPrice || 500)) % pricePalette.length;
  return pricePalette[index];
}

function getNormalizedDiscount(id) {
  const pattern = [20, 30, 0, 40, 20, 0, 30, 40, 0, 30, 20, 40];
  return pattern[id % pattern.length];
}

function getNormalizedStock(id) {
  return 10 + ((id * 7 + 4) % 11); // 10..20 inclusive
}

const oldProducts = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
console.log(`Copying and normalizing ${oldProducts.length} products...`);

const insertProdStmt = db.prepare(`
  INSERT INTO products_new (
    id, name, description, brand, category, cloth_type, color,
    price, original_price, discount_percent, stock, status,
    image, garment_image, vton_supported, vton_garment_category,
    created_at, updated_at
  ) VALUES (
    @id, @name, @description, @brand, @category, @cloth_type, @color,
    @price, @original_price, @discount_percent, @stock, @status,
    @image, @garment_image, @vton_supported, @vton_garment_category,
    @created_at, @updated_at
  )
`);

for (const p of oldProducts) {
  const finalPrice = getNormalizedSellingPrice(p.id, p.price);
  const discount = getNormalizedDiscount(p.id);
  const originalPrice = discount === 0 ? finalPrice : Math.round(finalPrice / (1 - discount / 100));
  const stock = getNormalizedStock(p.id);

  insertProdStmt.run({
    id: p.id,
    name: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    cloth_type: p.cloth_type,
    color: p.color,
    price: finalPrice,
    original_price: originalPrice,
    discount_percent: discount,
    stock: stock,
    status: 'IN_STOCK',
    image: p.image,
    garment_image: p.garment_image,
    vton_supported: p.vton_supported,
    vton_garment_category: p.vton_garment_category,
    created_at: p.created_at,
    updated_at: p.updated_at
  });
}

db.exec(`
  DROP TABLE products;
  ALTER TABLE products_new RENAME TO products;
`);
console.log('✓ Products table schema migrated and normalized successfully.');

// 2. Migrate wishlist_shares to include share_type and drop UNIQUE(wishlist_id, receiver_id)
console.log('2. Migrating wishlist_shares table schema...');
db.exec(`
  CREATE TABLE wishlist_shares_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE,
    share_type TEXT DEFAULT 'PRODUCTS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const oldShares = db.prepare('SELECT * FROM wishlist_shares').all();
const insertShareStmt = db.prepare(`
  INSERT INTO wishlist_shares_new (id, sender_id, receiver_id, wishlist_id, share_type, created_at)
  VALUES (@id, @sender_id, @receiver_id, @wishlist_id, 'PRODUCTS', @created_at)
`);
for (const s of oldShares) {
  insertShareStmt.run(s);
}

db.exec(`
  DROP TABLE wishlist_shares;
  ALTER TABLE wishlist_shares_new RENAME TO wishlist_shares;
`);
console.log('✓ wishlist_shares table migrated successfully.');

db.exec('PRAGMA foreign_keys = ON;');
console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
