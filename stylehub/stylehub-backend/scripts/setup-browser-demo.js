import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const passwordHash = bcrypt.hashSync('Password123!', 10);
const secret = getJwtSecret();

// Setup Rahul (receiver) and Akil (sender)
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (961, 'akil_demo', 'Akil Demo', 'akil_demo@example.com', ?),
         (962, 'rahul_demo', 'Rahul Demo', 'rahul_demo@example.com', ?)
`).run(passwordHash, passwordHash);

// Accept friendship
db.prepare('DELETE FROM friendships WHERE requester_id IN (961, 962) OR receiver_id IN (961, 962)').run();
db.prepare(`
  INSERT INTO friendships (requester_id, receiver_id, status)
  VALUES (961, 962, 'ACCEPTED')
`).run();

// Clean existing shares between them
db.prepare('DELETE FROM wishlist_shares WHERE sender_id IN (961, 962) OR receiver_id IN (961, 962)').run();

// Share Product 1 (Classic Oxford White Button-Down Shirt)
const shareResult = db.prepare(`
  INSERT INTO wishlist_shares (sender_id, receiver_id, share_type)
  VALUES (961, 962, 'PRODUCTS')
`).run();
const shareId = shareResult.lastInsertRowid;

db.prepare(`
  INSERT INTO wishlist_share_items (share_id, product_id)
  VALUES (?, 1)
`).run(shareId);

const tokenB = jwt.sign({ userId: 962, email: 'rahul_demo@example.com' }, secret, { expiresIn: '2h' });

console.log(JSON.stringify({
  shareId,
  receiverUsername: 'rahul_demo',
  tokenB,
  url: `http://localhost:5173/shared-wishlist/${shareId}`
}));
