import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — End-to-End Social Styling Workflow Test ===\n');

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

// Setup User A (881) and User B (882)
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (881, 'user_a_flow', 'User A Gentlemen', 'user_a@example.local', 'hash_a'),
         (882, 'user_b_flow', 'User B Gentlemen', 'user_b@example.local', 'hash_b')
`).run();

// Clean existing data for these test users
db.prepare('DELETE FROM friendships WHERE requester_id IN (881, 882) OR receiver_id IN (881, 882)').run();
db.prepare('DELETE FROM wishlist_shares WHERE sender_id IN (881, 882) OR receiver_id IN (881, 882)').run();
db.prepare('DELETE FROM notifications WHERE user_id IN (881, 882)').run();

const tokenA = jwt.sign({ userId: 881, email: 'user_a@example.local' }, secret, { expiresIn: '1h' });
const tokenB = jwt.sign({ userId: 882, email: 'user_b@example.local' }, secret, { expiresIn: '1h' });

async function runWorkflow() {
  console.log('--- Step 1: User A searches User B ---');
  const searchRes = await fetch(`${BASE}/friends/search?username=user_b_flow`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const searchJson = await searchRes.json();
  assert(searchRes.status === 200, 'User A searches for User B successfully');
  const foundUserB = searchJson.data.users.find(u => u.username === 'user_b_flow');
  assert(foundUserB && foundUserB.id === 882, 'Found User B in search results');

  console.log('\n--- Step 2: User A sends friend request to User B ---');
  const sendReqRes = await fetch(`${BASE}/friends/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ receiverId: 882 })
  });
  const sendReqJson = await sendReqRes.json();
  assert(sendReqRes.status === 201, 'Friend request sent successfully');
  const friendshipId = sendReqJson.data.friendshipId;
  assert(friendshipId > 0, `Friendship ID created: ${friendshipId}`);

  // Check notification for User B
  const notifB1 = await fetch(`${BASE}/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const notifB1Json = await notifB1.json();
  const reqNotif = notifB1Json.data.notifications.find(n => n.type === 'FRIEND_REQUEST');
  assert(reqNotif && reqNotif.message.includes('user_a_flow sent you a friend request'), 'User B received FRIEND_REQUEST notification');

  console.log('\n--- Step 3: User B accepts friend request ---');
  const acceptRes = await fetch(`${BASE}/friends/${friendshipId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const acceptJson = await acceptRes.json();
  assert(acceptRes.status === 200 && acceptJson.data.status === 'ACCEPTED', 'User B accepted friend request');

  // Check notification for User A
  const notifA1 = await fetch(`${BASE}/notifications`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const notifA1Json = await notifA1.json();
  const acceptNotif = notifA1Json.data.notifications.find(n => n.type === 'FRIEND_ACCEPTED');
  assert(acceptNotif && acceptNotif.message.includes('user_b_flow accepted your friend request'), 'User A received FRIEND_ACCEPTED notification');

  console.log('\n--- Step 4: Verify A & B are accepted friends ---');
  const friendsA = await (await fetch(`${BASE}/friends`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const friendsB = await (await fetch(`${BASE}/friends`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  assert(friendsA.data.friends.some(f => f.username === 'user_b_flow'), 'User B is in User A\'s friends list');
  assert(friendsB.data.friends.some(f => f.username === 'user_a_flow'), 'User A is in User B\'s friends list');

  console.log('\n--- Step 5: A selects Wishlist Product(s) & shares with B ---');
  // Add item 1 to User A's wishlist first
  await fetch(`${BASE}/wishlist/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ productId: 1 })
  });

  const shareRes1 = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 882, productIds: [1] })
  });
  const shareJson1 = await shareRes1.json();
  assert(shareRes1.status === 201, 'Wishlist products shared successfully with User B');
  const shareId1 = shareJson1.data.shareId;

  // Check B received WISHLIST_SHARED notification with relatedId
  const notifB2 = await (await fetch(`${BASE}/notifications`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  const shareNotif1 = notifB2.data.notifications.find(n => n.type === 'WISHLIST_SHARED');
  assert(shareNotif1 && shareNotif1.relatedId === shareId1, 'User B received WISHLIST_SHARED notification with matching relatedId');

  console.log('\n--- Step 6: B receives and views shared look ---');
  const lookRes1 = await fetch(`${BASE}/wishlist/shares/${shareId1}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const lookJson1 = await lookRes1.json();
  assert(lookRes1.status === 200, 'User B can access shared look');
  assert((lookJson1.data.products || lookJson1.data.items).length === 1, 'Shared look contains 1 piece');

  console.log('\n--- Step 7: B gives ❤️ LOVE reaction + Comment ---');
  const fbRes1 = await fetch(`${BASE}/wishlist/shares/${shareId1}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LOVE', comment: 'Classic Oxford shirt looks sharp on you!' })
  });
  const fbJson1 = await fbRes1.json();
  assert(fbRes1.status === 201, 'User B submitted LOVE reaction and comment');

  console.log('\n--- Step 8: A receives notification with feedback ---');
  const notifA2 = await (await fetch(`${BASE}/notifications`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const fbNotif1 = notifA2.data.notifications.find(n => n.type === 'WISHLIST_FEEDBACK');
  assert(fbNotif1 && fbNotif1.message.includes('reacted ❤️') && fbNotif1.relatedId === shareId1, 'User A received WISHLIST_FEEDBACK notification with ❤️ and relatedId');

  console.log('\n--- Step 9: A selects Recommended Combo (Product 1 + 21 + 56 + 61) & shares with B ---');
  const comboProductIds = [1, 21, 56, 61];
  const shareRes2 = await fetch(`${BASE}/wishlist/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ receiverId: 882, productIds: comboProductIds })
  });
  const shareJson2 = await shareRes2.json();
  assert(shareRes2.status === 201, 'Recommended combo shared successfully with User B');
  const shareId2 = shareJson2.data.shareId;

  console.log('\n--- Step 10: B views combo and gives 🔥 FIRE reaction + Comment ---');
  const lookRes2 = await (await fetch(`${BASE}/wishlist/shares/${shareId2}`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  assert((lookRes2.data.products || lookRes2.data.items).length === 4, 'User B views 4-piece curated combo');

  const fbRes2 = await fetch(`${BASE}/wishlist/shares/${shareId2}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'FIRE', comment: 'This entire combo is fire, grab the watch too!' })
  });
  assert(fbRes2.status === 201, 'User B submitted FIRE reaction for combo');

  console.log('\n--- Step 11: A receives notification for combo feedback ---');
  const notifA3 = await (await fetch(`${BASE}/notifications`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  const fbNotif2 = notifA3.data.notifications.find(n => n.type === 'WISHLIST_FEEDBACK' && n.message.includes('reacted 🔥'));
  assert(fbNotif2 && fbNotif2.relatedId === shareId2, 'User A received notification with 🔥 FIRE reaction and matching relatedId');

  console.log('\n--- Step 12: Test 👍 LIKE reaction ---');
  const fbRes3 = await fetch(`${BASE}/wishlist/shares/${shareId2}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ reaction: 'LIKE', comment: 'Solid styling!' })
  });
  assert(fbRes3.status === 201, 'User B submitted LIKE reaction');

  console.log('\n--- Step 13: Verify shared looks list endpoint ---');
  const sharesListB = await (await fetch(`${BASE}/wishlist/shares`, { headers: { 'Authorization': `Bearer ${tokenB}` } })).json();
  assert(sharesListB.data.sharedWithMe.length >= 1, 'User B shares list shows looks shared with them');

  const sharesListA = await (await fetch(`${BASE}/wishlist/shares`, { headers: { 'Authorization': `Bearer ${tokenA}` } })).json();
  assert(sharesListA.data.sharedByMe.length >= 1, 'User A shares list shows looks shared by them');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkflow().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
