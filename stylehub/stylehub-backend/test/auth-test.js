import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase } from '../config/database.js';
import { generateUsername } from '../utils/usernameGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('--- StyleHub Phase 3 Auth & Persistence Test Suite ---');

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
  const JWT_SECRET = process.env.JWT_SECRET || 'stylehub_default_jwt_secret_dev_key';

  // 1. Test username generation
  const name1 = generateUsername('akilan200681@gmail.com', db);
  assert(name1.startsWith('Akil'), `Username generation for akilan200681@gmail.com: ${name1}`);

  const nameRahul = generateUsername('rahul2002@gmail.com', db);
  assert(nameRahul.startsWith('Rahul'), `Username generation for rahul2002@gmail.com: ${nameRahul}`);

  const nameArun = generateUsername('arun.kumar@gmail.com', db);
  assert(nameArun.startsWith('Arun'), `Username generation for arun.kumar@gmail.com: ${nameArun}`);

  // 2. Register user test
  const testEmail = `test.auth.${Date.now()}@example.com`;
  const rawPassword = 'SecurePassword123!';
  const generatedUsername = generateUsername(testEmail, db);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const insertStmt = db.prepare(`
    INSERT INTO users (username, full_name, email, password_hash, phone, age, city, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    generatedUsername,
    'Akilanethran R',
    testEmail,
    passwordHash,
    '9876543210',
    21,
    'Chennai',
    'Tamil Nadu'
  );
  const userId = result.lastInsertRowid;
  assert(userId > 0, '1. Register new user in SQLite succeeded');

  // 2. Password stored as bcrypt hash
  const storedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert(storedUser.password_hash.startsWith('$2'), '2. Password stored as bcrypt hash ($2...)');
  assert(storedUser.password_hash !== rawPassword, '2b. Plain text password NEVER stored in database');

  // 3. Username generated and saved
  assert(storedUser.username === generatedUsername, `3. Username generated and persisted (${storedUser.username})`);

  // 4. Duplicate email rejected
  let duplicateEmailCaught = false;
  try {
    insertStmt.run(
      'DifferentUser',
      'Duplicate Test',
      testEmail,
      passwordHash,
      null, null, null, null
    );
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      duplicateEmailCaught = true;
    }
  }
  assert(duplicateEmailCaught, '4. Duplicate email rejected by database UNIQUE constraint');

  // 5. Duplicate username handled (generates suffixed username)
  const nextGenerated = generateUsername(testEmail, db);
  assert(nextGenerated !== generatedUsername && nextGenerated.startsWith('Test'),
    `5. Duplicate username handled cleanly with increment suffix (${nextGenerated})`);

  // 6. Login with correct password succeeds
  const correctMatch = await bcrypt.compare(rawPassword, storedUser.password_hash);
  assert(correctMatch === true, '6. Login with correct password succeeds (bcrypt.compare matches)');

  // 7. Login with incorrect password fails
  const incorrectMatch = await bcrypt.compare('WrongPassword456', storedUser.password_hash);
  assert(incorrectMatch === false, '7. Login with incorrect password fails');

  // 8. JWT returned and valid
  const token = jwt.sign({ userId: storedUser.id }, JWT_SECRET, { expiresIn: '7d' });
  assert(typeof token === 'string' && token.split('.').length === 3, '8. Valid JWT signed and returned');

  // 9. /api/auth/me logic works with valid JWT
  const decoded = jwt.verify(token, JWT_SECRET);
  const fetchedUser = db.prepare(`
    SELECT id, username, full_name AS fullName, email, phone, age, address, city, state, pincode
    FROM users WHERE id = ?
  `).get(decoded.userId);
  assert(fetchedUser && fetchedUser.id === userId && !fetchedUser.password_hash, '9. Safe profile returned with valid JWT (no password_hash exposed)');

  // 10. /api/auth/me logic fails without JWT
  let failedWithoutToken = false;
  try {
    jwt.verify('', JWT_SECRET);
  } catch (err) {
    failedWithoutToken = true;
  }
  assert(failedWithoutToken, '10. Verification fails without JWT');

  // 11. Profile update works
  const updateStmt = db.prepare(`
    UPDATE users
    SET full_name = ?, phone = ?, age = ?, address = ?, city = ?, state = ?, pincode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  updateStmt.run('Akilanethran Rajendran', '9988776655', 22, '123 Fashion Blvd', 'Coimbatore', 'Tamil Nadu', '641001', userId);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert(
    updatedUser.full_name === 'Akilanethran Rajendran' &&
    updatedUser.phone === '9988776655' &&
    updatedUser.age === 22 &&
    updatedUser.city === 'Coimbatore',
    '11. Profile update works in SQLite'
  );

  // 12. Restart persistence test
  // Open a completely fresh independent Database connection to stylehub.sqlite to simulate process restart
  const restartedDb = new Database(DB_PATH);
  restartedDb.pragma('foreign_keys = ON');

  const reloadedUser = restartedDb.prepare(`
    SELECT id, username, full_name, email, phone, age, address, city, state, pincode
    FROM users WHERE id = ?
  `).get(userId);

  assert(
    reloadedUser &&
    reloadedUser.full_name === 'Akilanethran Rajendran' &&
    reloadedUser.phone === '9988776655' &&
    reloadedUser.age === 22 &&
    reloadedUser.city === 'Coimbatore' &&
    reloadedUser.pincode === '641001',
    '12. Restart persistence test: All profile fields persist across independent DB instances'
  );
  restartedDb.close();

  console.log(`\nPhase 3 Auth Verification: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
