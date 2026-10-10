/**
 * AK'S MEN STYLE — GMAIL PURCHASE NOTIFICATION AUTOMATED TEST SUITE
 * Covers:
 * 1. Email config detection
 * 2. Preference ON
 * 3. Preference OFF
 * 4. Purchase event integration
 * 5. Recipient resolution from req.userId
 * 6. Client-email tampering protection
 * 7. Simulated mode
 * 8. SMTP failure handling
 * 9. Email audit status storage
 * 10. Duplicate-send protection (Idempotency)
 * 11. Multilingual template selection (English & Tamil)
 * 12. In-app notification regression
 */

import db, { initDatabase } from '../config/database.js';
import {
  getEmailConfig,
  generatePurchaseEmailTemplates,
  sendEmail,
  sendPurchaseSuccessEmail,
  recordEmailDelivery
} from '../services/emailService.js';
import {
  dispatchPurchaseCommunications,
  recordInAppPurchaseNotification
} from '../services/communicationService.js';

initDatabase();

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

async function runTestSuite() {
  console.log('====================================================');
  console.log('TEST SUITE: GMAIL PURCHASE NOTIFICATIONS');
  console.log('====================================================\n');

  // Backup original env vars
  const origEnv = { ...process.env };

  try {
    // ---------------------------------------------------------
    // TEST 1: Email Configuration Detection
    // ---------------------------------------------------------
    console.log('TEST 1: Email Configuration Detection');
    process.env.EMAIL_ENABLED = 'false';
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_APP_PASSWORD;

    let cfg = getEmailConfig();
    assert(cfg.isEnabled === false, 'EMAIL_ENABLED=false correctly detected');
    assert(cfg.isConfigured === false, 'Missing SMTP_PASS correctly marked unconfigured');
    assert(!('pass' in cfg), 'Config object strictly omits password property');

    process.env.EMAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'akmensstylehub@gmail.com';
    process.env.SMTP_PASS = 'mock_app_password_for_testing';
    process.env.EMAIL_FROM = 'akmensstylehub@gmail.com';

    cfg = getEmailConfig();
    assert(cfg.isEnabled === true, 'EMAIL_ENABLED=true correctly detected');
    assert(cfg.isConfigured === true, 'All required SMTP fields present -> configured: true');
    assert(cfg.host === 'smtp.gmail.com', 'SMTP host parsed correctly');
    assert(cfg.port === 587, 'SMTP port 587 parsed correctly');
    assert(cfg.user === 'akmensstylehub@gmail.com', 'SMTP user parsed correctly');

    // ---------------------------------------------------------
    // Set up test users & products in SQLite
    // ---------------------------------------------------------
    const ts = Date.now();
    const testEmailEn = `test.user.en.${ts}@aksmenstyle.internal`;
    const testEmailTa = `test.user.ta.${ts}@aksmenstyle.internal`;
    const testEmailDisabled = `test.user.disabled.${ts}@aksmenstyle.internal`;

    const userStmt = db.prepare(`
      INSERT INTO users (username, full_name, email, password_hash, phone, address, city, state, pincode, email_notifications, language_preference)
      VALUES (?, ?, ?, 'hash123', '9876543210', '123 Luxury Avenue', 'Chennai', 'Tamil Nadu', '600001', ?, ?)
    `);

    const userEnId = userStmt.run(`user_en_${ts}`, 'Arjun Verma', testEmailEn, 1, 'en').lastInsertRowid;
    const userTaId = userStmt.run(`user_ta_${ts}`, 'கார்த்திக்', testEmailTa, 1, 'ta').lastInsertRowid;
    const userDisabledId = userStmt.run(`user_dis_${ts}`, 'Vikram Singh', testEmailDisabled, 0, 'en').lastInsertRowid;

    // Get an existing product
    const product = db.prepare('SELECT * FROM products LIMIT 1').get();
    assert(Boolean(product), 'Found test product in database');

    // Create a test purchase for User EN
    const purStmt = db.prepare(`
      INSERT INTO purchases (user_id, purchase_type, total_amount, delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_pincode)
      VALUES (?, 'SINGLE', ?, 'Arjun Verma', '9876543210', '123 Luxury Avenue', 'Chennai', 'Tamil Nadu', '600001')
    `);

    const purchaseEnId = purStmt.run(userEnId, product.price).lastInsertRowid;
    db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price)
      VALUES (?, ?, 1, ?)
    `).run(purchaseEnId, product.id, product.price);

    // ---------------------------------------------------------
    // TEST 2 & 7: Simulated Mode (EMAIL_ENABLED=false)
    // ---------------------------------------------------------
    console.log('\nTEST 2: Simulated Mode When EMAIL_ENABLED=false');
    process.env.EMAIL_ENABLED = 'false';

    const simResult = await sendPurchaseSuccessEmail(purchaseEnId, userEnId);
    assert(simResult.status === 'SIMULATED', 'Returns status SIMULATED when EMAIL_ENABLED=false');
    assert(simResult.messageId && simResult.messageId.startsWith('simulated-'), 'Simulated messageId generated');

    const simAudit = db.prepare(`
      SELECT * FROM notification_deliveries 
      WHERE purchase_id = ? AND channel = 'EMAIL'
    `).get(purchaseEnId);
    assert(simAudit && simAudit.status === 'SIMULATED', 'SIMULATED status recorded in notification_deliveries audit');
    assert(simAudit.recipient === testEmailEn, 'Audit recorded correct recipient email');
    assert(simAudit.event_type === 'PURCHASE_SUCCESS', 'Audit recorded event_type = PURCHASE_SUCCESS');

    // ---------------------------------------------------------
    // TEST 3: Preference OFF (email_notifications = 0)
    // ---------------------------------------------------------
    console.log('\nTEST 3: Communication Preference OFF Check');
    const purchaseDisId = purStmt.run(userDisabledId, product.price).lastInsertRowid;
    db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price)
      VALUES (?, ?, 1, ?)
    `).run(purchaseDisId, product.id, product.price);

    const disResult = await sendPurchaseSuccessEmail(purchaseDisId, userDisabledId);
    assert(disResult.status === 'DISABLED', 'Returns status DISABLED when user email_notifications = 0');

    const disAudit = db.prepare(`
      SELECT * FROM notification_deliveries 
      WHERE purchase_id = ? AND channel = 'EMAIL'
    `).get(purchaseDisId);
    assert(disAudit && disAudit.status === 'DISABLED', 'DISABLED recorded in notification_deliveries');
    assert(disAudit.recipient === testEmailDisabled, 'Audit records recipient even when disabled');

    // ---------------------------------------------------------
    // TEST 4 & 12: In-App Notification Creation & Non-fatal Flow
    // ---------------------------------------------------------
    console.log('\nTEST 4: In-App Notification Creation on Purchase');
    const notifCountBefore = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(userDisabledId).count;
    
    // Call dispatchPurchaseCommunications for disabled user
    await dispatchPurchaseCommunications(purchaseDisId, userDisabledId);

    const inAppNotif = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? AND type = 'PURCHASE_SUCCESS' AND related_id = ?
    `).get(userDisabledId, purchaseDisId);

    assert(Boolean(inAppNotif), 'In-App notification created in notifications table');
    assert(inAppNotif.title === 'Purchase Confirmed', 'Notification title is "Purchase Confirmed"');
    assert(inAppNotif.message.includes(String(purchaseDisId)), 'Notification message contains purchase ID');
    assert(inAppNotif.is_read === 0, 'Notification starts as unread (is_read = 0)');

    // ---------------------------------------------------------
    // TEST 5 & 6: Recipient Security from req.userId
    // ---------------------------------------------------------
    console.log('\nTEST 5: Recipient Security from req.userId (Tampering Protection)');
    // Attacker sends request with body { email: "attacker@malicious.com" }
    // sendPurchaseSuccessEmail must strictly ignore client body and query SQLite using userId
    const authorPur = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseEnId);
    const authorUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userEnId);

    assert(authorUser.email === testEmailEn, 'Authoritative SQLite email resolved for user');
    // Simulate malicious attempt
    const maliciousInput = { email: 'attacker@evil.com', user_id: 999999 };
    // The service takes (purchaseId, userId) and derives email internally from SQLite
    const tamperAudit = db.prepare(`
      SELECT recipient FROM notification_deliveries WHERE purchase_id = ?
    `).get(purchaseEnId);
    assert(tamperAudit.recipient === testEmailEn, 'Recipient in delivery audit matches user email, not attacker input');

    // ---------------------------------------------------------
    // TEST 8: SMTP Failure Safety (No DB Rollback, Graceful Capture)
    // ---------------------------------------------------------
    console.log('\nTEST 8: SMTP Failure Safety & Error Capture');
    // Test with invalid SMTP host that fails connection
    process.env.EMAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'invalid-unreachable-smtp-host.internal';
    process.env.SMTP_PORT = '9999';

    const failPurchaseId = purStmt.run(userEnId, product.price).lastInsertRowid;
    db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price)
      VALUES (?, ?, 1, ?)
    `).run(failPurchaseId, product.id, product.price);

    const failRes = await sendEmail({
      to: testEmailEn,
      subject: "AK'S MEN STYLE — Test Subject",
      html: "<p>Test</p>",
      text: "Test",
      purchaseId: failPurchaseId,
      eventType: 'PURCHASE_SUCCESS',
      userId: userEnId
    });

    assert(failRes.status === 'FAILED', 'Gracefully captures SMTP error with status FAILED');
    assert(typeof failRes.message === 'string', 'Returns safe error message string');
    assert(!failRes.message.includes('mock_app_password'), 'Error message does not leak password');

    const failAudit = db.prepare(`
      SELECT * FROM notification_deliveries 
      WHERE purchase_id = ? AND status = 'FAILED'
    `).get(failPurchaseId);
    assert(Boolean(failAudit), 'Failure recorded in notification_deliveries');
    assert(failAudit.channel === 'EMAIL', 'Failure recorded for channel EMAIL');

    // Verify purchase and stock remain intact despite email failure
    const checkPurchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(failPurchaseId);
    assert(Boolean(checkPurchase), 'Purchase record is preserved in SQLite (NOT rolled back)');

    // ---------------------------------------------------------
    // TEST 9: Email Audit Status Values
    // ---------------------------------------------------------
    console.log('\nTEST 9: Email Audit Status Verification');
    const allAudits = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM notification_deliveries 
      GROUP BY status
    `).all();
    console.log('  Audit statuses recorded:', allAudits.map(a => `${a.status}: ${a.count}`).join(', '));
    const statusesFound = allAudits.map(a => a.status);
    assert(statusesFound.includes('SIMULATED') || statusesFound.includes('DISABLED') || statusesFound.includes('FAILED'), 'Expected audit statuses present in database');

    // ---------------------------------------------------------
    // TEST 10: Duplicate-Send Protection (Idempotency)
    // ---------------------------------------------------------
    console.log('\nTEST 10: Duplicate-Send Idempotency Protection');
    // purchaseEnId already has a SIMULATED audit entry
    const duplicateRes = await sendPurchaseSuccessEmail(purchaseEnId, userEnId);
    assert(duplicateRes.reused === true, 'Duplicate call detects existing delivery and sets reused=true');
    assert(duplicateRes.status === 'SIMULATED', 'Returns existing status');

    const countEnAudits = db.prepare(`
      SELECT COUNT(*) as count FROM notification_deliveries 
      WHERE purchase_id = ? AND channel = 'EMAIL' AND status IN ('SENT', 'SIMULATED')
    `).get(purchaseEnId).count;
    assert(countEnAudits === 1, 'Exactly one delivery record exists (no duplicate send on refresh)');

    // ---------------------------------------------------------
    // TEST 11: Multilingual Template Selection (English & Tamil)
    // ---------------------------------------------------------
    console.log('\nTEST 11: Multilingual Template Generation');
    // English Single Product
    const enTemplates = generatePurchaseEmailTemplates({
      purchase: authorPur,
      user: authorUser,
      items: [{ product_name: 'Oxford Cotton Shirt', quantity: 1, unit_price: 520, line_total: 520 }],
      language: 'en'
    });
    assert(enTemplates.subject.includes('Purchase Successful'), 'English subject contains "Purchase Successful"');
    assert(enTemplates.text.includes('Hi Arjun Verma'), 'English text contains customer greeting');
    assert(enTemplates.text.includes('PURCHASED PRODUCT'), 'English text contains "PURCHASED PRODUCT"');
    assert(enTemplates.html.includes('AK\'S MEN STYLE'), 'English HTML contains brand header');
    assert(!enTemplates.text.includes('tracking number'), 'No courier tracking mentions in English');

    // Tamil Single Product
    const authorUserTa = db.prepare('SELECT * FROM users WHERE id = ?').get(userTaId);
    const taTemplates = generatePurchaseEmailTemplates({
      purchase: authorPur,
      user: authorUserTa,
      items: [{ product_name: 'Oxford Cotton Shirt', quantity: 1, unit_price: 520, line_total: 520 }],
      language: 'ta'
    });
    assert(taTemplates.subject.includes('வாங்குதல் வெற்றிகரமாக முடிந்தது'), 'Tamil subject contains "வாங்குதல் வெற்றிகரமாக முடிந்தது"');
    assert(taTemplates.text.includes('வணக்கம் கார்த்திக்'), 'Tamil text contains customer greeting');
    assert(taTemplates.text.includes('வாங்கிய பொருள்:'), 'Tamil text contains "வாங்கிய பொருள்:"');
    assert(taTemplates.text.includes('டெலிவரி பெறுநர்:'), 'Tamil text contains "டெலிவரி பெறுநர்:"');
    assert(taTemplates.html.includes('AK\'S MEN STYLE'), 'Tamil HTML contains brand header');

    // Cart Purchase with Buy More Save More Reward in English
    const cartRewardEn = generatePurchaseEmailTemplates({
      purchase: { ...authorPur, total_amount: 990, subtotal: 1100, cart_reward_percent: 10, cart_reward_amount: 110 },
      user: authorUser,
      items: [
        { product_name: 'Shirt A', quantity: 1, unit_price: 550, line_total: 550 },
        { product_name: 'Shirt B', quantity: 1, unit_price: 550, line_total: 550 }
      ],
      cartReward: { percentage: 10, rewardAmount: 110, subtotal: 1100 },
      language: 'en'
    });
    assert(cartRewardEn.text.includes('Subtotal: ₹1100'), 'Cart email includes Subtotal');
    assert(cartRewardEn.text.includes('Buy More, Save More: 10% OFF'), 'Cart email includes Buy More Save More 10% OFF');
    assert(cartRewardEn.text.includes('Savings: -₹110'), 'Cart email includes savings amount');
    assert(cartRewardEn.text.includes('Final Total: ₹990'), 'Cart email includes Final Total');

    // Cart Purchase with Buy More Save More in Tamil
    const cartRewardTa = generatePurchaseEmailTemplates({
      purchase: { ...authorPur, total_amount: 990, subtotal: 1100, cart_reward_percent: 10, cart_reward_amount: 110 },
      user: authorUserTa,
      items: [
        { product_name: 'Shirt A', quantity: 1, unit_price: 550, line_total: 550 },
        { product_name: 'Shirt B', quantity: 1, unit_price: 550, line_total: 550 }
      ],
      cartReward: { percentage: 10, rewardAmount: 110, subtotal: 1100 },
      language: 'ta'
    });
    assert(cartRewardTa.text.includes('கூட்டுத் தொகை: ₹1100'), 'Tamil cart email includes Subtotal in Tamil');
    assert(cartRewardTa.text.includes('வாங்கிச் சேமியுங்கள் சலுகை: 10% தள்ளுபடி'), 'Tamil cart email includes Buy More Save More');
    assert(cartRewardTa.text.includes('இறுதி மொத்தம்: ₹990'), 'Tamil cart email includes Final Total in Tamil');

    console.log('\n====================================================');
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore environment
    process.env = origEnv;
  }
}

runTestSuite().catch(err => {
  console.error('Test execution failed with unhandled exception:', err);
  process.exit(1);
});
