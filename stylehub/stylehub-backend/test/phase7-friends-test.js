import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — Phase 7: Friends & Wishlist Sharing Test Suite ===\n');

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

// 1. Setup 3 test users: A (911), B (912), C (913)
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (911, 'akil_a', 'Akil User A', 'akil_a@example.com', 'hash_a'),
         (912, 'rahul_b', 'Rahul User B', 'rahul_b@example.com', 'hash_b'),
         (913, 'charles_c', 'Charles User C', 'charles_c@example.com', 'hash_c')
`).run();

// Clean existing friendships, shares, feedback, notifications for test users
db.prepare('DELETE FROM friendships WHERE requester_id IN (911, 912, 913) OR receiver_id IN (911, 912, 913)').run();
db.prepare('DELETE FROM wishlist_shares WHERE sender_id IN (911, 912, 913) OR receiver_id IN (911, 912, 913)').run();
db.prepare('DELETE FROM notifications WHERE user_id IN (911, 912, 913)').run();

const tokenA = jwt.sign({ userId: 911, email: 'akil_a@example.com' }, secret, { expiresIn: '1h' });
const tokenB = jwt.sign({ userId: 912, email: 'rahul_b@example.com' }, secret, { expiresIn: '1h' });
const tokenC = jwt.sign({ userId: 913, email: 'charles_c@example.com' }, secret, { expiresIn: '1h' });

async function run() {
  // Test 1: Unauthorized request rejected with 401
  const unauthRes = await fetch(`${BASE}/friends`);
  assert(unauthRes.status === 401, '1. GET /api/friends without JWT returns 401');

  // Test 2: Search users by username
  const searchRes = await fetch(`${BASE}/friends/search?username=rahul`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const searchData = await searchRes.json();
  const foundB = searchData.data.users.find(u => u.username === 'rahul_b');
  assert(foundB && foundB.username === 'rahul_b' && !foundB.email && !foundB.password_hash, '2. Search user returns public info only (no email or password_hash)');

  // Test 3: Cannot send friend request to self
  const selfReq = await fetch(`${BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 911 })
  });
  assert(selfReq.status === 400, '3. Friend request to self is rejected with 400');

  // Test 4: User A sends friend request to User B
  const reqRes = await fetch(`${BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 912 })
  });
  const reqData = await reqRes.json();
  assert(reqRes.status === 201 && reqData.data.status === 'PENDING', '4. User A successfully sent friend request to User B (PENDING)');
  const friendshipId = reqData.data.friendshipId;

  // Test 5: Duplicate friend request rejected
  const dupReq = await fetch(`${BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 912 })
  });
  assert(dupReq.status === 400, '5. Duplicate friend request rejected with 400');

  // Test 6: User B receives friend request in incoming list
  const bRequests = await (await fetch(`${BASE}/friends/requests`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })).json();
  assert(bRequests.data.incoming.some(r => r.userId === 911), '6. User B sees incoming friend request from User A');

  // Test 7: User B receives notification
  const bNotifs = await (await fetch(`${BASE}/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  })).json();
  assert(bNotifs.data.notifications.some(n => n.type === 'FRIEND_REQUEST'), '7. User B received FRIEND_REQUEST notification');

  // Test 8: User B accepts friend request
  const acceptRes = await fetch(`${BASE}/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const acceptData = await acceptRes.json();
  assert(acceptRes.status === 200 && acceptData.data.status === 'ACCEPTED', '8. User B accepted friend request (ACCEPTED)');

  // Test 9: Both A and B see each other in Friends list
  const friendsA = await (await fetch(`${BASE}/friends`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const friendsB = await (await fetch(`${BASE}/friends`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  assert(friendsA.data.friends.some(f => f.userId === 912), '9a. User A sees User B in accepted friends list');
  assert(friendsB.data.friends.some(f => f.userId === 911), '9b. User B sees User A in accepted friends list');

  // Test 10: Wishlist sharing - A adds products to wishlist first
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 1, action: 'add' })
  });
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 21, action: 'add' })
  });

  // Test 11: A cannot share with C (C is not a friend)
  const nonFriendShare = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 913, productIds: [1, 21] })
  });
  assert(nonFriendShare.status === 403, '10. Sharing with non-friend User C is rejected with 403 Forbidden');

  // Test 12: A shares products [1, 21] with accepted friend B
  const shareRes = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 912, productIds: [1, 21] })
  });
  const shareData = await shareRes.json();
  assert(shareRes.status === 201 && shareData.data.shareId > 0, '11. User A successfully shared curated look with User B');
  const shareId = shareData.data.shareId;

  // Test 13: Access Control: User B can view the share
  const bViewShare = await fetch(`${BASE}/wishlist/shares/${shareId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const bShareDetails = await bViewShare.json();
  assert(bViewShare.status === 200 && bShareDetails.data.products.length === 2, '12. User B can view the private shared look with 2 products');

  // Test 14: Access Control: User C (unauthorized) CANNOT view the share
  const cViewShare = await fetch(`${BASE}/wishlist/shares/${shareId}`, {
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(cViewShare.status === 403, '13. Access Control: User C is rejected with 403 Forbidden on private share');

  // Test 15: User B reacts with LOVE ❤️ and comments "Nice combination."
  const feedbackRes = await fetch(`${BASE}/wishlist/shares/${shareId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LOVE', comment: 'Nice combination.' })
  });
  const feedbackData = await feedbackRes.json();
  assert(feedbackRes.status === 201 && feedbackData.data.feedback.some(f => f.reaction === 'LOVE'), '14. User B added LOVE reaction and comment');

  // Test 16: User A receives WISHLIST_FEEDBACK notification
  const aNotifs = await (await fetch(`${BASE}/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  })).json();
  assert(aNotifs.data.notifications.some(n => n.type === 'WISHLIST_FEEDBACK'), '15. User A received WISHLIST_FEEDBACK notification');

  // Test 17: User A can see the feedback on the shared look
  const aViewShare = await (await fetch(`${BASE}/wishlist/shares/${shareId}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  })).json();
  assert(aViewShare.data.feedback.some(f => f.comment === 'Nice combination.' && f.reaction === 'LOVE'), '16. User A views friend feedback on shared look');

  // Test 18: Remove friendship
  const removeRes = await fetch(`${BASE}/friends/${friendshipId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(removeRes.status === 200, '17. User A removed friendship with User B');

  // Test 19: After removal, User B no longer has access to the shared look
  const bAfterRemoval = await fetch(`${BASE}/wishlist/shares/${shareId}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(bAfterRemoval.status === 403, '18. Access revoked: User B can no longer view private share after friendship removal');

  // Test 20: Future sharing between A and B is blocked
  const futureShare = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 902, productIds: [1] })
  });
  assert(futureShare.status === 403, '19. Future private sharing is blocked between removed friends');

  console.log(`\nPhase 7 Test Suite Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Phase 7 Test Error:', err);
  process.exit(1);
});
