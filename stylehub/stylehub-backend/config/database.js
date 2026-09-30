import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'stylehub.sqlite');

// Centralized SQLite connection singleton
const db = new Database(DB_PATH);

// Always enforce foreign keys
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/**
 * Initializes database tables, indexes, and optional minimal test seed
 */
export function initDatabase() {
  // Ensure foreign keys are active
  db.pragma('foreign_keys = ON');

  // Schema creation within a single transaction
  const createSchema = db.transaction(() => {
    // 1. users
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER', 'ADMIN')),
        phone TEXT,
        age INTEGER,
        address TEXT,
        city TEXT,
        state TEXT,
        pincode TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. products
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
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

    // 3. cart (one active cart per user)
    db.exec(`
      CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. cart_items (no duplicate product for same cart)
    db.exec(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id INTEGER NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cart_id, product_id)
      );
    `);

    // 5. wishlists (one main wishlist per user)
    db.exec(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. wishlist_items (no duplicate products in same wishlist)
    db.exec(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(wishlist_id, product_id)
      );
    `);

    // 7. friendships
    db.exec(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK(requester_id != receiver_id),
        UNIQUE(requester_id, receiver_id)
      );
    `);

    // 8. wishlist_shares
    db.exec(`
      CREATE TABLE IF NOT EXISTS wishlist_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE,
        share_type TEXT DEFAULT 'PRODUCTS',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wishlist_share_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL REFERENCES wishlist_shares(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(share_id, product_id)
      );
    `);

    // 9. wishlist_feedback
    db.exec(`
      CREATE TABLE IF NOT EXISTS wishlist_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL REFERENCES wishlist_shares(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction TEXT CHECK(reaction IN ('LIKE', 'LOVE', 'FIRE') OR reaction IS NULL),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. orders
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'PLACED' CHECK(status IN ('PLACED', 'CONFIRMED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
        subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
        discount_total REAL NOT NULL DEFAULT 0 CHECK(discount_total >= 0),
        shipping_fee REAL NOT NULL DEFAULT 0 CHECK(shipping_fee >= 0),
        other_charges REAL NOT NULL DEFAULT 0 CHECK(other_charges >= 0),
        total_amount REAL NOT NULL DEFAULT 0 CHECK(total_amount >= 0),
        delivery_address TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATETIME,
        cancelled_at DATETIME
      );
    `);

    // 11. order_items
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_image TEXT,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
        final_price REAL NOT NULL CHECK(final_price >= 0)
      );
    `);

    // 12. outfit_recommendations
    db.exec(`
      CREATE TABLE IF NOT EXISTS outfit_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        recommended_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        slot_type TEXT NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 13. notifications
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_id INTEGER,
        is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 14. try_on_results
    db.exec(`
      CREATE TABLE IF NOT EXISTS try_on_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_image_path TEXT NOT NULL,
        garment_image_path TEXT NOT NULL,
        generated_image_path TEXT,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK(status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 15. purchases (Simple Purchase Flow without delivery tracking)
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchase_type TEXT NOT NULL CHECK(purchase_type IN ('SINGLE', 'COMBO')),
        total_amount REAL NOT NULL CHECK(total_amount >= 0),
        delivery_name TEXT NOT NULL,
        delivery_phone TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_city TEXT NOT NULL,
        delivery_state TEXT NOT NULL,
        delivery_pincode TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- 16. recently_accessed (Phase 10)
      CREATE TABLE IF NOT EXISTS recently_accessed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      );
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK(channel IN ('EMAIL', 'SMS', 'WHATSAPP')),
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'NOT_CONFIGURED', 'DISABLED')),
        recipient TEXT,
        provider_message_id TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes requested
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);
      CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
      CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
      CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships(requester_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_receiver_id ON friendships(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_try_on_results_user_id ON try_on_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
      CREATE INDEX IF NOT EXISTS idx_recently_accessed_user_date ON recently_accessed(user_id, accessed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notif_deliveries_purchase ON notification_deliveries(purchase_id);
      CREATE INDEX IF NOT EXISTS idx_notif_deliveries_user ON notification_deliveries(user_id);
    `);
  });

  createSchema();

  // Ensure users has role and Google OAuth columns (migrations)
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!userCols.includes('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';");
    }
    if (!userCols.includes('google_id')) {
      db.exec("ALTER TABLE users ADD COLUMN google_id TEXT;");
    }
    if (!userCols.includes('avatar_url')) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
    }
    if (!userCols.includes('email_notifications')) {
      db.exec("ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1;");
    }
    if (!userCols.includes('sms_notifications')) {
      db.exec("ALTER TABLE users ADD COLUMN sms_notifications INTEGER NOT NULL DEFAULT 1;");
    }
    if (!userCols.includes('whatsapp_notifications')) {
      db.exec("ALTER TABLE users ADD COLUMN whatsapp_notifications INTEGER NOT NULL DEFAULT 1;");
    }
    if (!userCols.includes('theme_preference')) {
      db.exec("ALTER TABLE users ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'gold-silver';");
    }
    if (!userCols.includes('language_preference')) {
      db.exec("ALTER TABLE users ADD COLUMN language_preference TEXT NOT NULL DEFAULT 'en';");
    }
  } catch (e) {
    // Already present or handled
  }

  // Ensure outfit_recommendations has combination_signature column
  try {
    const outfitCols = db.prepare('PRAGMA table_info(outfit_recommendations)').all().map(c => c.name);
    if (!outfitCols.includes('combination_signature')) {
      db.exec('ALTER TABLE outfit_recommendations ADD COLUMN combination_signature TEXT;');
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_outfit_recs_signature ON outfit_recommendations(combination_signature);
      CREATE INDEX IF NOT EXISTS idx_outfit_recs_base ON outfit_recommendations(base_product_id);
    `);
  } catch (e) {
    // Already present or handled
  }

  // Ensure notifications has related_id column
  try {
    const notifCols = db.prepare('PRAGMA table_info(notifications)').all().map(c => c.name);
    if (!notifCols.includes('related_id')) {
      db.exec('ALTER TABLE notifications ADD COLUMN related_id INTEGER;');
    }
  } catch (e) {
    // Already present or handled
  }

  // Run minimal test seed (only if empty)
  seedInitialData();

  return db;
}

/**
 * Minimal test seed (2 users, 3 products) to verify relationships.
 * Obvious temporary test markers included.
 */
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, full_name, email, password_hash, phone, age, city, state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'alex_turner',
      'Alex Turner',
      'alex.turner@aksmenstyle.internal',
      '$2b$10$temporaryTestHashForUser1Phase2VerificationOnly',
      '9876543210',
      28,
      'New York',
      'NY'
    );

    insertUser.run(
      'marcus_vance',
      'Marcus Vance',
      'marcus.vance@aksmenstyle.internal',
      '$2b$10$temporaryTestHashForUser2Phase2VerificationOnly',
      '9876543211',
      32,
      'London',
      'UK'
    );
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        name, description, brand, category, cloth_type, color,
        price, original_price, discount_percent, stock, status,
        vton_supported, vton_garment_category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProduct.run(
      'Minimalist Oxford Cotton Shirt',
      'Crisp tailored cotton shirt for modern essentials.',
      'AK Signature',
      'Shirts',
      'Top',
      'White',
      499.00,
      599.00,
      16.7,
      8,
      'IN_STOCK',
      1,
      'tops'
    );

    insertProduct.run(
      'Structured Relaxed Chino',
      'Minimal tailored relaxed-fit chino trousers.',
      'AK Urban',
      'Pants',
      'Bottom',
      'Navy',
      649.00,
      700.00,
      7.3,
      5,
      'IN_STOCK',
      1,
      'bottoms'
    );

    insertProduct.run(
      'Matte Steel Chrono Watch',
      'Precision matte minimalist wrist watch with mesh band.',
      'StyleHub Hardware',
      'Accessories',
      'Watch',
      'Matte Black',
      350.00,
      450.00,
      22.2,
      10,
      'IN_STOCK',
      0,
      null
    );
  }
}

/**
 * Health check helper for database connection
 */
export function checkDatabaseHealth() {
  try {
    const result = db.prepare('SELECT 1 AS alive').get();
    return result && result.alive === 1 ? 'connected' : 'disconnected';
  } catch (error) {
    return 'disconnected';
  }
}

export default db;
