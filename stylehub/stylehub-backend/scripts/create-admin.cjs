const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

async function createAdmin() {
  console.log('=== AK\'S MEN STYLE — SECURE ADMIN INITIALIZATION ===');

  // Read credentials from environment variables
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('[ERROR] Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variable.');
    console.error('Usage: ADMIN_EMAIL="admin@aksmenstyle.com" ADMIN_PASSWORD="your_secure_password" node scripts/create-admin.cjs');
    process.exit(1);
  }

  // Ensure role column exists in users table
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    if (!userCols.includes('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';");
      console.log('✓ Added role column to users table.');
    }
  } catch (e) {
    console.error('Schema check notice:', e.message);
  }

  // Check if admin with this email already exists
  const existingUser = db.prepare('SELECT id, username, email, role FROM users WHERE LOWER(email) = ?').get(adminEmail);

  if (existingUser) {
    if (existingUser.role === 'ADMIN') {
      console.log(`[INFO] Administrator with email "${adminEmail}" already exists with role ADMIN (User ID: ${existingUser.id}). Refusing duplicate creation.`);
      process.exit(0);
    } else {
      // Elevate existing user to ADMIN safely
      db.prepare('UPDATE users SET role = \'ADMIN\', updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existingUser.id);
      console.log(`✓ Existing user "${existingUser.username}" (${adminEmail}) elevated to ADMIN role.`);
      process.exit(0);
    }
  }

  // Check if any ADMIN exists
  const existingAdminCount = db.prepare('SELECT COUNT(*) AS count FROM users WHERE role = \'ADMIN\'').get().count;
  if (existingAdminCount > 0) {
    console.log(`[INFO] An administrator already exists in the system (Total ADMINs: ${existingAdminCount}).`);
  }

  // Hash password using bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const baseUsername = 'aks_admin';
  let adminUsername = baseUsername;
  let counter = 1;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)) {
    adminUsername = `${baseUsername}_${counter++}`;
  }

  const insertStmt = db.prepare(`
    INSERT INTO users (
      username, full_name, email, password_hash, role,
      phone, age, address, city, state, pincode
    ) VALUES (?, ?, ?, ?, 'ADMIN', ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    adminUsername,
    'AK System Administrator',
    adminEmail,
    passwordHash,
    '+91-9876500000',
    35,
    'AK Headquarters, Luxury Arcade',
    'Chennai',
    'Tamil Nadu',
    '600001'
  );

  console.log(`✅ Administrator created successfully!`);
  console.log(`   User ID:  ${result.lastInsertRowid}`);
  console.log(`   Username: ${adminUsername}`);
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Role:     ADMIN`);
  console.log('====================================================');
}

createAdmin().catch(err => {
  console.error('[FATAL] Failed to create admin:', err);
  process.exit(1);
});
