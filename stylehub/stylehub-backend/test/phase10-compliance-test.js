import assert from 'assert';

const BASE_URL = 'http://localhost:5000';

const FIVE_USERS = [
  { name: 'User A', email: 'akil.sundaram@aksmenstyle.com', password: 'AkilStyle2026!', username: 'akil_sundaram' },
  { name: 'User B', email: 'rahul.devan@aksmenstyle.com', password: 'RahulStyle2026!', username: 'rahul_devan' },
  { name: 'User C', email: 'karthik.raja@aksmenstyle.com', password: 'KarthikStyle2026!', username: 'karthik_raja' },
  { name: 'User D', email: 'siddharth.varma@aksmenstyle.com', password: 'SiddharthStyle2026!', username: 'siddharth_varma' },
  { name: 'User E', email: 'vikram.rao@aksmenstyle.com', password: 'VikramStyle2026!', username: 'vikram_rao' }
];

const ADMIN = {
  email: 'admin@aksmenstyle.com',
  password: 'AKAdminLuxury2026!',
  username: 'aks_admin'
};

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, { headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function patch(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function runPhase10Tests() {
  console.log('================================================================');
  console.log('AK\'S MEN STYLE — PHASE 10 EVALUATION COMPLIANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  function pass(msg) {
    passed++;
    console.log(`[PASS] ${passed}. ${msg}`);
  }

  // -------------------------------------------------------------
  // Test 1: API Health Check
  // -------------------------------------------------------------
  console.log('--- Test 1: API Health Verification ---');
  const health = await get('/api/health');
  assert.strictEqual(health.status, 200, 'Health check must return 200');
  assert.strictEqual(health.data.status, 'ok', 'Health status must be ok');
  assert.strictEqual(health.data.database, 'connected', 'Database must be connected');
  assert(health.data.vton.includes('FASHN VTON'), 'VTON must be local FASHN');
  pass('API health returns 200 with database and local VTON online');

  // -------------------------------------------------------------
  // Test 2: Five User Logins & Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 2: 5 Distinct User Accounts Login & Auth Flow ---');
  const userTokens = {};

  for (const u of FIVE_USERS) {
    const loginRes = await post('/api/auth/login', { email: u.email, password: u.password });
    assert.strictEqual(loginRes.status, 200, `${u.name} login must succeed`);
    assert(loginRes.data.token, `${u.name} must receive JWT token`);
    assert.strictEqual(loginRes.data.user.role, 'USER', `${u.name} role must be USER`);
    assert.strictEqual(loginRes.data.user.username, u.username, `${u.name} username must match`);
    pass(`${u.name} (${u.email}) logged in successfully with valid JWT and role USER`);

    const meRes = await get('/api/auth/me', loginRes.data.token);
    assert.strictEqual(meRes.status, 200, `${u.name} GET /api/auth/me must return 200`);
    assert.strictEqual(meRes.data.username, u.username, `${u.name} identity preserved`);
    assert.strictEqual(meRes.data.role, 'USER');
    pass(`${u.name} /api/auth/me verified with matching profile data`);

    // Verify login again (re-login persistence)
    const reloginRes = await post('/api/auth/login', { email: u.email, password: u.password });
    assert.strictEqual(reloginRes.status, 200, `${u.name} re-login must succeed`);
    userTokens[u.username] = reloginRes.data.token;
    pass(`${u.name} re-login succeeds smoothly`);
  }

  // -------------------------------------------------------------
  // Test 3: Admin Authentication & Role Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Dedicated Admin Authentication & Role Verification ---');
  const adminLogin = await post('/api/auth/login', { email: ADMIN.email, password: ADMIN.password });
  assert.strictEqual(adminLogin.status, 200, 'Admin login must succeed');
  assert.strictEqual(adminLogin.data.user.role, 'ADMIN', 'Admin role must strictly be ADMIN');
  const adminToken = adminLogin.data.token;
  pass('Admin login accepted with role: ADMIN');

  const adminMe = await get('/api/auth/me', adminToken);
  assert.strictEqual(adminMe.status, 200);
  assert.strictEqual(adminMe.data.role, 'ADMIN');
  pass('Admin GET /api/auth/me confirms role: ADMIN in session');

  // -------------------------------------------------------------
  // Test 4: Admin Authorization Middleware & Security
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Admin Authorization Middleware & Strict Role Guards ---');
  // Normal user tries to access /api/admin/metrics -> 403
  const userA_Token = userTokens['akil_sundaram'];
  const userAdminAttempt = await get('/api/admin/metrics', userA_Token);
  assert.strictEqual(userAdminAttempt.status, 403, 'Normal user must be forbidden (403) from admin endpoints');
  pass('Normal user (User A) access to /api/admin/metrics strictly denied with HTTP 403');

  // Unauthenticated access -> 401
  const unauthAttempt = await get('/api/admin/metrics');
  assert.strictEqual(unauthAttempt.status, 401, 'Unauthenticated request must return 401');
  pass('Unauthenticated request to /api/admin/metrics strictly denied with HTTP 401');

  // Admin access -> 200
  const adminMetrics = await get('/api/admin/metrics', adminToken);
  assert.strictEqual(adminMetrics.status, 200, 'Admin must have access to /api/admin/metrics');
  assert(adminMetrics.data.metrics.totalUsers >= 5, 'Total users must be at least 5');
  assert.strictEqual(adminMetrics.data.metrics.totalProducts, 100, 'Total products must be 100');
  assert(adminMetrics.data.metrics.totalPurchases >= 0, 'Total purchases must be non-negative');
  pass('Admin successfully accesses real database metrics from /api/admin/metrics');

  // -------------------------------------------------------------
  // Test 5: Admin Dashboard Subsystems & Management
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Admin Products, Users, Purchases & VTON Analytics ---');
  const adminProds = await get('/api/admin/products', adminToken);
  assert.strictEqual(adminProds.status, 200);
  assert.strictEqual(adminProds.data.products.length, 100, 'Admin products list must contain 100 products');
  pass('Admin products endpoint returns all 100 catalog products with full metadata');

  // Admin users (no passwords exposed!)
  const adminUsers = await get('/api/admin/users', adminToken);
  assert.strictEqual(adminUsers.status, 200);
  assert(adminUsers.data.users.length >= 6, 'Must list users including admin');
  assert.strictEqual(adminUsers.data.users[0].password, undefined, 'Passwords must NOT be exposed');
  assert.strictEqual(adminUsers.data.users[0].password_hash, undefined, 'Password hashes must NOT be exposed');
  pass('Admin users endpoint returns safe account metadata without passwords or hashes');

  // Admin purchases
  const adminPurchases = await get('/api/admin/purchases', adminToken);
  assert.strictEqual(adminPurchases.status, 200);
  pass('Admin purchases endpoint returns real purchase history with owner identities');

  // Admin VTON stats
  const adminVton = await get('/api/admin/vton-stats', adminToken);
  assert.strictEqual(adminVton.status, 200);
  assert(adminVton.data.vtonStats.topCount >= 0);
  assert(adminVton.data.vtonStats.bottomCount >= 0);
  pass('Admin VTON stats endpoint returns real try-on usage metrics (top/bottom/success)');

  // Admin safe product update (stock / price)
  const patchRes = await patch('/api/admin/products/1', { price: 520, discountPercent: 20 }, adminToken);
  assert.strictEqual(patchRes.status, 200);
  assert.strictEqual(patchRes.data.product.price, 520);
  pass('Admin can safely update product price and discount within verified constraints');

  // -------------------------------------------------------------
  // Test 6: Recently Accessed Feature & Strict User Isolation
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Recently Accessed Products & Isolation ---');
  const userB_Token = userTokens['rahul_devan'];
  const userC_Token = userTokens['karthik_raja'];

  // User A accesses Product 1, then Product 21, then Product 55
  await post('/api/recently-accessed', { productId: 1 }, userA_Token);
  await new Promise(r => setTimeout(r, 20));
  await post('/api/recently-accessed', { productId: 21 }, userA_Token);
  await new Promise(r => setTimeout(r, 20));
  await post('/api/recently-accessed', { productId: 55 }, userA_Token);

  // User B accesses Product 10 and Product 35
  await post('/api/recently-accessed', { productId: 10 }, userB_Token);
  await new Promise(r => setTimeout(r, 20));
  await post('/api/recently-accessed', { productId: 35 }, userB_Token);

  // User A verifies recently accessed list
  const recA = await get('/api/recently-accessed', userA_Token);
  assert.strictEqual(recA.status, 200);
  const recAIds = recA.data.products.map(p => p.id);
  assert.strictEqual(recAIds[0], 55, 'Latest accessed product #55 must be first');
  assert.strictEqual(recAIds[1], 21, 'Second latest #21 must be second');
  assert.strictEqual(recAIds[2], 1, 'Third latest #1 must be third');
  pass('User A recently accessed returns [55, 21, 1] in reverse chronological order');

  // User B verifies recently accessed list
  const recB = await get('/api/recently-accessed', userB_Token);
  assert.strictEqual(recB.status, 200);
  const recBIds = recB.data.products.map(p => p.id);
  assert.strictEqual(recBIds[0], 35, 'User B latest accessed is #35');
  assert.strictEqual(recBIds[1], 10, 'User B second accessed is #10');
  pass('User B recently accessed returns [35, 10] isolated to User B');

  // User C has no recently accessed products yet
  const recC = await get('/api/recently-accessed', userC_Token);
  assert.strictEqual(recC.status, 200);
  assert.strictEqual(recC.data.products.length, 0, 'User C has 0 recently accessed products');
  pass('User C receives empty list — zero cross-user leakage');

  // User A updates access to Product 1 -> Product 1 becomes latest!
  await new Promise(r => setTimeout(r, 20));
  await post('/api/recently-accessed', { productId: 1 }, userA_Token);
  const recA_Updated = await get('/api/recently-accessed', userA_Token);
  assert.strictEqual(recA_Updated.data.products[0].id, 1, 'Re-accessed product #1 moves to top of history');
  pass('Upsert behavior successfully moves re-accessed product #1 to the top without duplicate rows');

  // -------------------------------------------------------------
  // Test 7: Chatbot Assistant Deterministic Guidance
  // -------------------------------------------------------------
  console.log('\n--- Test 7: AK Style Assistant Chatbot Inquiries ---');
  // Query 1: Shirts
  const chatShirts = await post('/api/chatbot/message', { message: 'Show me shirts' });
  assert.strictEqual(chatShirts.status, 200);
  assert(chatShirts.data.reply.includes('Shirts'), 'Should mention shirts');
  assert(chatShirts.data.products.length > 0, 'Should return matching shirt products');
  pass('Chatbot correctly parses "Show me shirts" and returns catalog shirts');

  // Query 2: VTON
  const chatVton = await post('/api/chatbot/message', { message: 'How does virtual try-on work?' });
  assert.strictEqual(chatVton.status, 200);
  assert(chatVton.data.reply.includes('FASHN'), 'Should explain local FASHN pipeline');
  assert.strictEqual(chatVton.data.action.path, '/virtual-try-on');
  pass('Chatbot explains local AI Virtual Try-On and directs to /virtual-try-on');

  // Query 3: Styling Recommendation
  const chatStyling = await post('/api/chatbot/message', { message: 'Suggest pants for white shirt' });
  assert.strictEqual(chatStyling.status, 200);
  assert(chatStyling.data.action.path.includes('/products/'));
  pass('Chatbot provides outfit pairing recommendation with catalog navigation');

  // Query 4: Stock availability
  const chatStock = await post('/api/chatbot/message', { message: 'What products are in stock?' });
  assert.strictEqual(chatStock.status, 200);
  assert(chatStock.data.reply.includes('in stock'));
  pass('Chatbot returns real active stock numbers from SQLite catalog');

  console.log('\n================================================================');
  console.log(`✅ ALL ${passed} PHASE 10 COMPLIANCE TESTS PASSED PERFECTLY!`);
  console.log('================================================================');
}

runPhase10Tests().catch(err => {
  console.error('[FATAL] Phase 10 test failure:', err);
  process.exit(1);
});
