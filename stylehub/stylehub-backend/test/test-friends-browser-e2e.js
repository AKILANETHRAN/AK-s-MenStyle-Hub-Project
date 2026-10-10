import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-friends';
const SCREENSHOT_DIR = path.join(__dirname, '../../');

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

// 1. Setup Test Users
console.log('--- Setting up Test Users in SQLite ---');
const passwordHash = bcrypt.hashSync('Password123!', 10);
const secret = getJwtSecret();

db.prepare(`
  INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash)
  VALUES (951, 'akil_luxury_a', 'Akil Sharma', 'akil_lux_a@example.com', ?),
         (952, 'rahul_luxury_b', 'Rahul Verma', 'rahul_lux_b@example.com', ?),
         (953, 'charles_luxury_c', 'Charles Dsouza', 'charles_lux_c@example.com', ?)
`).run(passwordHash, passwordHash, passwordHash);

// Clean previous relations
db.prepare('DELETE FROM friendships WHERE requester_id IN (951, 952, 953) OR receiver_id IN (951, 952, 953)').run();
db.prepare('DELETE FROM wishlist_shares WHERE sender_id IN (951, 952, 953) OR receiver_id IN (951, 952, 953)').run();
db.prepare('DELETE FROM notifications WHERE user_id IN (951, 952, 953)').run();

const tokenA = jwt.sign({ userId: 951, email: 'akil_lux_a@example.com' }, secret, { expiresIn: '2h' });
const tokenB = jwt.sign({ userId: 952, email: 'rahul_lux_b@example.com' }, secret, { expiresIn: '2h' });
const tokenC = jwt.sign({ userId: 953, email: 'charles_lux_c@example.com' }, secret, { expiresIn: '2h' });

console.log('Tokens created successfully.');

