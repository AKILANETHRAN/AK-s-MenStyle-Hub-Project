import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-onboarding-cart';

console.log('================================================================');
console.log("AK'S MEN STYLE — USERNAME ONBOARDING & BUY MORE SAVE MORE BROWSER E2E");
console.log('================================================================');

let passed = 0;
let total = 0;

function check(condition, desc) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${passed}. ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
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

async function runBrowserE2E() {
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
      throw new Error('Failed to connect to Chrome remote debugging port 9222.');
    }

    const wsUrl = versionData.webSocketDebuggerUrl;
    browserClient = new CDPClient(wsUrl);
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
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval('localStorage.clear(); sessionStorage.clear();');

    // -------------------------------------------------------------
    // PART 1: Fresh User Registration & Onboarding Redirection
    // -------------------------------------------------------------
    console.log('\n--- 1. Fresh User Registration (No Auto-Generated Username) ---');
    const timestamp = Date.now().toString().slice(-6);
    const freshEmail = `shopper_${timestamp}@example.com`;
    const freshPassword = 'Password123!';
    const chosenUsername = `Akil_${timestamp}`;

    // Register via UI
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

        setVal(nameInput, 'Akil New Shopper');
        setVal(emailInput, '${freshEmail}');
        setVal(passInput, '${freshPassword}');
        setVal(confirmPassInput, '${freshPassword}');
        setVal(phoneInput, '9876543210');
        setVal(addressInput, '77 Bespoke Avenue');
        setVal(cityInput, 'Chennai');
        setVal(stateInput, 'Tamil Nadu');
        setVal(pincodeInput, '600028');

        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 2000));

    // Must be redirected to /set-username
    const postRegUrl = await pageClient.eval('window.location.pathname');
    check(postRegUrl === '/set-username', '1.1 Fresh registration immediately routes to /set-username');

    // -------------------------------------------------------------
    // PART 2: Set Username Page Validation & Identity Selection
    // -------------------------------------------------------------
    console.log('\n--- 2. Set Username Page Validation & Submission ---');
    const pageText = await pageClient.eval('document.body.innerText');
    check(pageText.includes('CHOOSE YOUR IDENTITY'), '2.1 Page renders luxury heading: CHOOSE YOUR IDENTITY');
    check(pageText.includes('SET YOUR USERNAME'), '2.2 Page renders badge: SET YOUR USERNAME');
    check(pageText.includes('Pick the username your friends will see'), '2.3 Page renders subheading');

    // Test case-insensitive duplicate username validation
    await pageClient.eval(`
      (() => {
        const input = document.getElementById('username-input');
        const proto = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(input, 'akil_sundaram');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const dupMsg = await pageClient.eval('document.body.innerText');
    check(dupMsg.includes('already taken'), '2.4 Duplicate username (case-insensitive) shows "already taken" validation');

    // Enter unique valid username
    await pageClient.eval(`
      (() => {
        const input = document.getElementById('username-input');
        const proto = Object.getPrototypeOf(input);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(input, '${chosenUsername}');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const availMsg = await pageClient.eval('document.body.innerText');
    check(availMsg.includes('Username is available'), '2.5 Valid username reports "Username is available."');
    check(availMsg.includes(`@${chosenUsername}`), `2.6 Live preview shows @${chosenUsername}`);

    // Click CONTINUE
    await pageClient.eval(`
      (() => {
        const btn = document.getElementById('continue-username-btn');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1800));

    const postUsernameUrl = await pageClient.eval('window.location.pathname');
    check(postUsernameUrl === '/' || postUsernameUrl === '/home', '2.7 Submitting username navigates to Home');

    const headerContent = await pageClient.eval('document.querySelector("header")?.innerText || ""');
    check(headerContent.includes(`@${chosenUsername}`), `2.8 Header displays chosen identity: @${chosenUsername}`);

    // -------------------------------------------------------------
    // PART 3: Shop & Add Product 1 to Cart
    // -------------------------------------------------------------
    console.log('\n--- 3. Shop & Buy More, Save More Live Cart Tracker ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 1500));

    // Click Add to Cart for Product 1 (₹520)
    await pageClient.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADD TO CART'));
        if (btns[0]) btns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    // Navigate to /cart
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1500));

    const cartHtml = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText || ""');
    check(cartHtml.includes('BUY MORE, SAVE MORE'), '3.1 Cart renders BUY MORE, SAVE MORE progress tracker');
    check(cartHtml.includes('10% OFF'), '3.2 Milestone 1 (10% OFF at ₹1,000) marker present');
    check(cartHtml.includes('20% OFF'), '3.3 Milestone 2 (20% OFF at ₹2,000) marker present');
    check(cartHtml.includes('30% OFF'), '3.4 Milestone 3 (30% OFF at ₹3,000) marker present');

    // -------------------------------------------------------------
    // PART 4: Real-time Quantity Changes & Milestone Unlocking
    // -------------------------------------------------------------
    console.log('\n--- 4. Live Quantity Adjustments & Tier Milestones ---');
    
    // Increase quantity of Product 1 to 2 (2 * 520 = ₹1,040) -> reaches Tier 1 (>= ₹1,000)
    await pageClient.eval(`
      (() => {
        const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
        if (plusBtns[0]) plusBtns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const tier1Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText || ""');
    check(tier1Tracker.includes('TIER 1 UNLOCKED') || tier1Tracker.includes('10% REWARD APPLIED'), 
      '4.1 Reached >= ₹1,000: Tier 1 Unlocked (10% Off applied live)');

    // Add Product 2 (₹549) and Product 3 (₹639) from catalog
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 1500));

    await pageClient.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADD TO CART'));
        if (btns[1]) btns[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    await pageClient.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('ADD TO CART'));
        if (btns[2]) btns[2].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Return to cart: subtotal = 1040 + 549 + 639 = ₹2,228 (Tier 2 Unlocked >= ₹2,000)
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/cart' });
    await new Promise(r => setTimeout(r, 1500));

    const tier2Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText || ""');
    check(tier2Tracker.includes('TIER 2 UNLOCKED') || tier2Tracker.includes('20% REWARD APPLIED'), 
      '4.2 Reached >= ₹2,000: Tier 2 Unlocked (20% Off applied live)');

    // Increase Product 2 and Product 3 quantities:
    // +1 to Product 2 (+₹549) -> ₹2,777
    // +1 to Product 3 (+₹639) -> ₹3,416 (Tier 3 Unlocked >= ₹3,000)
    await pageClient.eval(`
      (() => {
        const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
        if (plusBtns[1]) plusBtns[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    await pageClient.eval(`
      (() => {
        const plusBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === '+');
        if (plusBtns[2]) plusBtns[2].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const tier3Tracker = await pageClient.eval('document.getElementById("buy-more-save-more-tracker")?.innerText || ""');
    check(tier3Tracker.includes('MAX SAVING UNLOCKED') || tier3Tracker.includes('30% REWARD APPLIED'), 
      '4.3 Reached >= ₹3,000: Tier 3 Unlocked (30% MAX SAVING applied live)');

    // -------------------------------------------------------------
    // PART 5: Checkout Display & Authoritative Purchase Completion
    // -------------------------------------------------------------
    console.log('\n--- 5. Checkout Summary & Final Purchase Verification ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/checkout' });
    await new Promise(r => setTimeout(r, 1800));

    const checkoutText = await pageClient.eval('document.body.innerText');
    check(checkoutText.includes('Buy More, Save More'), '5.1 Checkout page displays Buy More, Save More reward breakdown');
    check(checkoutText.includes('30% OFF'), '5.2 Checkout displays 30% OFF line item deduction');
    check(checkoutText.includes('Final Total'), '5.3 Final Total clearly presented');

    // Click Place Order
    await pageClient.eval(`
      (() => {
        const placeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('PLACE LUXURY ORDER') || b.innerText.includes('ORDER'));
        if (placeBtn) placeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2500));

    const confirmedText = await pageClient.eval('document.body.innerText');
    check(confirmedText.includes('ORDER CONFIRMED') || confirmedText.includes('Thank You for Your Order'),
      '5.4 Purchase successfully executed with ORDER CONFIRMED receipt');

    console.log('\n================================================================');
    console.log(`BROWSER E2E COMPLETE: ${passed} / ${total} PASS (0 FAILURES)`);
    console.log('================================================================');
  } finally {
    if (pageClient) pageClient.close();
    if (browserClient) {
      if (targetId) {
        try { await browserClient.send('Target.closeTarget', { targetId }); } catch {}
      }
      browserClient.close();
    }
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
  }
}

runBrowserE2E().catch(err => {
  console.error('Browser E2E Error:', err);
  process.exit(1);
});
