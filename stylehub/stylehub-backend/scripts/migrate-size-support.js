import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../config/stylehub.sqlite');

export function runSizeMigration(db = null) {
  const database = db || new Database(dbPath);

  // Turn foreign keys off during table restructuring
  database.pragma('foreign_keys = OFF');

  const migrate = database.transaction(() => {
    // 1. purchase_items: add size column if not present
    const purchaseItemCols = database.prepare('PRAGMA table_info(purchase_items)').all().map(c => c.name);
    if (!purchaseItemCols.includes('size')) {
      database.exec("ALTER TABLE purchase_items ADD COLUMN size TEXT CHECK(size IN ('S', 'M', 'L', 'XL', 'XXL') OR size IS NULL);");
      console.log('[Migration] Added size column to purchase_items');
    }

    // 2. order_items: add size column if not present
    const orderItemCols = database.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
    if (!orderItemCols.includes('size')) {
      database.exec("ALTER TABLE order_items ADD COLUMN size TEXT CHECK(size IN ('S', 'M', 'L', 'XL', 'XXL') OR size IS NULL);");
      console.log('[Migration] Added size column to order_items');
    }

    // 3. cart_items: update schema to support size and variant uniqueness (cart_id, product_id, size)
    const cartItemCols = database.prepare('PRAGMA table_info(cart_items)').all().map(c => c.name);
    const cartItemsSql = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cart_items'").get()?.sql || '';

    // If cart_items does not have size OR still has UNIQUE(cart_id, product_id)
    if (!cartItemCols.includes('size') || cartItemsSql.includes('UNIQUE(cart_id, product_id)')) {
      console.log('[Migration] Migrating cart_items table for multi-size variant support...');

      database.exec(`
        CREATE TABLE IF NOT EXISTS cart_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cart_id INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          size TEXT CHECK(size IN ('S', 'M', 'L', 'XL', 'XXL') OR size IS NULL),
          quantity INTEGER NOT NULL CHECK(quantity > 0),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Copy existing rows
      if (cartItemCols.includes('size')) {
        database.exec(`
          INSERT INTO cart_items_new (id, cart_id, product_id, size, quantity, created_at, updated_at)
          SELECT id, cart_id, product_id, size, quantity, created_at, updated_at FROM cart_items;
        `);
      } else {
        database.exec(`
          INSERT INTO cart_items_new (id, cart_id, product_id, size, quantity, created_at, updated_at)
          SELECT id, cart_id, product_id, NULL, quantity, created_at, updated_at FROM cart_items;
        `);
      }

      database.exec(`
        DROP TABLE cart_items;
        ALTER TABLE cart_items_new RENAME TO cart_items;
        CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_clothing ON cart_items(cart_id, product_id, size) WHERE size IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_accessory ON cart_items(cart_id, product_id) WHERE size IS NULL;
      `);

      console.log('[Migration] cart_items table successfully migrated with partial unique indexes.');
    } else {
      // Ensure the unique partial indexes exist
      database.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_clothing ON cart_items(cart_id, product_id, size) WHERE size IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_accessory ON cart_items(cart_id, product_id) WHERE size IS NULL;
      `);
    }
  });

  try {
    migrate();
    console.log('[Migration] Size support database migration completed successfully.');
  } finally {
    database.pragma('foreign_keys = ON');
  }
}

// Run directly if invoked from CLI
if (process.argv[1] && process.argv[1].endsWith('migrate-size-support.js')) {
  runSizeMigration();
}