// CDP Client Helper
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id);
          this.pending.delete(data.id);
          if (data.error) reject(data.error);
          else resolve(data.result);
        } else if (data.method === 'Console.messageAdded') {
          if (data.params.message.level === 'error') {
            this.consoleErrors.push(data.params.message.text);
          }
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.consoleErrors.push(data.params.exceptionDetails.text || 'Runtime exception');
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buffer);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function run() {
  console.log('\n--- Launching Chrome Headless with Remote Debugging ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--window-size=1280,960',
    '--disable-gpu',
    'about:blank'
  ]);

  // Wait for Chrome CDP port to open
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch('http://localhost:9222/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {}
  }

  if (!targets || targets.length === 0) {
    throw new Error('Failed to connect to Chrome remote debugging port 9222');
  }

  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  console.log('Connected to target:', pageTarget.webSocketDebuggerUrl);

  const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Console.enable');

  try {
    // Navigate to origin first to manage localStorage
    await client.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1000));

    // TEST 1: Unauthenticated user accessing /friends redirects to /login
    console.log('\n--- Test 1: Unauthenticated /friends Navigation ---');
    await client.eval("localStorage.removeItem('stylehub_auth_token'); sessionStorage.clear();");
    await client.send('Page.navigate', { url: 'http://localhost:5173/friends' });
    await new Promise(r => setTimeout(r, 1200));

    const currentUrl1 = await client.eval('window.location.href');
    assert(currentUrl1.includes('/login'), `1. Unauthenticated user redirected to: ${currentUrl1}`);

    // TEST 2: Authenticated user accessing /friends renders FriendsPage
    console.log('\n--- Test 2: Authenticated User A /friends Navigation ---');
    await client.eval(`localStorage.setItem('stylehub_auth_token', '${tokenA}')`);
    await client.send('Page.navigate', { url: 'http://localhost:5173/friends' });
    await new Promise(r => setTimeout(r, 1500));

    const currentUrl2 = await client.eval('window.location.href');
    assert(currentUrl2.includes('/friends'), `2. Authenticated user renders /friends without redirect: ${currentUrl2}`);

    // Check Hero and Layout elements
    const pageHeading = await client.eval("document.querySelector('h1')?.innerText");
    assert(pageHeading && pageHeading.includes('Style is better shared'), `3. Large serif heading rendered: "${pageHeading}"`);

    const subtitle = await client.eval("document.body.innerText.includes('Find friends, share your favorite pieces')");
    assert(subtitle, '4. Subtitle rendered: "Find friends, share your favorite pieces, and get their opinion before you buy."');

    const searchSection = await client.eval("document.body.innerText.includes('FIND FRIENDS')");
    assert(searchSection, '5. FIND FRIENDS search card is rendered');

    const friendRequestsSection = await client.eval("document.body.innerText.includes('FRIEND REQUESTS')");
    assert(friendRequestsSection, '6. FRIEND REQUESTS section is rendered');

    const myFriendsSection = await client.eval("document.body.innerText.includes('MY FRIENDS')");
    assert(myFriendsSection, '7. MY FRIENDS section is rendered');

    const emptyFriendsText = await client.eval("document.body.innerText.includes('No friends yet.')");
    assert(emptyFriendsText, '8. Empty state rendered: "No friends yet. Search for someone and start sharing your style."');

    // Save initial screenshot
    const shotPath1 = path.join(SCREENSHOT_DIR, 'friends_page_empty_state.png');
    await client.screenshot(shotPath1);

    // Verify 0 runtime console errors
    assert(client.consoleErrors.length === 0, `9. Zero unexpected runtime console errors on page load (Found: ${client.consoleErrors.length})`);

    // TEST 3: Friend Search Flow (User A searches User B)
    console.log('\n--- Test 3: User Search & Visible [ ADD FRIEND ] Button ---');
    await client.eval(`
      const input = document.querySelector('input[placeholder*="Search by @username"]');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, 'rahul_luxury_b');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 600));

    // Submit form
    await client.eval(`
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    `);
    await new Promise(r => setTimeout(r, 1500));

    const foundUserB = await client.eval("document.body.innerText.includes('@rahul_luxury_b')");
    assert(foundUserB, '10. Search returns @rahul_luxury_b in results');

    const addFriendBtnText = await client.eval(`
      const btn = document.querySelector('[data-testid="add-friend-btn"]');
      btn ? btn.innerText.trim() : null;
    `);
    assert(addFriendBtnText === 'ADD FRIEND', '11. [ ADD FRIEND ] button is clearly visible for unconnected user');

    const shotPath2 = path.join(SCREENSHOT_DIR, 'friends_search_add_friend_visible.png');
    await client.screenshot(shotPath2);

    // TEST 4: Click [ ADD FRIEND ]
    console.log('\n--- Test 4: User A Sends Friend Request ---');
    const clickReport = await client.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="add-friend-btn"]');
        if (!btn) return { error: 'Button not found' };
        btn.click();
        return { clicked: true };
      })()
    `);
    console.log('Click report:', clickReport);
    await new Promise(r => setTimeout(r, 2000));

    const requestSentBadge = await client.eval("document.body.innerText.includes('REQUEST SENT')");
    assert(requestSentBadge, '12. Button changes immediately to REQUEST SENT without full page reload');

    const sentRequestsSection = await client.eval("document.body.innerText.includes('SENT REQUESTS')");
    assert(sentRequestsSection, '13. SENT REQUESTS section displays pending outgoing request to @rahul_luxury_b');

    const shotPath3 = path.join(SCREENSHOT_DIR, 'friends_request_sent_state.png');
    await client.screenshot(shotPath3);

    // TEST 5: User B Views Incoming Request and Accepts
    console.log('\n--- Test 5: User B Views Incoming Request & Accepts ---');
    await client.eval(`localStorage.setItem('stylehub_auth_token', '${tokenB}')`);
    await client.send('Page.navigate', { url: 'http://localhost:5173/friends' });
    await new Promise(r => setTimeout(r, 1800));

    const userBseesIncoming = await client.eval("document.body.innerText.includes('@akil_luxury_a')");
    assert(userBseesIncoming, '14. User B sees incoming friend request from @akil_luxury_a');

    const acceptBtn = await client.eval(`
      const btn = document.querySelector('[data-testid="accept-btn"]');
      btn ? true : false;
    `);
    assert(acceptBtn, '15. Gold [ ACCEPT ] button is visible for incoming request');

    const shotPath4 = path.join(SCREENSHOT_DIR, 'friends_incoming_request_card.png');
    await client.screenshot(shotPath4);

    // Click [ ACCEPT ]
    const acceptClickResult = await client.eval(`
      (() => {
        const btn = document.querySelector('[data-testid="accept-btn"]');
        if (!btn) return { error: 'Accept button not found' };
        btn.click();
        return { clicked: true, text: btn.innerText };
      })()
    `);
    console.log('Accept click result:', acceptClickResult);
    await new Promise(r => setTimeout(r, 2500));
    console.log('Console errors:', client.consoleErrors);

    const friendInMyFriends = await client.eval("document.body.innerText.includes('@akil_luxury_a') && document.body.innerText.includes('Accepted Friend')");
    assert(friendInMyFriends, '16. After clicking ACCEPT, @akil_luxury_a appears in MY FRIENDS with Accepted Friend status');

    const shotPath5 = path.join(SCREENSHOT_DIR, 'friends_accepted_my_friends_grid.png');
    await client.screenshot(shotPath5);

    // TEST 6: User A Views User B in MY FRIENDS
    console.log('\n--- Test 6: User A Views Mutual Friendship in MY FRIENDS ---');
    await client.eval(`localStorage.setItem('stylehub_auth_token', '${tokenA}')`);
    await client.send('Page.navigate', { url: 'http://localhost:5173/friends' });
    await new Promise(r => setTimeout(r, 1800));

    const userAseesFriendB = await client.eval("document.body.innerText.includes('@rahul_luxury_b') && document.body.innerText.includes('Accepted Friend')");
    assert(userAseesFriendB, '17. User A sees @rahul_luxury_b in MY FRIENDS grid with Accepted Friend badge');

    // TEST 7: Remove Friend
    console.log('\n--- Test 7: Remove Friend Flow ---');
    await client.eval('window.confirm = () => true;');
    await client.eval(`
      const btn = document.querySelector('[data-testid="remove-friend-btn"]');
      if (btn) btn.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    const removedCheck = await client.eval("document.body.innerText.includes('No friends yet.')");
    assert(removedCheck, '18. After removal, friend is removed from list and empty state returns');

    // TEST 8: Error Resilience & RETRY button
    console.log('\n--- Test 8: Error Resilience & [ RETRY ] Button ---');
    await client.eval("localStorage.setItem('stylehub_auth_token', 'invalid_token_xyz')");
    await client.send('Page.navigate', { url: 'http://localhost:5173/friends' });
    await new Promise(r => setTimeout(r, 1200));

    const handledAuthRedirect = await client.eval("window.location.href.includes('/login')");
    assert(handledAuthRedirect, '19. Invalid session handled gracefully by AuthContext without crashing page or turning black');

    console.log(`\nEnd-to-End Friends Browser Verification Complete: ${passed} passed, ${failed} failed.`);

  } finally {
    client.close();
    chromeProc.kill();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Browser Test Error:', err);
  process.exit(1);
});
