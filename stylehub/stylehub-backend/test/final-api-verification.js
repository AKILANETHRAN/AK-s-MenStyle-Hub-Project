/**
 * AK'S MEN STYLE — COMPLETE E2E HTTP INTEGRATION TEST
 * Tests against live backend at http://localhost:5000:
 * 1. Register new user with no username
 * 2. Login -> returns user with username: null
 * 3. Username availability check endpoint GET /api/auth/check-username
 * 4. Manual username save via PUT /api/auth/username
 * 5. GET /api/auth/me -> confirms username is saved
 * 6. Case-insensitive uniqueness rejection for existing username
 * 7. Friends search by @username (using peer user token)
 * 8. Add product to cart -> check cart subtotal and reward calculation
 * 9. Add more products to cross ₹1,000 threshold -> 10% reward
 * 10. Purchase cart -> database saves subtotal, reward percentage, and final total
 */

const BASE_URL = 'http://localhost:5000';

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
  console.log('FINAL HTTP INTEGRATION VERIFICATION');
  console.log('====================================================\n');

  // Step 1: Register new user (username is null)
  console.log('Step 1: Register new user with no username');
  const testEmail = `akil.test.${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Akil Test User',
      email: testEmail,
      password: 'Password123!',
      phone: '9876543210',
      address: '123 Luxury Way',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001'
    })
  });
  const regData = await regRes.json();
  assert(regRes.status === 201, 'User registration succeeded (201)');
  assert(regData.user.username === null, 'Registered user username is strictly NULL');
  const token = regData.token;

  // Step 2: Login
  console.log('\nStep 2: Login');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!'
    })
  });
  const loginData = await loginRes.json();
  assert(loginRes.status === 200, 'User login succeeded (200)');
  assert(loginData.user.username === null, 'Login response confirms username is NULL (triggers redirect to /profile)');

  // Step 3: Check username availability
  console.log('\nStep 3: Real-time username availability check');
  const chosenName = `Akil_${Date.now() % 100000}`;
  const checkRes = await fetch(`${BASE_URL}/api/auth/check-username?username=${chosenName}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const checkData = await checkRes.json();
  assert(checkRes.status === 200, 'Availability check succeeded (200)');
  assert(checkData.available === true, `Username "${chosenName}" is available`);
  assert(checkData.message === 'Username available.', 'Returns exact message "Username available."');

  // Step 4: Save manual username via PUT /api/auth/username
  console.log('\nStep 4: Save manual username via PUT /api/auth/username');
  const setRes = await fetch(`${BASE_URL}/api/auth/username`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ username: chosenName })
  });
  const setData = await setRes.json();
  assert(setRes.status === 200, 'Username save succeeded (200)');
  assert(setData.user.username === chosenName, `Saved username is "${chosenName}" without leading @`);

  // Step 5: Verify with GET /api/auth/me
  console.log('\nStep 5: Verify persistence via GET /api/auth/me');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  assert(meData.username === chosenName, `GET /api/auth/me confirms persistent username "${chosenName}"`);

  // Step 6: Case-insensitive uniqueness check
  console.log('\nStep 6: Case-insensitive uniqueness validation');
  const dupCheckRes = await fetch(`${BASE_URL}/api/auth/check-username?username=${chosenName.toUpperCase()}`);
  const dupCheckData = await dupCheckRes.json();
  assert(dupCheckData.available === false, 'Uppercase variant is reported as unavailable');
  assert(dupCheckData.message === 'Username already exists.', 'Returns exact message "Username already exists."');

  // Step 7: Friends search with @username (using peer user token)
  console.log('\nStep 7: Friends search with @username');
  const peerRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Peer Friend',
      email: `peer.${Date.now()}@example.com`,
      password: 'Password123!'
    })
  });
  const peerData = await peerRegRes.json();
  const peerToken = peerData.token;

  const friendSearchRes = await fetch(`${BASE_URL}/api/friends/search?username=@${chosenName}`, {
    headers: { Authorization: `Bearer ${peerToken}` }
  });
  const friendSearchData = await friendSearchRes.json();
  assert(friendSearchRes.status === 200, 'Friends search succeeded (200)');
  const found = (friendSearchData.users || []).some(u => u.username.toLowerCase() === chosenName.toLowerCase());
  assert(found, `Friends search query "@${chosenName}" successfully found user`);

  // Step 8: Cart - Add products & Buy More Save More Tier calculation
  console.log('\nStep 8: Cart Reward calculation with real catalog items');
  // Clear cart first
  await fetch(`${BASE_URL}/api/cart`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  // Get active in-stock products
  const prodsRes = await fetch(`${BASE_URL}/api/products`);
  const prodsData = await prodsRes.json();
  const allProducts = Array.isArray(prodsData) ? prodsData : prodsData.products || [];
  const products = allProducts.filter(p => p.stock >= 5);
  assert(products.length >= 2, 'Loaded catalog products with active stock');
  const p1 = products[0];

  // Add 1 item
  await fetch(`${BASE_URL}/api/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId: p1.id, quantity: 1 })
  });

  const cartRes1 = await fetch(`${BASE_URL}/api/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const cartJson1 = await cartRes1.json();
  const cart1 = cartJson1.data || cartJson1.cart;
  assert(cart1.subtotal === p1.price, `Cart subtotal matches Product #${p1.id} price (₹${p1.price})`);
  assert(cart1.cartReward.percentage === (p1.price >= 1000 ? 10 : 0), 'Cart reward tier calculated dynamically');

  // Add enough to cross ₹1,000 threshold (e.g. quantity 2 or 3)
  const neededQty = Math.ceil(1000 / p1.price);
  await fetch(`${BASE_URL}/api/cart/items/${p1.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quantity: neededQty })
  });

  const cartRes2 = await fetch(`${BASE_URL}/api/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const cartJson2 = await cartRes2.json();
  const cart2 = cartJson2.data || cartJson2.cart;
  const subtotal2 = p1.price * neededQty;
  assert(cart2.subtotal === subtotal2, `Cart subtotal is ₹${subtotal2} (>= ₹1,000)`);
  assert(cart2.cartReward.percentage === 10, 'Cart reward is 10% OFF UNLOCKED');
  assert(cart2.cartReward.rewardAmount === Math.round(subtotal2 * 0.1 * 100) / 100, `Reward amount is 10% of subtotal`);

  // Step 9: Purchase Cart
  console.log('\nStep 9: Purchase Cart & Price Integrity');
  const purchaseRes = await fetch(`${BASE_URL}/api/purchases/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      // Send manipulated claims to test server authority
      claimedRewardPercentage: 30,
      claimedRewardAmount: 500,
      claimedFinalTotal: 100
    })
  });
  const purchaseData = await purchaseRes.json();
  assert(purchaseRes.status === 201, 'Cart purchase succeeded (201)');
  assert(purchaseData.purchase.subtotal === subtotal2, 'Purchase subtotal calculated authoritatively from DB');
  assert(purchaseData.purchase.cart_reward_percent === 10, 'Server enforced 10% reward, ignoring client manipulation');
  assert(purchaseData.purchase.total_amount === cart2.cartReward.finalTotal, 'Final total correctly reflects subtotal - 10% reward');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
