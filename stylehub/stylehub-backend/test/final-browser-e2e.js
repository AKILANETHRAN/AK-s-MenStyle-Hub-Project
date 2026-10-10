/**
 * AK'S MEN STYLE — FINAL BROWSER E2E TEST
 * Directly drives Chrome via Chrome DevTools Protocol (CDP)
 * Tests all requirements from USER PROMPT:
 * Part A: Manual Username in Profile (no auto-generated username, empty input, live preview, save, refresh persistence)
 * Part B: Real Buy More, Save More Cart Tracker (empty state, ₹1000 threshold, ₹2000 threshold, ₹3000 threshold, real-time quantity updates, checkout purchase)
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-final-e2e';

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
  console.log("AK'S MEN STYLE — FINAL BROWSER E2E TEST RUNNER");
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

    // Clear any previous session
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 800));
    await pageClient.eval('localStorage.clear(); sessionStorage.clear();');

    // -------------------------------------------------------------
    // PART A: Manual Username in Profile
    // -------------------------------------------------------------
    console.log('\n--- PART A: MANUAL USERNAME ONLY IN PROFILE ---');
    const timestamp = Date.now().toString().slice(-6);
    const freshEmail = `browser.user.${timestamp}@example.com`;
    const freshPassword = 'Password123!';
    const chosenUsername = `Akil_${timestamp}`;

    // Register user via UI
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/register' });
    await new Promise(r => setTimeout(r, 1200));

    await pageClient.eval(`
      (() => {
        const setVal = (el, val) => {
          if (!el) return;
          const proto = Object.getPrototypeOf(el);
          const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
          set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const inputs = Array.from(document.querySelectorAll('input'));
        const nameInput = inputs.find(i => i.name === 'fullName');
        const emailInput = inputs.find(i => i.name === 'email');
        const passInput = inputs.find(i => i.name === 'password');
        const confirmPassInput = inputs.find(i => i.name === 'confirmPassword');
        const phoneInput = inputs.find(i => i.name === 'phone');
        const addressInput = inputs.find(i => i.name === 'address');
        const cityInput = inputs.find(i => i.name === 'city');
        const stateInput = inputs.find(i => i.name === 'state');
        const pincodeInput = inputs.find(i => i.name === 'pincode');

        setVal(nameInput, 'Akil Browser User');
        setVal(emailInput, '${freshEmail}');
        setVal(passInput, '${freshPassword}');
        setVal(confirmPassInput, '${freshPassword}');
        setVal(phoneInput, '9876543210');
        setVal(addressInput, '100 Mount Road');
        setVal(cityInput, 'Chennai');
        setVal(stateInput, 'Tamil Nadu');
        setVal(pincodeInput, '600001');

        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 2000));

    // A.1 Verify automatic navigation to /profile
    const currentPath = await pageClient.eval('window.location.pathname');
    check(currentPath === '/profile', 'A.1 New user with no username automatically routes directly to /profile');

    // A.2 Verify username field is initially EMPTY
    const initialInputValue = await pageClient.eval('document.getElementById("profile-username-input")?.value');
    check(initialInputValue === '', 'A.2 Username field in profile is strictly EMPTY for new user');

    const inputPlaceholder = await pageClient.eval('document.getElementById("profile-username-input")?.placeholder');
    check(inputPlaceholder === 'Akil', 'A.3 Username input placeholder is "Akil"');

    // A.4 Type "Akil" and verify live preview shows "@Akil"
    await pageClient.eval(`
      (() => {
        const input = document.getElementById('profile-username-input');
        const proto = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(input, 'Akil');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 400));

    const previewAkil = await pageClient.eval('document.getElementById("profile-username-section")?.innerText');
    check(previewAkil.includes('@Akil'), 'A.4 Typing "Akil" shows live preview "@Akil"');

    // A.5 Check validation message for taken username
    await new Promise(r => setTimeout(r, 400));
    const akilStatus = await pageClient.eval('document.getElementById("profile-username-section")?.innerText');
    const isTaken = akilStatus.includes('Username already exists.');
    console.log(`  Notice: "Akil" is taken in DB: ${isTaken}`);

    // A.6 Enter unique username
    await pageClient.eval(`
      (() => {
        const input = document.getElementById('profile-username-input');
        const proto = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(input, '${chosenUsername}');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const chosenStatus = await pageClient.eval('document.getElementById("profile-username-section")?.innerText');
    check(chosenStatus.includes('Username available.'), 'A.6 Available username reports "Username available."');
    check(chosenStatus.includes(`@${chosenUsername}`), `A.7 Live preview shows @${chosenUsername}`);

    // A.8 Click SAVE USERNAME
    const saveBtnText = await pageClient.eval('document.getElementById("save-username-btn")?.innerText');
    check(saveBtnText.includes('SAVE USERNAME'), 'A.8 Save button has exact label "SAVE USERNAME"');

    await pageClient.eval('document.getElementById("save-username-btn")?.click()');
    await new Promise(r => setTimeout(r, 1800));

    // A.9 Navigates to Home
    const postSavePath = await pageClient.eval('window.location.pathname');
    check(postSavePath === '/' || postSavePath === '/home', 'A.9 Successfully navigates to Home after saving username');

    // A.10 Verify @username is displayed
    const headerText = await pageClient.eval('document.querySelector("header")?.innerText || ""');
    check(headerText.includes(`@${chosenUsername}`), `A.10 Header displays @${chosenUsername}`);

    // A.11 Refresh and verify @username remains
    await pageClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));
    const headerAfterReload = await pageClient.eval('document.querySelector("header")?.innerText || ""');
    check(headerAfterReload.includes(`@${chosenUsername}`), `A.11 @${chosenUsername} remains visible after page refresh`);

    // -------------------------------------------------------------
    // PART B: Real Buy More, Save More Cart Tracker
    // -------------------------------------------------------------
    console.log('\n--- PART B: REAL BUY MORE, SAVE MORE CART TRACKER ---');

    // B.1 Check Cart Page Empty State
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1200));

    const trackerVisible = await pageClient.eval('Boolean(document.getElementById("buy-more-save-more-tracker"))');
    check(trackerVisible === true, 'B.1 BUY MORE, SAVE MORE tracker is visible at top of Cart page');

    const trackerText0 = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(trackerText0.includes('BUY MORE, SAVE MORE'), 'B.2 Tracker renders "BUY MORE, SAVE MORE" title');
    check(trackerText0.includes('₹0') && trackerText0.includes('₹1,000'), 'B.3 Initial ratio is ₹0 / ₹1,000');
    check(trackerText0.includes('Add ₹1,000 more to unlock 10% OFF'), 'B.4 Initial subline is "Add ₹1,000 more to unlock 10% OFF"');

    // B.2 Add Product to Cart directly from /products
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 1500));

    // Click ADD TO CART on the first product card
    await pageClient.eval(`
      (() => {
        const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADD TO CART'));
        if (addBtns.length > 0) addBtns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // B.3 Open /cart and verify tracker with 1 item
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1200));

    const cartText1 = await pageClient.eval('document.body.innerText');
    check(cartText1.includes('BUY MORE, SAVE MORE'), 'B.5 Tracker is prominently visible with item in cart');

    // B.4 Real-time Quantity Changes & Thresholds
    // Increase quantity to reach >= ₹1,000 (Tier 1: 10% OFF)
    console.log('  Testing Tier 1 (₹1,000 threshold)...');
    await pageClient.eval(`
      (() => {
        const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
        if (plusBtns.length > 0) plusBtns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    const cartTextTier1 = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(cartTextTier1.includes('10% OFF UNLOCKED') || cartTextTier1.includes('10% REWARD APPLIED'), 'B.6 Crossing ₹1,000 unlocks 10% OFF reward in real-time');
    check(cartTextTier1.includes('unlock 20% OFF'), 'B.7 Tracker prompts for next milestone: unlock 20% OFF');

    // Increase quantity further to reach >= ₹2,000 (Tier 2: 20% OFF)
    console.log('  Testing Tier 2 (₹2,000 threshold)...');
    for (let i = 0; i < 2; i++) {
      await pageClient.eval(`
        (() => {
          const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
          if (plusBtns.length > 0) plusBtns[0].click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1200));
    }

    const cartTextTier2 = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(cartTextTier2.includes('20% OFF UNLOCKED') || cartTextTier2.includes('20% REWARD APPLIED'), 'B.8 Crossing ₹2,000 unlocks 20% OFF reward in real-time');
    check(cartTextTier2.includes('unlock 30% OFF'), 'B.9 Tracker prompts for next milestone: unlock 30% OFF');

    // Increase quantity further to reach >= ₹3,000 (Tier 3: 30% OFF MAX)
    console.log('  Testing Tier 3 (₹3,000 threshold)...');
    for (let i = 0; i < 2; i++) {
      await pageClient.eval(`
        (() => {
          const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
          if (plusBtns.length > 0) plusBtns[0].click();
        })()
      `);
      await new Promise(r => setTimeout(r, 1200));
    }

    const cartTextTier3 = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText');
    check(cartTextTier3.includes('30% OFF — MAX SAVING UNLOCKED') || cartTextTier3.includes('30% REWARD APPLIED'), 'B.10 Crossing ₹3,000 unlocks 30% OFF MAX saving');

    // Order Summary check
    const summaryText = await pageClient.eval('document.body.innerText');
    check(summaryText.includes('Buy More, Save More (30% OFF)'), 'B.11 Order summary clearly itemizes Buy More, Save More (30% OFF)');

    // B.5 Checkout Integration
    console.log('  Testing Checkout Flow...');
    await pageClient.eval(`
      (() => {
        const checkoutBtn = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('PROCEED TO CHECKOUT'));
        if (checkoutBtn) checkoutBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const checkoutUrl = await pageClient.eval('window.location.pathname');
    check(checkoutUrl === '/checkout', 'B.12 Successfully navigated to /checkout');

    const checkoutText = await pageClient.eval('document.body.innerText');
    check(checkoutText.includes('Buy More, Save More (30% OFF)'), 'B.13 Checkout page shows Buy More, Save More (30% OFF)');
    check(checkoutText.includes('Final Total'), 'B.14 Final Total displayed');

    // Place Order
    await pageClient.eval(`
      (() => {
        const placeBtn = document.getElementById('confirm-checkout-btn');
        if (placeBtn) placeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2500));

    const confirmedText = await pageClient.eval('document.body.innerText');
    check(confirmedText.includes('Thank You for Your Order') || confirmedText.includes('ORDER CONFIRMED'), 'B.15 Order placed and confirmed with 30% Cart Reward');

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passed} PASSED out of ${total} tests`);
    console.log('================================================================');
  } catch (err) {
    console.error('\nE2E Failure:', err);
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
