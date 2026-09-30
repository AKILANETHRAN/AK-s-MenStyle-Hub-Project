import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../config/stylehub.sqlite');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-reaction';
const SCREENSHOT_PATH = path.join(__dirname, '../../shared-reaction-verified.png');

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

// Read share and token info
const shareId = 65;
const tokenB = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjk2MiwiZW1haWwiOiJyYWh1bF9kZW1vQGV4YW1wbGUuY29tIiwiaWF0IjoxNzkwNjc5Nzk4LCJleHAiOjE3OTA2ODY5OTh9._2PGQbIuKlkqYdh9cfrpR_UnZp8ajYnSLFhUQ3AmoUw";

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
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
    return res.result?.value;
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  }
}

async function runBrowserTest() {
  console.log('--- Launching Headless Chrome via CDP ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--remote-debugging-port=9224',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,900'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  let versionData;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch('http://localhost:9224/json/version');
      versionData = await res.json();
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const targetsRes = await fetch('http://localhost:9224/json/list');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page');

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('\n--- Test 1: Log in as User B (Receiver) ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' });
  await cdp.sleep(1500);

  // Fill in login form
  await cdp.eval(`
    const setReactValue = (el, val) => {
      const proto = Object.getPrototypeOf(el);
      const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
      set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = document.querySelectorAll('input');
    setReactValue(inputs[0], 'rahul_demo@example.com');
    setReactValue(inputs[1], 'Password123!');
    document.querySelector('button[type="submit"]')?.click();
  `);
  await cdp.sleep(2500);

  const afterLoginUrl = await cdp.eval('window.location.href');
  console.log('After login URL:', afterLoginUrl);

  // Navigate to shared look
  await cdp.send('Page.navigate', { url: `http://localhost:5173/shared-wishlist/${shareId}` });
  await cdp.sleep(2000);

  // Verify page title and header metadata
  const pageMetadata = await cdp.eval(`({
    url: window.location.href,
    heading: document.querySelector('h1')?.innerText,
    hasLikeBtn: !!document.querySelector('#reaction-btn-like'),
    hasLoveBtn: !!document.querySelector('#reaction-btn-love'),
    hasFireBtn: !!document.querySelector('#reaction-btn-fire'),
    hasTextarea: !!document.querySelector('#share-feedback-textarea'),
    hasSubmitBtn: !!document.querySelector('#submit-feedback-btn'),
    submitBtnDisabled: document.querySelector('#submit-feedback-btn')?.disabled
  })`);
  console.log('Page metadata:', pageMetadata);

  assert(pageMetadata.hasLikeBtn && pageMetadata.hasLoveBtn && pageMetadata.hasFireBtn,
    '1. Receiver sees reaction buttons: LIKE, LOVE, FIRE');
  assert(pageMetadata.hasTextarea && pageMetadata.hasSubmitBtn,
    '2. Receiver sees feedback textarea and SEND FEEDBACK button');
  assert(pageMetadata.submitBtnDisabled === true,
    '3. SEND FEEDBACK button is initially disabled when textarea is empty');

  console.log('\n--- Test 2: Receiver Clicks LIKE Reaction ---');
  await cdp.eval(`document.querySelector('#reaction-btn-like').click()`);
  await cdp.sleep(1000);

  const likeState = await cdp.eval(`({
    likeText: document.querySelector('#reaction-btn-like')?.innerText,
    hasCheckmark: document.querySelector('#reaction-btn-like')?.innerText.includes('✓'),
    successNotice: document.querySelector('form > div')?.innerText
  })`);
  assert(likeState.hasCheckmark, `4. LIKE button shows selected checkmark: "${likeState.likeText}"`);

  // Verify SQLite row
  const dbLike = db.prepare('SELECT reaction FROM wishlist_feedback WHERE share_id = ? AND user_id = 962').get(shareId);
  assert(dbLike && dbLike.reaction === 'LIKE', '5. SQLite: reaction recorded as LIKE');

  console.log('\n--- Test 3: Receiver Changes Reaction to LOVE ---');
  await cdp.eval(`document.querySelector('#reaction-btn-love').click()`);
  await cdp.sleep(1000);

  const loveState = await cdp.eval(`({
    loveText: document.querySelector('#reaction-btn-love')?.innerText,
    hasCheckmark: document.querySelector('#reaction-btn-love')?.innerText.includes('✓')
  })`);
  assert(loveState.hasCheckmark, `6. LOVE button shows selected checkmark: "${loveState.loveText}"`);

  const dbLove = db.prepare('SELECT reaction FROM wishlist_feedback WHERE share_id = ? AND user_id = 962').get(shareId);
  assert(dbLove && dbLove.reaction === 'LOVE', '7. SQLite: reaction successfully updated to LOVE');

  console.log('\n--- Test 4: Receiver Changes Reaction to FIRE ---');
  await cdp.eval(`document.querySelector('#reaction-btn-fire').click()`);
  await cdp.sleep(1000);

  const fireState = await cdp.eval(`({
    fireText: document.querySelector('#reaction-btn-fire')?.innerText,
    hasCheckmark: document.querySelector('#reaction-btn-fire')?.innerText.includes('✓')
  })`);
  assert(fireState.hasCheckmark, `8. FIRE button shows selected checkmark: "${fireState.fireText}"`);

  const dbFire = db.prepare('SELECT reaction FROM wishlist_feedback WHERE share_id = ? AND user_id = 962').get(shareId);
  assert(dbFire && dbFire.reaction === 'FIRE', '9. SQLite: reaction successfully updated to FIRE');

  console.log('\n--- Test 5: Receiver Types Feedback and Submits ---');
  const commentText = 'Bro this combo looks really sharp.';
  await cdp.eval(`
    const textarea = document.querySelector('#share-feedback-textarea');
    textarea.value = '${commentText}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await cdp.sleep(500);

  const btnActiveState = await cdp.eval(`({
    disabled: document.querySelector('#submit-feedback-btn')?.disabled,
    counterText: document.querySelector('form span')?.innerText
  })`);
  assert(btnActiveState.disabled === false, '10. SEND FEEDBACK button enabled after typing comment');

  await cdp.eval(`document.querySelector('#submit-feedback-btn').click()`);
  await cdp.sleep(1200);

  const dbComment = db.prepare('SELECT comment, reaction FROM wishlist_feedback WHERE share_id = ? AND user_id = 962').get(shareId);
  assert(dbComment && dbComment.comment === commentText && dbComment.reaction === 'FIRE',
    '11. SQLite: Comment persisted and active FIRE reaction preserved');

  // Verify sender notification created
  const notifSender = db.prepare('SELECT * FROM notifications WHERE user_id = 961 AND related_id = ? ORDER BY id DESC').get(shareId);
  assert(notifSender && notifSender.type === 'WISHLIST_FEEDBACK' && notifSender.related_id === shareId,
    '12. Sender A received WISHLIST_FEEDBACK notification with matching shareId');

  console.log('\n--- Test 6: Page Refresh Test ---');
  await cdp.send('Page.reload');
  await cdp.sleep(1500);

  const refreshState = await cdp.eval(`({
    fireSelected: document.querySelector('#reaction-btn-fire')?.innerText.includes('✓'),
    commentVal: document.querySelector('#share-feedback-textarea')?.value,
    renderedComment: Array.from(document.querySelectorAll('p')).some(p => p.innerText.includes('Bro this combo looks really sharp.'))
  })`);

  assert(refreshState.fireSelected, '13. Refresh Persistence: FIRE reaction remains selected after refresh');
  assert(refreshState.renderedComment || refreshState.commentVal.includes('Bro this combo'),
    '14. Refresh Persistence: Feedback comment remains visible after refresh');

  // Capture screenshot of verified page
  await cdp.screenshot(SCREENSHOT_PATH);
  console.log(`Saved screenshot to: ${SCREENSHOT_PATH}`);

  chromeProc.kill();

  console.log(`\n=== Browser CDP Verification: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runBrowserTest().catch(err => {
  console.error('Browser CDP Test Error:', err);
  process.exit(1);
});
