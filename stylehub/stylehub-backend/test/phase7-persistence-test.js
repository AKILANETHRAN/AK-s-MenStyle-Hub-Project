import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

console.log('=== AK\'s MEN STYLE — Phase 7: Database Persistence Across Restarts ===\n');

// Step 1: Open DB connection 1, insert test friendship, share, feedback, notification
const db1 = new Database(DB_PATH);
db1.pragma('foreign_keys = ON');

db1.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (951, 'pers_user_a', 'Persistence A', 'pers_a@example.com', 'hash_pers_a'),
         (952, 'pers_user_b', 'Persistence B', 'pers_b@example.com', 'hash_pers_b')
`).run();

// Clean prior persistence test data
db1.prepare('DELETE FROM friendships WHERE requester_id = 951 AND receiver_id = 952').run();
db1.prepare('DELETE FROM wishlist_shares WHERE sender_id = 951 AND receiver_id = 952').run();
db1.prepare('DELETE FROM notifications WHERE user_id = 952').run();

// Ensure wishlist for 951
let wl = db1.prepare('SELECT id FROM wishlists WHERE user_id = 951').get();
if (!wl) {
  const info = db1.prepare('INSERT INTO wishlists (user_id) VALUES (951)').run();
  wl = { id: info.lastInsertRowid };
}

// 1. Create Friendship
const fInfo = db1.prepare(`
  INSERT INTO friendships (requester_id, receiver_id, status)
  VALUES (951, 952, 'ACCEPTED')
`).run();
const friendshipId = fInfo.lastInsertRowid;

// 2. Create Wishlist Share
const sInfo = db1.prepare(`
  INSERT INTO wishlist_shares (wishlist_id, sender_id, receiver_id)
  VALUES (?, 951, 952)
`).run(wl.id);
const shareId = sInfo.lastInsertRowid;

db1.prepare(`
  INSERT INTO wishlist_share_items (share_id, product_id)
  VALUES (?, 1), (?, 21)
`).run(shareId, shareId);

// 3. Add Feedback
db1.prepare(`
  INSERT INTO wishlist_feedback (share_id, user_id, reaction, comment)
  VALUES (?, 952, 'FIRE', 'Bro this is fire combo!')
`).run(shareId);

// 4. Create Notification
db1.prepare(`
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (952, 'WISHLIST_SHARED', 'Curated Look Shared', '@pers_user_a shared a curated look with you.')
`).run();

// Close connection 1 (simulating process termination)
db1.close();
console.log('✓ Data written to SQLite and connection closed (simulating backend shutdown).');

// Step 2: Open fresh DB connection 2 (simulating restart)
const db2 = new Database(DB_PATH);
db2.pragma('foreign_keys = ON');

const savedFriendship = db2.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId);
const savedShare = db2.prepare('SELECT * FROM wishlist_shares WHERE id = ?').get(shareId);
const savedShareItems = db2.prepare('SELECT * FROM wishlist_share_items WHERE share_id = ?').all(shareId);
const savedFeedback = db2.prepare('SELECT * FROM wishlist_feedback WHERE share_id = ?').all(shareId);
const savedNotifications = db2.prepare('SELECT * FROM notifications WHERE user_id = 952').all();

db2.close();

let ok = true;
if (savedFriendship && savedFriendship.status === 'ACCEPTED') {
  console.log('[PASS] 1. Friendship persists across restarts with status ACCEPTED');
} else {
  console.error('[FAIL] 1. Friendship not found or status corrupted');
  ok = false;
}

if (savedShare && savedShare.sender_id === 951 && savedShare.receiver_id === 952 && savedShareItems.length === 2) {
  console.log('[PASS] 2. Wishlist share and selective items persist across restarts');
} else {
  console.error('[FAIL] 2. Wishlist share corrupted');
  ok = false;
}

if (savedFeedback.length === 1 && savedFeedback[0].reaction === 'FIRE' && savedFeedback[0].comment === 'Bro this is fire combo!') {
  console.log('[PASS] 3. Friend opinion/feedback persists across restarts');
} else {
  console.error('[FAIL] 3. Feedback corrupted');
  ok = false;
}

if (savedNotifications.length > 0 && savedNotifications[0].type === 'WISHLIST_SHARED') {
  console.log('[PASS] 4. Notifications persist across restarts');
} else {
  console.error('[FAIL] 4. Notifications corrupted');
  ok = false;
}

if (ok) {
  console.log('\n=== All Phase 7 Persistence Checks Passed Successfully! ===\n');
  process.exit(0);
} else {
  process.exit(1);
}
