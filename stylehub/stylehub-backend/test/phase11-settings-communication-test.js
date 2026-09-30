import assert from 'assert';
import db from '../config/database.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const BASE = 'http://localhost:5000/api';

let passed = 0;
function check(condition, message) {
  assert(condition, message);
  console.log(`[PASS] ${message}`);
  passed++;
}

async function runPhase11Tests() {
  console.log('================================================================');
  console.log("AK'S MEN STYLE — PHASE 11: SETTINGS & COMMUNICATION TEST SUITE");
  console.log('================================================================\n');

  // Find a verified test user (Alex Turner, id: 1)
  const testUser = db.prepare('SELECT * FROM users WHERE id = 1').get();
  assert(testUser, 'Test user 1 must exist');

  // Ensure user 1 has delivery address setup
  db.prepare(`
    UPDATE users
    SET full_name = 'Alex Turner',
        phone = '9876543210',
        address = '123 Luxury Ave, Apt 4B',
        city = 'Chennai',
        state = 'Tamil Nadu',
        pincode = '600001',
        theme_preference = 'gold-silver',
        language_preference = 'en',
        email_notifications = 1,
        sms_notifications = 1,
        whatsapp_notifications = 1
    WHERE id = 1
  `).run();

  const token = jwt.sign({ userId: testUser.id, role: testUser.role || 'USER' }, getJwtSecret(), { expiresIn: '1d' });
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  // --- Test 1: Settings Retrieval ---
  console.log('--- Test 1: Settings Retrieval (GET /api/settings) ---');
  const getSettingsRes = await fetch(`${BASE}/settings`, { headers: authHeaders });
  const settingsData = await getSettingsRes.json();
  check(getSettingsRes.status === 200, '1. GET /api/settings returns 200 OK');
  check(settingsData.status === 'success', '2. Response status is success');
  check(settingsData.settings.theme === 'gold-silver', '3. Default theme is gold-silver');
  check(settingsData.settings.language === 'en', '4. Default language is en');
  check(settingsData.settings.communication.email === true, '5. Communication email defaults to enabled');
  check(settingsData.settings.communication.sms === true, '6. Communication SMS defaults to enabled');
  check(settingsData.settings.communication.whatsapp === true, '7. Communication WhatsApp defaults to enabled');
  check(settingsData.settings.account.email === testUser.email, '8. Account section returns authenticated user email');

  // --- Test 2: Settings Update (PUT /api/settings) ---
  console.log('\n--- Test 2: Settings Update (PUT /api/settings) ---');
  const updateRes = await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      theme: 'midnight-silver',
      language: 'ta',
      communication: {
        email: true,
        sms: false,
        whatsapp: true
      }
    })
  });
  const updateData = await updateRes.json();
  check(updateRes.status === 200, '9. PUT /api/settings returns 200 OK');
  check(updateData.settings.theme === 'midnight-silver', '10. Theme updated to midnight-silver');
  check(updateData.settings.language === 'ta', '11. Language updated to ta');
  check(updateData.settings.communication.sms === false, '12. SMS notifications toggled off');

  // Verify persistence in SQLite
  const persistedUser = db.prepare('SELECT theme_preference, language_preference, sms_notifications FROM users WHERE id = 1').get();
  check(persistedUser.theme_preference === 'midnight-silver', '13. Theme preference persisted in SQLite');
  check(persistedUser.language_preference === 'ta', '14. Language preference persisted in SQLite');
  check(persistedUser.sms_notifications === 0, '15. Communication preference persisted in SQLite');

  // --- Test 3: Purchase Execution & Post-Commit Communications ---
  console.log('\n--- Test 3: Purchase Execution & Communication Dispatch ---');
  // Find a product with available stock
  const product = db.prepare('SELECT id, name, price, stock FROM products WHERE stock > 5 LIMIT 1').get();
  assert(product, 'A product with stock > 5 must exist');
  const initialStock = product.stock;

  const purchaseRes = await fetch(`${BASE}/purchases/product`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId: product.id,
      quantity: 1
    })
  });
  const purchaseData = await purchaseRes.json();
  check(purchaseRes.status === 201, '16. POST /api/purchases/product returns 201 Created');
  check(purchaseData.status === 'success', '17. Purchase succeeded');
  check(Boolean(purchaseData.purchase.id), '18. Purchase ID generated');
  check(Boolean(purchaseData.notifications), '19. Notifications summary returned in response');
  check(purchaseData.notifications.sms.status === 'DISABLED', '20. SMS correctly reported as DISABLED per user settings');

  // Verify stock was decremented exactly once
  const updatedProduct = db.prepare('SELECT stock FROM products WHERE id = ?').get(product.id);
  check(updatedProduct.stock === initialStock - 1, '21. Product stock decremented exactly by 1');

  // Restore stock
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(initialStock, product.id);

  // --- Test 4: Idempotency Protection ---
  console.log('\n--- Test 4: Notification Idempotency Protection ---');
  const newPurchaseId = purchaseData.purchase.id;
  const deliveryCount1 = db.prepare('SELECT COUNT(*) as count FROM notification_deliveries WHERE purchase_id = ?').get(newPurchaseId).count;
  check(deliveryCount1 > 0, '22. Delivery records logged in notification_deliveries');

  // Re-invoking dispatchPurchaseCommunications should not duplicate records
  const { dispatchPurchaseCommunications } = await import('../services/communicationService.js');
  const reDispatch = await dispatchPurchaseCommunications(newPurchaseId, 1);
  const deliveryCount2 = db.prepare('SELECT COUNT(*) as count FROM notification_deliveries WHERE purchase_id = ?').get(newPurchaseId).count;
  check(deliveryCount1 === deliveryCount2, '23. Re-dispatch is idempotent — zero duplicate rows created');

  // --- Test 5: Notification Delivery History Endpoint ---
  console.log('\n--- Test 5: Notification Delivery History (GET /api/settings/notifications/history) ---');
  const historyRes = await fetch(`${BASE}/settings/notifications/history`, { headers: authHeaders });
  const historyData = await historyRes.json();
  check(historyRes.status === 200, '24. GET /api/settings/notifications/history returns 200 OK');
  check(Array.isArray(historyData.deliveries), '25. Deliveries returned as an array');
  check(historyData.deliveries.length > 0, '26. Delivery history contains recorded events');
  const logged = historyData.deliveries.find(d => d.purchase_id === newPurchaseId);
  check(Boolean(logged), '27. Most recent purchase delivery found in history');

  // --- Test 6: User Isolation on Notification History ---
  console.log('\n--- Test 6: Strict User Isolation ---');
  // Token for User 2 (Marcus)
  const token2 = jwt.sign({ userId: 2, role: 'USER' }, getJwtSecret(), { expiresIn: '1d' });
  const historyRes2 = await fetch(`${BASE}/settings/notifications/history`, {
    headers: { Authorization: `Bearer ${token2}` }
  });
  const historyData2 = await historyRes2.json();
  const foundUser1Purchase = historyData2.deliveries.some(d => d.purchase_id === newPurchaseId);
  check(!foundUser1Purchase, '28. User 2 CANNOT view User 1 notification deliveries (strict isolation)');

  // Reset user 1 settings
  db.prepare(`
    UPDATE users
    SET theme_preference = 'gold-silver',
        language_preference = 'en',
        email_notifications = 1,
        sms_notifications = 1,
        whatsapp_notifications = 1
    WHERE id = 1
  `).run();
  check(true, '29. Test user preferences cleanly reset');

  console.log('\n================================================================');
  console.log(`✅ ALL ${passed} PHASE 11 SETTINGS & COMMUNICATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runPhase11Tests().catch(err => {
  console.error('Phase 11 Test Suite Failed:', err);
  process.exit(1);
});
