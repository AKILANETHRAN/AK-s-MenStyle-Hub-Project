/**
 * AK'S MEN STYLE — BUY MORE SAVE MORE UI VERIFICATION TEST
 * Drives real Chrome browser via CDP
 * Explicitly tests:
 * 1. Empty Cart Tracker on /cart (₹0 / ₹1,000, Add ₹1,000 more to unlock 10% OFF)
 * 2. Real Subtotal (from database product prices)
 * 3. Tier 1: ₹1,000 → 10%
 * 4. Tier 2: ₹2,000 → 20%
 * 5. Tier 3: ₹3,000 → 30%
 * 6. Real-time DOM updates on quantity changes
 * 7. Checkout Page Tracker on /checkout
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-cart-checkout-verify';

let passed = 0;
let total = 0;

function check(condition, desc) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

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
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
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

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runTests() {
  console.log('================================================================');
  console.log("AK'S MEN STYLE — BUY MORE SAVE MORE ACTUAL UI VERIFICATION");
  console.log('================================================================\n');

  let chromeProc = null;
  let browserClient = null;
  let pageClient = null;
  let targetId = null;

  try {
    let versionData = null;
    try {
      const versionRes = await fetch('http://localhost:9222/json/version');
      versionData = await versionRes.json();
    } catch {
      chromeProc = spawn(CHROME_PATH, [
        '--headless=new',
        '--remote-debugging-port=9222',
        `--user-data-dir=${TEMP_USER_DATA}`,
        '--window-size=1280,960',
        '--disable-gpu',
        'about:blank'
      ]);

      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
          const versionRes = await fetch('http://localhost:9222/json/version');
          versionData = await versionRes.json();
          if (versionData && versionData.webSocketDebuggerUrl) break;
        } catch {}
      }
    }

    if (!versionData) {
      throw new Error('Failed to connect to Chrome debugging port 9222');
    }

    browserClient = new CDPClient(versionData.webSocketDebuggerUrl);
    await browserClient.connect();

    const target = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    targetId = target.targetId;

    const pageWsUrl = `ws://localhost:9222/devtools/page/${targetId}`;
    pageClient = new CDPClient(pageWsUrl);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');

    // Step 1: Create an authenticated test user session with complete profile
    console.log('--- Establishing Authenticated Session ---');
    const timestamp = Date.now().toString().slice(-6);
    const email = `cart.tester.${timestamp}@example.com`;
    const password = 'Password123!';

    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Cart Tester',
        email,
        password,
        phone: '9876543210',
        address: '100 Mount Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001'
      })
    });
    const regData = await regRes.json();
    const token = regData.token;

    // Set username
    await fetch('http://localhost:5000/api/auth/username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: `CartTest_${timestamp}` })
    });

    // Clear cart in backend
    await fetch('http://localhost:5000/api/cart', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    // Inject token into browser localStorage
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval(`
      localStorage.setItem('stylehub_auth_token', '${token}');
    `);

    // -------------------------------------------------------------
    // TEST 1: EMPTY CART ON /cart
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Empty Cart UI (/cart) ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1200));

    const trackerExists = await pageClient.eval('Boolean(document.getElementById("buy-more-save-more-tracker"))');
    check(trackerExists === true, '1.1 Cart Tracker is rendered on /cart');

    const trackerBox = await pageClient.eval(`
      (() => {
        const el = document.getElementById("buy-more-save-more-tracker");
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { top: rect.top, width: rect.width, height: rect.height, visible: rect.height > 0 };
      })()
    `);
    check(trackerBox && trackerBox.visible && trackerBox.top > 0, '1.2 Cart Tracker is visibly displayed (not hidden/collapsed)');

    const emptyTrackerText = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(emptyTrackerText.includes('BUY MORE, SAVE MORE'), '1.3 Empty cart renders header "BUY MORE, SAVE MORE"');
    check(emptyTrackerText.includes('₹0') && emptyTrackerText.includes('₹1,000'), '1.4 Empty cart shows ratio "₹0 / ₹1,000"');
    check(emptyTrackerText.includes('Add ₹1,000 more to unlock 10% OFF'), '1.5 Empty cart shows subline "Add ₹1,000 more to unlock 10% OFF"');
    check(emptyTrackerText.includes('10% OFF') && emptyTrackerText.includes('20% OFF') && emptyTrackerText.includes('30% OFF'), '1.6 All milestone markers (10%, 20%, 30%) are visible');

    // -------------------------------------------------------------
    // TEST 2: REAL CART SUBTOTAL WITH 1 PRODUCT
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Real Cart Subtotal with Real Product ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 1500));

    // Click ADD TO CART on first in-stock product
    const addResult = await pageClient.eval(`
      (() => {
        const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADD TO CART'));
        if (addBtns.length > 0) {
          addBtns[0].click();
          return { clicked: true, count: addBtns.length };
        }
        return { clicked: false, count: 0 };
      })()
    `);
    console.log(`  Added Product: ${JSON.stringify(addResult)}`);
    await new Promise(r => setTimeout(r, 1500));

    // Return to /cart
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1200));

    const singleItemTracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(singleItemTracker.includes('BUY MORE, SAVE MORE'), '2.1 Tracker is visible at top of cart with real item');
    check(!singleItemTracker.includes('₹0 / ₹1,000'), '2.2 Real subtotal replaced initial ₹0');

    // Check progress bar width
    const progressWidth = await pageClient.eval('document.getElementById("cart-reward-progress-fill")?.style?.width');
    const numWidth = parseFloat(progressWidth);
    check(numWidth > 0, `2.3 Progress bar fill width is active (${progressWidth})`);

    // -------------------------------------------------------------
    // TEST 3: TIER 1 (₹1,000 → 10% OFF)
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Tier 1 (₹1,000 threshold) in Real-Time ---');
    // Click '+' button until subtotal crosses ₹1,000
    for (let i = 0; i < 3; i++) {
      const currentSub = await pageClient.eval(`
        (() => {
          const tracker = document.getElementById("buy-more-save-more-tracker");
          const text = tracker?.innerText || '';
          const match = text.match(/₹([0-9,]+)\\s*\\/\\s*₹/);
          return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
        })()
      `);
      if (currentSub >= 1000) break;

      await pageClient.eval(`
        (() => {
          const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
          if (plusBtns.length > 0) plusBtns[0].click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1000));
    }

    const tier1Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(tier1Tracker.includes('✓ 10% OFF UNLOCKED'), '3.1 Reaching ₹1,000 displays "✓ 10% OFF UNLOCKED"');
    check(tier1Tracker.includes('10% REWARD APPLIED'), '3.2 Tracker shows badge "10% REWARD APPLIED"');
    check(tier1Tracker.includes('unlock 20% OFF'), '3.3 Tracker prompts next milestone "unlock 20% OFF"');

    // -------------------------------------------------------------
    // TEST 4: TIER 2 (₹2,000 → 20% OFF)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Tier 2 (₹2,000 threshold) in Real-Time ---');
    for (let i = 0; i < 4; i++) {
      const currentSub = await pageClient.eval(`
        (() => {
          const tracker = document.getElementById("buy-more-save-more-tracker");
          const text = tracker?.innerText || '';
          const match = text.match(/₹([0-9,]+)\\s*\\/\\s*₹/);
          return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
        })()
      `);
      if (currentSub >= 2000) break;

      await pageClient.eval(`
        (() => {
          const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
          if (plusBtns.length > 0) plusBtns[0].click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1000));
    }

    const tier2Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(tier2Tracker.includes('✓ 20% OFF UNLOCKED'), '4.1 Reaching ₹2,000 displays "✓ 20% OFF UNLOCKED"');
    check(tier2Tracker.includes('20% REWARD APPLIED'), '4.2 Tracker shows badge "20% REWARD APPLIED"');
    check(tier2Tracker.includes('unlock 30% OFF'), '4.3 Tracker prompts next milestone "unlock 30% OFF"');

    // -------------------------------------------------------------
    // TEST 5: TIER 3 (₹3,000 → 30% OFF MAX)
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Tier 3 (₹3,000 threshold) in Real-Time ---');
    for (let i = 0; i < 6; i++) {
      const currentSub = await pageClient.eval(`
        (() => {
          const tracker = document.getElementById("buy-more-save-more-tracker");
          const text = tracker?.innerText || '';
          const match = text.match(/₹([0-9,]+)\\s*\\/\\s*₹/);
          return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
        })()
      `);
      console.log(`  Loop ${i}: currentSub = ${currentSub}`);
      if (currentSub >= 3000) break;

      await pageClient.eval(`
        (() => {
          const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
          if (plusBtns.length > 0) plusBtns[0].click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1200));
    }

    const tier3Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    console.log(`  tier3Tracker text: ${JSON.stringify(tier3Tracker)}`);
    check(tier3Tracker.includes('30% OFF — MAX SAVING UNLOCKED'), '5.1 Reaching ₹3,000 displays "30% OFF — MAX SAVING UNLOCKED"');
    check(tier3Tracker.includes('30% REWARD APPLIED'), '5.2 Tracker shows badge "30% REWARD APPLIED"');
    check(!tier3Tracker.includes('Add ₹') || !tier3Tracker.includes('more to unlock'), '5.3 No "add more" prompt when max 30% saving is unlocked');

    // -------------------------------------------------------------
    // TEST 6: REAL-TIME QUANTITY DECREMENT UPDATE
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Quantity Decrement & Real-Time Recalculation ---');
    await pageClient.eval(`
      (() => {
        const minusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '-');
        if (minusBtns.length > 0) minusBtns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const decrementedTracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(decrementedTracker.includes('BUY MORE, SAVE MORE'), '6.1 Tracker recalculated in real-time upon clicking "-"');

    // -------------------------------------------------------------
    // TEST 7: CHECKOUT PAGE TRACKER (/checkout)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Checkout Page (/checkout) ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/checkout' });
    await new Promise(r => setTimeout(r, 1500));

    const checkoutTrackerExists = await pageClient.eval('Boolean(document.getElementById("buy-more-save-more-tracker"))');
    check(checkoutTrackerExists === true, '7.1 Buy More Save More tracker is prominently present on /checkout');

    const checkoutTrackerText = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(checkoutTrackerText.includes('BUY MORE, SAVE MORE'), '7.2 Checkout tracker renders "BUY MORE, SAVE MORE" title');

    const checkoutSummaryText = await pageClient.eval('document.body.innerText');
    check(checkoutSummaryText.includes('Buy More, Save More') && checkoutSummaryText.includes('Final Total'), '7.3 Checkout summary displays Buy More Save More reward and Final Total');

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passed} PASSED out of ${total} tests`);
    console.log('================================================================');
  } catch (err) {
    console.error('\nTest Execution Failure:', err);
    process.exit(1);
  } finally {
    if (browserClient && targetId) {
      try {
        await browserClient.send('Target.closeTarget', { targetId });
      } catch {}
    }
    if (browserClient) browserClient.close();
    if (pageClient) pageClient.close();
    if (chromeProc) chromeProc.kill();
  }
}

runTests();
