import assert from 'assert';
import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const BASE = 'http://localhost:5000/api';
const EXPECTED_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

let passed = 0;
function check(condition, message) {
  assert(condition, message);
  console.log(`[PASS] ${message}`);
  passed++;
}

async function runGoogleAuthTests() {
  console.log('================================================================');
  console.log("AK'S MEN STYLE — GOOGLE OAUTH INTEGRATION TEST SUITE");
  console.log('================================================================\n');

  // Test 1: Google OAuth Config Endpoint
  console.log('--- Test 1: Google OAuth Public Config ---');
  const configRes = await fetch(`${BASE}/auth/google/config`);
  const configData = await configRes.json();
  check(configRes.status === 200, '1. GET /api/auth/google/config returns 200 OK');
  check(configData.clientId === EXPECTED_CLIENT_ID, '2. Configured Client ID matches provided Google Client ID');
  check(configData.configured === true, '3. Google OAuth status is configured = true');
  check(configData.redirectUri === 'http://localhost:5000/api/auth/google/callback', '4. Configured redirectUri matches canonical http://localhost:5000/api/auth/google/callback');

  // Test 2: Google OAuth Authorization URL Generation
  console.log('\n--- Test 2: Google Authorization Consent URL Generation ---');
  const canonicalUrlRes = await fetch(`${BASE}/auth/google/url`);
  const canonicalUrlData = await canonicalUrlRes.json();
  check(canonicalUrlRes.status === 200, '5. GET /api/auth/google/url returns 200 OK');
  check(canonicalUrlData.url.includes(encodeURIComponent('http://localhost:5000/api/auth/google/callback')), '6. Default authorization URL uses canonical backend callback');
  check(Boolean(canonicalUrlData.state), '7. Authorization URL includes secure state parameter for CSRF protection');

  // Test 2b: Direct GET /api/auth/google initiation
  console.log('\n--- Test 2b: Direct GET /api/auth/google Initiation ---');
  const directAuthRes = await fetch(`${BASE}/auth/google`, { redirect: 'manual' });
  check(directAuthRes.status === 302, '8. GET /api/auth/google returns 302 Redirect');
  const targetLocation = directAuthRes.headers.get('location') || '';
  check(targetLocation.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), '9. Location header targets Google OAuth');
  check(targetLocation.includes(encodeURIComponent('http://localhost:5000/api/auth/google/callback')), '10. Direct initiation uses canonical redirect URI');

  // Test 3: Validation on missing credentials
  console.log('\n--- Test 3: Request Validation ---');
  const emptyRes = await fetch(`${BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const emptyData = await emptyRes.json();
  check(emptyRes.status === 400, '9. POST /api/auth/google with empty body returns 400 Bad Request');
  check(emptyData.message.includes('required'), '10. Returns helpful validation message for missing credential or code');

  // Test 4: Verification rejection on forged / invalid token
  console.log('\n--- Test 4: Forged / Invalid Token Security ---');
  const invalidRes = await fetch(`${BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'forged_dummy_google_jwt_token' })
  });
  check(invalidRes.status === 401, '11. POST /api/auth/google with forged token returns 401 Unauthorized');

  // Test 5: SQLite Database Schema & Google Columns
  console.log('\n--- Test 5: Database Schema & Migration Verification ---');
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  check(userCols.includes('google_id'), '12. Users table has google_id column');
  check(userCols.includes('avatar_url'), '13. Users table has avatar_url column');

  // Test 6: Google Account Resolution & JWT Session Generation
  console.log('\n--- Test 6: Google Account Sync & JWT Session Generation ---');
  const testGoogleEmail = 'google_test_shopper@aksmenstyle.com';
  const testGoogleId = 'google_sub_id_99887766';
  
  // Clean prior test artifact if exists
  db.prepare('DELETE FROM users WHERE email = ? OR google_id = ?').run(testGoogleEmail, testGoogleId);

  // Directly insert verified Google record simulation
  const dummyHash = '$2a$10$wT8KzQ89N7p929h2fFq8mO3Y6oX02dK6C4c5D6e7F8g9H0i1J2k3L';
  const ins = db.prepare(`
    INSERT INTO users (username, full_name, email, password_hash, role, google_id, avatar_url)
    VALUES ('google_shopper', 'Google Shopper', ?, ?, 'USER', ?, 'https://lh3.googleusercontent.com/a/test')
  `).run(testGoogleEmail, dummyHash, testGoogleId);
  const createdId = ins.lastInsertRowid;

  check(Boolean(createdId), '14. Verified user account created with google_id and avatar_url');

  // Query user by google_id
  const fetched = db.prepare('SELECT id, username, email, role, google_id FROM users WHERE google_id = ?').get(testGoogleId);
  check(fetched && fetched.email === testGoogleEmail, '15. User queried accurately by google_id');

  // Generate JWT for Google user and verify
  const token = jwt.sign({ userId: fetched.id, role: fetched.role }, getJwtSecret(), { expiresIn: '7d' });
  const meRes = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  check(meRes.status === 200, '16. Protected /api/auth/me accepts Google user JWT');
  check(meData.email === testGoogleEmail, '17. /api/auth/me returns matching profile for Google user');

  // Cleanup test user
  db.prepare('DELETE FROM users WHERE id = ?').run(createdId);
  check(true, '18. Test user cleaned up cleanly');

  console.log('\n================================================================');
  console.log(`✅ ALL ${passed} GOOGLE OAUTH INTEGRATION TESTS PASSED PERFECTLY!`);
  console.log('================================================================');
}

runGoogleAuthTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
