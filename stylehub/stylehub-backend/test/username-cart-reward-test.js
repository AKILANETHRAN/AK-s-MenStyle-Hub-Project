import assert from 'assert';
import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getJwtSecret } from '../config/jwt.js';
import { validateUsername, normalizeUsernameInput } from '../utils/usernameValidator.js';
import { calculateCartReward, CART_REWARD_TIERS } from '../services/cartRewardService.js';
import { findOrCreateGoogleUser } from '../controllers/googleAuthController.js';

const BASE = 'http://localhost:5000/api';
let passed = 0;
let total = 0;

function check(condition, message) {
  total++;
  assert(condition, message);
  console.log(`[PASS] ${message}`);
  passed++;
}

async function runAllTests() {
  console.log('================================================================');
  console.log("AK'S MEN STYLE — USERNAME ONBOARDING & BUY MORE SAVE MORE SUITE");
  console.log('================================================================\n');

  // ==========================================================================
  // PART A: USERNAME VALIDATION & ONBOARDING
  // ==========================================================================
  console.log('--- 1. Username Validator Unit Tests ---');
  
  // Normalization
  check(normalizeUsernameInput('  @Akil_Dev  ') === 'Akil_Dev', '1.1 normalizeUsernameInput trims and removes leading @');
  check(normalizeUsernameInput('Akil') === 'Akil', '1.2 normalizeUsernameInput preserves valid username');
  check(normalizeUsernameInput('@@@Akil') === 'Akil', '1.3 normalizeUsernameInput handles multiple leading @');

  // Validation rules
  const emptyVal = validateUsername('', null, db);
  check(!emptyVal.valid && emptyVal.message.includes('required'), '1.4 Empty username rejected');

  const shortVal = validateUsername('Ak', null, db);
  check(!shortVal.valid && shortVal.message.includes('at least 3 characters'), '1.5 Short username (<3) rejected');

  const longVal = validateUsername('A'.repeat(35), null, db);
  check(!longVal.valid && longVal.message.includes('cannot exceed 30 characters'), '1.6 Long username (>30) rejected');

  const spaceVal = validateUsername('Akil Dev', null, db);
  check(!spaceVal.valid && spaceVal.message.includes('cannot contain spaces'), '1.7 Username with spaces rejected');

  const specialVal = validateUsername('Akil@123!', null, db);
  check(!specialVal.valid, '1.8 Username with illegal special characters rejected');

  const validVal = validateUsername('Rahul_Dev', null, db);
  check(validVal.valid && validVal.cleanUsername === 'Rahul_Dev', '1.9 Valid alphanumeric + underscore accepted (Rahul_Dev)');

  // ==========================================================================
  // PART A.2: REGISTRATION WITHOUT AUTO-GENERATED USERNAME
  // ==========================================================================
  console.log('\n--- 2. Registration Without Auto-Generated Username ---');
  const uniqueEmail = `test.onboard.${Date.now()}@example.com`;
  
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'New Onboarding User',
      email: uniqueEmail,
      password: 'SecurePassword123!',
      phone: '9988776655',
      address: '123 Luxury Avenue',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001'
    })
  });
  const regData = await regRes.json();
  check(regRes.status === 201, '2.1 Registration succeeds without username provided');
  check(regData.user.username === null, '2.2 Username is NULL (not auto-generated from email)');
  const newUserId = regData.user.id;
  const newUserToken = regData.token;

  // Verify in SQLite database
  const dbUser = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(newUserId);
  check(dbUser.username === null, '2.3 SQLite user record confirms username is NULL');

  // ==========================================================================
  // PART A.3: USERNAME ONBOARDING & CASE-INSENSITIVE UNIQUENESS
  // ==========================================================================
  console.log('\n--- 3. Username Availability & Onboarding Endpoints ---');

  const targetUsername = `TestAkil_${Date.now().toString().slice(-4)}`;

  // 3.1 Check availability
  const checkAvailRes1 = await fetch(`${BASE}/auth/check-username?username=${targetUsername}`);
  const checkAvailData1 = await checkAvailRes1.json();
  check(checkAvailRes1.status === 200 && checkAvailData1.available === true, `3.1 Username ${targetUsername} is available`);

  // 3.2 Update username for newly registered user
  const setUsernameRes = await fetch(`${BASE}/auth/username`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newUserToken}`
    },
    body: JSON.stringify({ username: targetUsername })
  });
  const setUsernameData = await setUsernameRes.json();
  check(setUsernameRes.status === 200, '3.2 PUT /api/auth/username succeeds');
  check(setUsernameData.user.username === targetUsername, `3.3 Returned user profile shows username = ${targetUsername}`);

  // 3.4 Check SQLite persistence
  const updatedDbUser = db.prepare('SELECT username FROM users WHERE id = ?').get(newUserId);
  check(updatedDbUser.username === targetUsername, '3.4 SQLite confirms username saved without @ symbol');

  // 3.5 Check case-insensitive uniqueness check: lowercase version MUST be reported unavailable
  const checkAvailRes2 = await fetch(`${BASE}/auth/check-username?username=${targetUsername.toLowerCase()}`);
  const checkAvailData2 = await checkAvailRes2.json();
  check(checkAvailData2.available === false, `3.5 Case-insensitive check: lowercase '${targetUsername.toLowerCase()}' is UNAVAILABLE`);

  // 3.6 Another user attempting to claim taken username (different case) must be rejected
  const user2Email = `test.user2.${Date.now()}@example.com`;
  const regUser2 = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Second User',
      email: user2Email,
      password: 'Password123!'
    })
  });
  const user2Data = await regUser2.json();
  const user2Token = user2Data.token;

  const duplicateAttempt = await fetch(`${BASE}/auth/username`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user2Token}`
    },
    body: JSON.stringify({ username: targetUsername.toUpperCase() })
  });
  const dupData = await duplicateAttempt.json();
  check(duplicateAttempt.status === 400, '3.6 Setting existing username in UPPERCASE rejected with 400');
  check(dupData.message.includes('already taken'), '3.7 Error message clearly states username is already taken');

  // 3.8 User2 chooses a unique username with leading @
  const user2ValidName = `Unique_${Date.now().toString().slice(-4)}`;
  const setWithAtRes = await fetch(`${BASE}/auth/username`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user2Token}`
    },
    body: JSON.stringify({ username: `@${user2ValidName}` })
  });
  const setWithAtData = await setWithAtRes.json();
  check(setWithAtRes.status === 200, '3.8 Setting username with leading @ succeeds');
  check(setWithAtData.user.username === user2ValidName, '3.9 Stored username stripped leading @ successfully');

  // ==========================================================================
  // PART A.4: GOOGLE USER ONBOARDING
  // ==========================================================================
  console.log('\n--- 4. Google User Username Onboarding ---');
  const googleFakeEmail = `google.newuser.${Date.now()}@example.com`;
  const googleNewUser = await findOrCreateGoogleUser({
    googleId: `google_id_${Date.now()}`,
    email: googleFakeEmail,
    fullName: 'Google Fresh User',
    avatarUrl: 'https://example.com/avatar.jpg'
  });
  check(googleNewUser.username === null, '4.1 Fresh Google OAuth user created with username: null');

  // Existing Google user retains username
  const googleChosenName = `Google_User_${Date.now().toString().slice(-4)}`;
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(googleChosenName, googleNewUser.id);
  const existingGoogle = await findOrCreateGoogleUser({
    googleId: googleNewUser.google_id || `google_id_${Date.now()}`,
    email: googleFakeEmail,
    fullName: 'Google Fresh User',
    avatarUrl: 'https://example.com/avatar.jpg'
  });
  check(existingGoogle.username === googleChosenName, '4.2 Returning Google user retains manually chosen username');

  // ==========================================================================
  // PART A.5: FRIENDS SEARCH COMPATIBILITY
  // ==========================================================================
  console.log('\n--- 5. Friends Username Search Compatibility ---');
  // Search with '@' prefix
  const searchWithAt = await fetch(`${BASE}/friends/search?q=@${targetUsername}`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  const searchWithAtData = await searchWithAt.json();
  check(searchWithAt.status === 200, '5.1 Friends search with leading @ returns 200 OK');
  check(
    searchWithAtData.users && searchWithAtData.users.some(u => u.username === targetUsername),
    `5.2 Friend search for '@${targetUsername}' successfully found '${targetUsername}'`
  );

  // Search case-insensitively without '@'
  const searchLower = await fetch(`${BASE}/friends/search?q=${targetUsername.toLowerCase()}`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  const searchLowerData = await searchLower.json();
  check(
    searchLowerData.users && searchLowerData.users.some(u => u.username === targetUsername),
    `5.3 Friend search for '${targetUsername.toLowerCase()}' successfully found '${targetUsername}'`
  );

  // Users with NULL username should not appear in search
  const nullSearch = await fetch(`${BASE}/friends/search?q=Fresh`, {
    headers: { 'Authorization': `Bearer ${user2Token}` }
  });
  const nullSearchData = await nullSearch.json();
  check(
    !nullSearchData.users || !nullSearchData.users.some(u => u.id === googleNewUser.id && !u.username),
    '5.4 Users with unset usernames (null) are excluded from public friends search'
  );

  // ==========================================================================
  // PART B: BUY MORE SAVE MORE TIER REWARD CALCULATIONS
  // ==========================================================================
  console.log('\n--- 6. Buy More Save More Calculation Tests ---');
  
  // Centralized Tier Config Verification
  const discountTiers = CART_REWARD_TIERS.filter(t => t.percentage > 0);
  check(discountTiers.length === 3, '6.1 Exactly 3 reward tiers (Tier 1, Tier 2, Tier 3) configured');
  check(discountTiers[0].minAmount === 1000 && discountTiers[0].percentage === 10, '6.2 Tier 1: ₹1,000 → 10%');
  check(discountTiers[1].minAmount === 2000 && discountTiers[1].percentage === 20, '6.3 Tier 2: ₹2,000 → 20%');
  check(discountTiers[2].minAmount === 3000 && discountTiers[2].percentage === 30, '6.4 Tier 3: ₹3,000 → 30% (Max)');

  // Test Tier 0: ₹0 - ₹999
  const t0_0 = calculateCartReward(0);
  check(t0_0.tier === 0 && t0_0.percentage === 0 && t0_0.rewardAmount === 0 && t0_0.amountToNextTier === 1000,
    '6.5 ₹0 → Tier 0 (0%), Add ₹1,000 for Tier 1');

  const t0_450 = calculateCartReward(450);
  check(t0_450.tier === 0 && t0_450.percentage === 0 && t0_450.amountToNextTier === 550 && t0_450.finalTotal === 450,
    '6.6 ₹450 → Tier 0 (0%), Add ₹550 for 10%');

  const t0_600 = calculateCartReward(600);
  check(t0_600.tier === 0 && t0_600.percentage === 0 && t0_600.amountToNextTier === 400 && t0_600.finalTotal === 600,
    '6.7 ₹600 → Tier 0 (0%), Add ₹400 for 10%');

  const t0_950 = calculateCartReward(950);
  check(t0_950.tier === 0 && t0_950.percentage === 0 && t0_950.amountToNextTier === 50 && t0_950.finalTotal === 950,
    '6.8 ₹950 → Tier 0 (0%), Add ₹50 for 10%');

  const t0_999 = calculateCartReward(999);
  check(t0_999.tier === 0 && t0_999.percentage === 0 && t0_999.amountToNextTier === 1,
    '6.9 Boundary ₹999 → Tier 0 (0%), Add ₹1 for Tier 1');

  // Test Tier 1: ₹1,000 - ₹1,999 (10%)
  const t1_1000 = calculateCartReward(1000);
  check(t1_1000.tier === 1 && t1_1000.percentage === 10 && t1_1000.rewardAmount === 100 && t1_1000.finalTotal === 900 && t1_1000.amountToNextTier === 1000,
    '6.10 Boundary ₹1,000 → Tier 1 Unlocked (10%), Reward: ₹100, Final: ₹900, Add ₹1,000 for Tier 2');

  const t1_1001 = calculateCartReward(1001);
  check(t1_1001.tier === 1 && t1_1001.percentage === 10 && t1_1001.amountToNextTier === 999,
    '6.11 Boundary ₹1,001 → Tier 1 (10%), Add ₹999 for Tier 2');

  const t1_1100 = calculateCartReward(1100);
  check(t1_1100.tier === 1 && t1_1100.percentage === 10 && t1_1100.rewardAmount === 110 && t1_1100.finalTotal === 990 && t1_1100.amountToNextTier === 900,
    '6.12 ₹1,100 → Tier 1 (10%), Reward: ₹110, Final: ₹990, Add ₹900 for Tier 2');

  const t1_1450 = calculateCartReward(1450);
  check(t1_1450.tier === 1 && t1_1450.percentage === 10 && t1_1450.rewardAmount === 145 && t1_1450.finalTotal === 1305 && t1_1450.amountToNextTier === 550,
    '6.13 ₹1,450 → Tier 1 (10%), Add ₹550 for Tier 2');

  const t1_1999 = calculateCartReward(1999);
  check(t1_1999.tier === 1 && t1_1999.percentage === 10 && t1_1999.amountToNextTier === 1,
    '6.14 Boundary ₹1,999 → Tier 1 (10%), Add ₹1 for Tier 2');

  // Test Tier 2: ₹2,000 - ₹2,999 (20%)
  const t2_2000 = calculateCartReward(2000);
  check(t2_2000.tier === 2 && t2_2000.percentage === 20 && t2_2000.rewardAmount === 400 && t2_2000.finalTotal === 1600 && t2_2000.amountToNextTier === 1000,
    '6.15 Boundary ₹2,000 → Tier 2 Unlocked (20%), Reward: ₹400, Final: ₹1,600, Add ₹1,000 for Tier 3');

  const t2_2001 = calculateCartReward(2001);
  check(t2_2001.tier === 2 && t2_2001.percentage === 20 && t2_2001.amountToNextTier === 999,
    '6.16 Boundary ₹2,001 → Tier 2 (20%), Add ₹999 for Tier 3');

  const t2_2200 = calculateCartReward(2200);
  check(t2_2200.tier === 2 && t2_2200.percentage === 20 && t2_2200.rewardAmount === 440 && t2_2200.finalTotal === 1760 && t2_2200.amountToNextTier === 800,
    '6.17 ₹2,200 → Tier 2 (20%), Reward: ₹440, Final: ₹1,760, Add ₹800 for Tier 3');

  const t2_2500 = calculateCartReward(2500);
  check(t2_2500.tier === 2 && t2_2500.percentage === 20 && t2_2500.rewardAmount === 500 && t2_2500.finalTotal === 2000 && t2_2500.amountToNextTier === 500,
    '6.18 ₹2,500 → Tier 2 (20%), Add ₹500 for Tier 3');

  const t2_2999 = calculateCartReward(2999);
  check(t2_2999.tier === 2 && t2_2999.percentage === 20 && t2_2999.amountToNextTier === 1,
    '6.19 Boundary ₹2,999 → Tier 2 (20%), Add ₹1 for Tier 3');

  // Test Tier 3: ₹3,000+ (30% MAX SAVING)
  const t3_3000 = calculateCartReward(3000);
  check(t3_3000.tier === 3 && t3_3000.percentage === 30 && t3_3000.rewardAmount === 900 && t3_3000.finalTotal === 2100 && t3_3000.amountToNextTier === 0,
    '6.20 Boundary ₹3,000 → Tier 3 Unlocked (30% MAX), Reward: ₹900, Final: ₹2,100, amountToNextTier: 0');

  const t3_3001 = calculateCartReward(3001);
  check(t3_3001.tier === 3 && t3_3001.percentage === 30 && t3_3001.amountToNextTier === 0,
    '6.21 Boundary ₹3,001 → Tier 3 (30% MAX), amountToNextTier: 0');

  const t3_5000 = calculateCartReward(5000);
  check(t3_5000.tier === 3 && t3_5000.percentage === 30 && t3_5000.rewardAmount === 1500 && t3_5000.finalTotal === 3500 && t3_5000.amountToNextTier === 0,
    '6.22 High amount ₹5,000 → Tier 3 (30% MAX), Reward: ₹1,500, Final: ₹3,500');

  // ==========================================================================
  // PART B.2: REAL-TIME CART API REWARD CALCULATIONS
  // ==========================================================================
  console.log('\n--- 7. Live Cart API Integration & Dynamic Recalculation ---');

  // Clean cart for test user
  const cartRow = db.prepare('SELECT id FROM cart WHERE user_id = ?').get(newUserId) 
    || { id: db.prepare('INSERT INTO cart (user_id) VALUES (?)').run(newUserId).lastInsertRowid };
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartRow.id);

  // Fetch real catalog products for testing
  const p1 = db.prepare('SELECT id, price, stock FROM products WHERE id = 1').get();
  const p2 = db.prepare('SELECT id, price, stock FROM products WHERE id = 2').get();
  const p3 = db.prepare('SELECT id, price, stock FROM products WHERE id = 3').get();

  // Add product 1 to cart
  const addRes1 = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newUserToken}`
    },
    body: JSON.stringify({ productId: p1.id, quantity: 1 })
  });
  const addData1 = await addRes1.json();
  const cart1 = addData1.data;
  check(addRes1.status === 200, '7.1 Adding product 1 to cart succeeds');
  check(Boolean(cart1 && cart1.cartReward), '7.2 Cart response includes cartReward object');
  check(cart1.subtotal === p1.price, `7.3 Cart subtotal reflects real product price (₹${p1.price})`);

  // Verify cart reward object structure
  const reward1 = cart1.cartReward;
  check('tier' in reward1 && 'percentage' in reward1 && 'rewardAmount' in reward1 && 'finalTotal' in reward1,
    '7.4 cartReward contains tier, percentage, rewardAmount, finalTotal');

  // Add more items to cross Tier 1 (₹1,000)
  await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newUserToken}` },
    body: JSON.stringify({ productId: p2.id, quantity: 2 })
  });
  const addRes3 = await fetch(`${BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newUserToken}` },
    body: JSON.stringify({ productId: p3.id, quantity: 2 })
  });
  const addData3 = await addRes3.json();
  const cart3 = addData3.data;
  const currentSubtotal = cart3.subtotal;
  check(currentSubtotal >= 1000, `7.5 Multi-item cart subtotal exceeds ₹1,000 (Subtotal: ₹${currentSubtotal})`);
  check(cart3.cartReward.tier >= 1, `7.6 Tier automatically unlocked live (Current Tier: ${cart3.cartReward.tier}, ${cart3.cartReward.percentage}%)`);
  check(cart3.cartReward.finalTotal < currentSubtotal, '7.7 Final total is strictly less than subtotal after reward');

  // ==========================================================================
  // PART B.3: CLIENT-SIDE PRICE MANIPULATION PROTECTION & CHECKOUT
  // ==========================================================================
  console.log('\n--- 8. Security & Price Manipulation Protection in Purchase Route ---');

  // Attempt purchase with forged client numbers
  const forgedCheckoutRes = await fetch(`${BASE}/purchases/cart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newUserToken}`
    },
    body: JSON.stringify({
      address: '123 Luxury Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
      // Attacker sends fake manipulated pricing
      subtotal: 50,
      rewardPercentage: 99,
      rewardAmount: 9999,
      finalTotal: 1
    })
  });

  const forgedData = await forgedCheckoutRes.json();
  check(forgedCheckoutRes.status === 201, '8.1 Cart checkout executes successfully');
  check(forgedData.purchase.totalAmount !== 1, '8.2 Attacker finalTotal of ₹1 was REJECTED');
  
  // Verify purchase was recorded with AUTHORITATIVE database calculation
  const recordedPurchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(forgedData.purchase.id);
  const expectedReward = calculateCartReward(currentSubtotal);
  check(recordedPurchase.cart_reward_percent === expectedReward.percentage,
    `8.3 Database recorded authoritative reward percent (${recordedPurchase.cart_reward_percent}%) not forged 99%`);
  check(recordedPurchase.total_amount === expectedReward.finalTotal,
    `8.4 Database recorded authoritative final amount (₹${recordedPurchase.total_amount}) not forged ₹1`);

  // Verify cart emptied after purchase
  const itemsAfterPurchase = db.prepare('SELECT COUNT(*) as c FROM cart_items WHERE cart_id = ?').get(cartRow.id).c;
  check(itemsAfterPurchase === 0, '8.5 Cart successfully emptied upon purchase completion');

  // ==========================================================================
  // PART B.4: CHATBOT DISCOUNT QUERY
  // ==========================================================================
  console.log('\n--- 9. Chatbot Buy More Save More Assistant ---');

  const botRes = await fetch(`${BASE}/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How do I get more discount?' })
  });
  const botData = await botRes.json();
  check(botRes.status === 200, '9.1 Chatbot endpoint returns 200 OK');
  check(botData.reply.includes('Buy More, Save More'), '9.2 Chatbot response explains "Buy More, Save More"');
  check(botData.reply.includes('1,000') && botData.reply.includes('10%'), '9.3 Chatbot mentions Tier 1 (10% at ₹1,000)');
  check(botData.reply.includes('2,000') && botData.reply.includes('20%'), '9.4 Chatbot mentions Tier 2 (20% at ₹2,000)');
  check(botData.reply.includes('3,000') && botData.reply.includes('30%'), '9.5 Chatbot mentions Tier 3 (30% at ₹3,000)');

  // ==========================================================================
  // PART C: ADMIN ROLE & METRICS REGRESSION
  // ==========================================================================
  console.log('\n--- 10. Admin Role & Tier Config Regression ---');

  // Query actual admin row in database
  const adminRow = db.prepare("SELECT id, username, email FROM users WHERE role = 'ADMIN'").get();
  check(Boolean(adminRow), '10.1 System Administrator account exists in database');

  // Generate Admin JWT token with actual admin user id
  const adminToken = jwt.sign({ userId: adminRow.id, role: 'ADMIN' }, getJwtSecret(), { expiresIn: '1h' });
  const adminRes = await fetch(`${BASE}/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminData = await adminRes.json();
  check(adminRes.status === 200, '10.2 Admin metrics returns 200 OK with admin token');
  check(Boolean(adminData.cartRewardTiers), '10.3 Admin metrics includes centralized cartRewardTiers');
  check(adminData.cartRewardTiers.length === 4, '10.4 Centralized cartRewardTiers (4 tiers) delivered to Admin Dashboard');

  // Deny normal user
  const normalUserDenial = await fetch(`${BASE}/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${newUserToken}` }
  });
  check(normalUserDenial.status === 403, '10.5 Regular user correctly denied (403 Forbidden) from admin dashboard');

  // ==========================================================================
  // PART D: FIVE EXISTING TEST USERS REGRESSION
  // ==========================================================================
  console.log('\n--- 11. Five Verified Test Accounts Regression ---');

  const fiveAccounts = [
    { username: 'akil_sundaram', email: 'akil.sundaram@aksmenstyle.com', password: 'AkilStyle2026!' },
    { username: 'rahul_devan', email: 'rahul.devan@aksmenstyle.com', password: 'RahulStyle2026!' },
    { username: 'karthik_raja', email: 'karthik.raja@aksmenstyle.com', password: 'KarthikStyle2026!' },
    { username: 'siddharth_varma', email: 'siddharth.varma@aksmenstyle.com', password: 'SiddharthStyle2026!' },
    { username: 'vikram_rao', email: 'vikram.rao@aksmenstyle.com', password: 'VikramStyle2026!' }
  ];

  let verifiedUsers = 0;
  for (const acct of fiveAccounts) {
    const userRow = db.prepare('SELECT id, username, email FROM users WHERE username = ?').get(acct.username);
    if (userRow && userRow.username === acct.username) {
      // Test login endpoint directly
      const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acct.email, password: acct.password })
      });
      const loginData = await loginRes.json();
      if (loginRes.status === 200 && loginData.user.username === acct.username) {
        verifiedUsers++;
        console.log(`[PASS] Verified account login & username intact: @${userRow.username} (${userRow.email})`);
      } else {
        console.error(`[FAIL] Login failed for ${acct.username}:`, loginData);
      }
    } else {
      console.error(`[FAIL] Account missing or modified: ${acct.username}`);
    }
  }
  check(verifiedUsers === 5, '11.1 All 5 verified evaluation accounts intact and successfully authenticate with manual usernames preserved');

  console.log('\n================================================================');
  console.log(`ALL TESTS COMPLETED: ${passed} / ${total} PASS (0 FAILURES)`);
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
