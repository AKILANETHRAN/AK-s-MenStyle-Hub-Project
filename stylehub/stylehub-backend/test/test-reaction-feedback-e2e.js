import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — Friend Share Reaction & Feedback Complete Verification ===\n');

const BASE = 'http://localhost:5000/api';
const secret = getJwtSecret();

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

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

// 1. Setup test users: User A (921), User B (922), User C (923)
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (921, 'akil_sender_a', 'Akil A', 'akil_sender_a@example.com', 'hash_a'),
         (922, 'rahul_receiver_b', 'Rahul B', 'rahul_receiver_b@example.com', 'hash_b'),
         (923, 'charles_third_party_c', 'Charles C', 'charles_c@example.com', 'hash_c')
`).run();

// Clean up any existing data for these test users
db.prepare('DELETE FROM friendships WHERE requester_id IN (921, 922, 923) OR receiver_id IN (921, 922, 923)').run();
db.prepare('DELETE FROM wishlist_shares WHERE sender_id IN (921, 922, 923) OR receiver_id IN (921, 922, 923)').run();
db.prepare('DELETE FROM notifications WHERE user_id IN (921, 922, 923)').run();

const tokenA = jwt.sign({ userId: 921, email: 'akil_sender_a@example.com' }, secret, { expiresIn: '1h' });
const tokenB = jwt.sign({ userId: 922, email: 'rahul_receiver_b@example.com' }, secret, { expiresIn: '1h' });
const tokenC = jwt.sign({ userId: 923, email: 'charles_c@example.com' }, secret, { expiresIn: '1h' });

async function runTests() {
  console.log('--- Phase 1: Establish Friendship between User A and User B ---');
  // A sends friend request to B
  const reqRes = await fetch(`${BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 922 })
  });
  const reqData = await reqRes.json();
  const friendshipId = reqData.data.friendshipId;
  assert(reqRes.status === 201 && friendshipId > 0, '1. Friend request created from A to B');

  // B accepts friendship
  const acceptRes = await fetch(`${BASE}/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(acceptRes.status === 200, '2. User B accepted friend request');

  console.log('\n--- Phase 2: Single Product Share (A -> B) ---');
  const share1Res = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 922, productIds: [1], shareType: 'PRODUCTS' })
  });
  const share1Data = await share1Res.json();
  assert(share1Res.status === 201 && share1Data.data.shareId > 0, '3. User A shared single product with User B');
  const shareId1 = share1Data.data.shareId;

  // B inspects shared look
  const view1Res = await fetch(`${BASE}/wishlist/shares/${shareId1}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const view1Data = await view1Res.json();
  assert(view1Res.status === 200, '4. User B can view shared product');
  assert(view1Data.data.id === shareId1 && view1Data.data.shareId === shareId1, '5. Response has stable id and shareId');
  assert(view1Data.data.senderId === 921 && view1Data.data.receiverId === 922, '6. Response has senderId and receiverId');
  assert(view1Data.data.isReceiver === true && view1Data.data.isSender === false, '7. User B is properly identified as isReceiver');

  console.log('\n--- Phase 3: Reaction Submission (LIKE) ---');
  const likeRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LIKE' })
  });
  const likeData = await likeRes.json();
  assert(likeRes.status === 201 || likeRes.status === 200, '8. LIKE reaction submitted with HTTP success');

  // Verify SQLite row
  const dbLike = db.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ? AND user_id = ?').get(shareId1, 922);
  assert(dbLike && dbLike.reaction === 'LIKE', '9. SQLite: wishlist_feedback row created with reaction = LIKE');

  // Verify sender notification
  const notifA1 = db.prepare('SELECT * FROM notifications WHERE user_id = 921 AND related_id = ? ORDER BY id DESC').get(shareId1);
  assert(notifA1 && notifA1.type === 'WISHLIST_FEEDBACK' && notifA1.message.includes('reacted 👍'), '10. Sender A received notification for LIKE reaction with 👍 emoji');

  console.log('\n--- Phase 4: Change Reaction to LOVE ---');
  const loveRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LOVE' })
  });
  assert(loveRes.status === 200 || loveRes.status === 201, '11. LOVE reaction update submitted with HTTP success');

  // Verify SQLite update and NO duplicate rows
  const dbLoveRows = db.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ? AND user_id = ?').all(shareId1, 922);
  assert(dbLoveRows.length === 1 && dbLoveRows[0].reaction === 'LOVE', '12. SQLite: wishlist_feedback row updated to LOVE without duplicate row');

  // Verify sender notification for LOVE
  const notifA2 = db.prepare('SELECT * FROM notifications WHERE user_id = 921 AND related_id = ? ORDER BY id DESC').get(shareId1);
  assert(notifA2 && notifA2.message.includes('reacted ❤️'), '13. Sender A received notification for LOVE reaction with ❤️ emoji');

  console.log('\n--- Phase 5: Change Reaction to FIRE ---');
  const fireRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'FIRE' })
  });
  assert(fireRes.status === 200 || fireRes.status === 201, '14. FIRE reaction update submitted with HTTP success');

  const dbFireRows = db.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ? AND user_id = ?').all(shareId1, 922);
  assert(dbFireRows.length === 1 && dbFireRows[0].reaction === 'FIRE', '15. SQLite: wishlist_feedback row updated to FIRE without duplicate row');

  const notifA3 = db.prepare('SELECT * FROM notifications WHERE user_id = 921 AND related_id = ? ORDER BY id DESC').get(shareId1);
  assert(notifA3 && notifA3.message.includes('reacted 🔥'), '16. Sender A received notification for FIRE reaction with 🔥 emoji');

  console.log('\n--- Phase 6: Feedback / Comment Submission ---');
  const commentText = 'Bro this combo looks really sharp.';
  const commentRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: commentText })
  });
  assert(commentRes.status === 200 || commentRes.status === 201, '17. Feedback comment submitted with HTTP success');

  const dbCommentRows = db.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ? AND user_id = ?').all(shareId1, 922);
  assert(dbCommentRows.length === 1 && dbCommentRows[0].comment === commentText && dbCommentRows[0].reaction === 'FIRE',
    '18. SQLite: comment stored accurately while preserving active FIRE reaction');

  const notifA4 = db.prepare('SELECT * FROM notifications WHERE user_id = 921 AND related_id = ? ORDER BY id DESC').get(shareId1);
  assert(notifA4 && notifA4.type === 'WISHLIST_FEEDBACK' && notifA4.related_id === shareId1,
    '19. Sender A received notification for feedback comment referencing shareId');

  console.log('\n--- Phase 7: Refresh & Persistence Check ---');
  const refreshRes = await fetch(`${BASE}/wishlist/shares/${shareId1}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const refreshData = await refreshRes.json();
  const bFeedback = refreshData.data.feedback.find(fb => fb.userId === 922);
  assert(bFeedback && bFeedback.reaction === 'FIRE' && bFeedback.comment === commentText,
    '20. Refresh Persistence: Shared look response preserves receiver reaction (FIRE) and comment');

  console.log('\n--- Phase 8: Complete Look Share (A -> B) ---');
  const lookProductIds = [1, 21, 56, 61];
  const lookShareRes = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 922, productIds: lookProductIds, shareType: 'LOOK' })
  });
  const lookShareData = await lookShareRes.json();
  const lookShareId = lookShareData.data.shareId;
  assert(lookShareRes.status === 201 && lookShareId > 0, '21. Complete Look shared successfully with shareType = LOOK');

  const lookViewRes = await (await fetch(`${BASE}/wishlist/shares/${lookShareId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })).json();
  assert(lookViewRes.data.shareType === 'LOOK' && (lookViewRes.data.products || lookViewRes.data.items).length === 4,
    '22. Receiver views complete look with exact 4 items');

  const lookFbRes = await fetch(`${BASE}/wishlist/shares/${lookShareId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LOVE', comment: 'Perfect ensemble for formal events!' })
  });
  assert(lookFbRes.status === 200 || lookFbRes.status === 201, '23. Receiver submitted LOVE and feedback for complete look');

  const dbLookFb = db.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ? AND user_id = ?').get(lookShareId, 922);
  assert(dbLookFb && dbLookFb.reaction === 'LOVE' && dbLookFb.comment === 'Perfect ensemble for formal events!',
    '24. SQLite: Complete Look feedback persisted');

  console.log('\n--- Phase 9: Multiple Products Share Regression ---');
  const multiProductIds = [1, 21, 61];
  const multiShareRes = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 922, productIds: multiProductIds, shareType: 'PRODUCTS' })
  });
  const multiShareData = await multiShareRes.json();
  const multiShareId = multiShareData.data.shareId;

  const multiView = await (await fetch(`${BASE}/wishlist/shares/${multiShareId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })).json();
  const returnedProductIds = (multiView.data.products || multiView.data.items).map(p => p.productId || p.id);
  assert(JSON.stringify(returnedProductIds) === JSON.stringify(multiProductIds),
    '25. Regression: Multiple product share preserves exact product IDs [1, 21, 61]');

  console.log('\n--- Phase 10: Security & Authorization Protection ---');
  // User C (unauthorized third party) attempts to GET share
  const cGetRes = await fetch(`${BASE}/wishlist/shares/${shareId1}`, {
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(cGetRes.status === 403, '26. Security: User C cannot GET private share (403 Forbidden)');

  // User C attempts to POST reaction/feedback
  const cPostRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenC}` },
    body: JSON.stringify({ reaction: 'LOVE', comment: 'Sneaking in feedback' })
  });
  assert(cPostRes.status === 403, '27. Security: User C cannot POST reaction/feedback (403 Forbidden)');

  // Sender User A attempts to submit reaction/feedback (cannot impersonate receiver)
  const aPostRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ reaction: 'FIRE', comment: 'Self reaction' })
  });
  assert(aPostRes.status === 403, '28. Security: Sender User A cannot submit reaction/feedback on own share (403 Forbidden)');

  // Unauthenticated request (no JWT)
  const unauthRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction: 'LIKE' })
  });
  assert(unauthRes.status === 401, '29. Security: Unauthenticated request rejected with 401 Unauthorized');

  console.log('\n--- Phase 11: Validation Edge Cases ---');
  // Empty feedback with no reaction
  const emptyRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: '   ' })
  });
  assert(emptyRes.status === 400, '30. Validation: Empty comment without reaction rejected with 400 Bad Request');

  // Comment exceeding 500 characters
  const longComment = 'A'.repeat(501);
  const longRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ comment: longComment })
  });
  assert(longRes.status === 400, '31. Validation: Comment > 500 characters rejected with 400 Bad Request');

  // Invalid reaction value
  const badReactionRes = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'AWESOME' })
  });
  assert(badReactionRes.status === 400, '32. Validation: Invalid reaction value rejected with 400 Bad Request');

  // Nonexistent share ID
  const notFoundRes = await fetch(`${BASE}/wishlist/shares/999999/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LOVE' })
  });
  assert(notFoundRes.status === 404, '33. Validation: Nonexistent share ID rejected with 404 Not Found');

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
