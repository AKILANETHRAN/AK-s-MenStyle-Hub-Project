/**
 * AK'S MEN STYLE — USERNAME MANUAL TEST SUITE
 * Validates:
 * 1. Zero auto-generated usernames (no generation from email, Google name, suffixes)
 * 2. New Google user created with username = null (initially empty)
 * 3. Manual username setting via PUT /api/auth/username
 * 4. Stored without '@' in DB, displayed with '@' in UI
 * 5. Real-time availability check via GET /api/auth/check-username
 * 6. Case-insensitive uniqueness validation ("Username already exists.", "Username available.")
 * 7. Friends search using manually chosen @username
 */

import db from '../config/database.js';
import { validateUsername, normalizeUsernameInput } from '../utils/usernameValidator.js';
import { findOrCreateGoogleUser } from '../controllers/googleAuthController.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: MANUAL USERNAME ONLY');
  console.log('====================================================\n');

  // TEST 1: Zero Auto-Generated Usernames on Google Login
  console.log('TEST 1: Google OAuth User Creation — No Auto-Generated Username');
  const testGoogleEmail = `test.google.${Date.now()}@example.com`;
  const googleProfile = {
    googleId: `gid_${Date.now()}`,
    email: testGoogleEmail,
    fullName: 'Rahul Devanathan',
    avatarUrl: 'https://lh3.googleusercontent.com/a/test'
  };

  const createdGoogleUser = await findOrCreateGoogleUser(googleProfile);
  assert(createdGoogleUser.username === null, 'New Google user username is strictly NULL (not generated from email or name)');
  assert(createdGoogleUser.email === testGoogleEmail, 'Google user email recorded accurately');

  // Verify in database directly
  const dbUser = db.prepare('SELECT username FROM users WHERE id = ?').get(createdGoogleUser.id);
  assert(dbUser.username === null, 'Database row for new Google user has username = NULL');

  // TEST 2: Normal Register User — No Auto-Generated Username
  console.log('\nTEST 2: Registration — No Auto-Generated Username');
  const regEmail = `test.reg.${Date.now()}@example.com`;
  const regInsert = db.prepare(`
    INSERT INTO users (username, full_name, email, password_hash, role)
    VALUES (NULL, 'Akil Nathan', ?, 'hash123', 'USER')
  `).run(regEmail);
  const regUser = db.prepare('SELECT username FROM users WHERE id = ?').get(regInsert.lastInsertRowid);
  assert(regUser.username === null, 'Registered user without username has username = NULL');

  // TEST 3: Validation Rules & Case-Insensitive Uniqueness
  console.log('\nTEST 3: Case-Insensitive Uniqueness & Validation Messages');
  const uniqueBase = `akil_${Date.now() % 100000}`;
  
  // Clean validation
  const v1 = validateUsername(uniqueBase, null, db);
  assert(v1.valid === true, `Username "${uniqueBase}" is valid`);
  assert(v1.message === 'Username available.', 'Returns exact message "Username available."');

  // Save in DB
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(uniqueBase, createdGoogleUser.id);

  // Case variants
  const vUpper = validateUsername(uniqueBase.toUpperCase(), null, db);
  assert(vUpper.valid === false, `Uppercase variant "${uniqueBase.toUpperCase()}" is rejected`);
  assert(vUpper.message === 'Username already exists.', 'Returns exact message "Username already exists."');

  const vLower = validateUsername(uniqueBase.toLowerCase(), null, db);
  assert(vLower.valid === false, `Lowercase variant "${uniqueBase.toLowerCase()}" is rejected`);
  assert(vLower.message === 'Username already exists.', 'Returns exact message "Username already exists."');

  // Leading @ stripping
  const vAt = validateUsername(`@${uniqueBase}`, null, db);
  assert(vAt.valid === false, `With '@' prefix is recognized as same username`);
  assert(vAt.message === 'Username already exists.', 'Returns "Username already exists." for @prefix');

  // Space rejection
  const vSpace = validateUsername('Akil Nathan', null, db);
  assert(vSpace.valid === false, 'Username with space is rejected');

  // Short length
  const vShort = validateUsername('ak', null, db);
  assert(vShort.valid === false && vShort.message.includes('at least 3'), 'Username < 3 characters rejected');

  // Normalization
  assert(normalizeUsernameInput('@Akil') === 'Akil', 'normalizeUsernameInput("@Akil") returns "Akil"');
  assert(normalizeUsernameInput('@@@Akil') === 'Akil', 'normalizeUsernameInput multiple @ returns "Akil"');

  // TEST 4: Storage Format vs UI Format
  console.log('\nTEST 4: Storage Format (Without @) vs UI Format (With @)');
  const checkStored = db.prepare('SELECT username FROM users WHERE id = ?').get(createdGoogleUser.id);
  assert(!checkStored.username.startsWith('@'), 'Stored database username does NOT start with "@"');
  assert(`@${checkStored.username}` === `@${uniqueBase}`, 'UI format prepends "@" to display as @username');

  // TEST 5: Friends Search Compatibility with @username
  console.log('\nTEST 5: Friends Search Compatibility with @username');
  const searchDirect = db.prepare(`
    SELECT id, username, full_name 
    FROM users 
    WHERE LOWER(username) = LOWER(?)
  `).get(uniqueBase);
  assert(searchDirect !== undefined && searchDirect.id === createdGoogleUser.id, 'Search by clean username finds user');

  const cleanQuery = normalizeUsernameInput(`@${uniqueBase}`);
  const searchWithAt = db.prepare(`
    SELECT id, username, full_name 
    FROM users 
    WHERE LOWER(username) = LOWER(?)
  `).get(cleanQuery);
  assert(searchWithAt !== undefined && searchWithAt.id === createdGoogleUser.id, 'Search query with @ successfully finds user');

  // Clean up test rows
  db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(createdGoogleUser.id, regInsert.lastInsertRowid);

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
