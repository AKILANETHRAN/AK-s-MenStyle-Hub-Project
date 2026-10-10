import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-login-home';

console.log('================================================================');
console.log("AK'S MEN STYLE — LOGIN & NEW HOME PAGE BROWSER E2E VERIFICATION");
console.log('================================================================');

let passed = 0;
let failed = 0;

function check(condition, desc) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${desc}`);
  } else {
    failed++;
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
    return res?.result?.value;
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runBrowserE2E() {
  let browserClient = null;
  let pageClient = null;
  let targetId = null;
  let chromeProc = null;

  try {
    // 1. Ensure test user exists in DB
    const testUsername = 'aks_e2e_home_user';
    const testPassword = 'Password123!';
    let u = db.prepare('SELECT id FROM users WHERE username = ?').get(testUsername);
    if (!u) {
      const hash = await bcrypt.hash(testPassword, 10);
      const ins = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, phone, address, city, state, pincode)
        VALUES (?, 'aks_e2e@aksmenstyle.test', ?, 'Aks E2E User', '9876543210', '123 Fashion Way', 'Mumbai', 'MH', '400001')
      `).run(testUsername, hash);
      u = { id: ins.lastInsertRowid };
    }

    // Connect to running Chrome on 9222 or launch
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
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 400));
        try {
          const res = await fetch('http://localhost:9222/json/version');
          versionData = await res.json();
          if (versionData && versionData.webSocketDebuggerUrl) break;
        } catch {}
      }
    }
    const wsUrl = versionData.webSocketDebuggerUrl;

    browserClient = new CDPClient(wsUrl);
    await browserClient.connect();

    // Create target page
    const target = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    targetId = target.targetId;

    const pageWsUrl = `ws://localhost:9222/devtools/page/${targetId}`;
    pageClient = new CDPClient(pageWsUrl);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');

    // ----------------------------------------------------------------
    // TEST 1: Unauthenticated Navigation to Root (http://localhost:5173/)
    // ----------------------------------------------------------------
    console.log('\n--- Test 1: Login Must Be First (Unauthenticated) ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1000));
    await pageClient.eval('localStorage.clear(); sessionStorage.clear();');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 2000));

    const currentUrl1 = await pageClient.eval('window.location.href');
    check(currentUrl1.includes('/login'), `1. Root navigation http://localhost:5173/ immediately redirects to /login (Current: ${currentUrl1})`);

    // Verify document title
    const docTitle = await pageClient.eval('document.title');
    check(docTitle.includes("AK'S MEN STYLE"), `2. Document title is "${docTitle}" (Contains AK'S MEN STYLE)`);

    // Verify Login Page Elements & Editorial Copy
    const pageText = await pageClient.eval('document.body.innerText');
    check(pageText.includes('YOUR STYLE.') && pageText.includes('YOUR FIT.') && pageText.includes('YOUR CHOICE.'),
      '3. Login headline rendered: "YOUR STYLE. YOUR FIT. YOUR CHOICE."');
    check(pageText.includes("Discover refined men's fashion, visualize your fit"),
      '4. Login supporting statement accurately presented');
    check(pageText.includes('LOGIN') && pageText.includes('CREATE ACCOUNT'),
      '5. Login CTA and Create Account link visible');

    // ----------------------------------------------------------------
    // TEST 2: Perform Login
    // ----------------------------------------------------------------
    console.log('\n--- Test 2: Login Authentication & Redirection ---');
    await pageClient.eval(`
      const setReactValue = (el, val) => {
        const proto = Object.getPrototypeOf(el);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      setReactValue(inputs[0], '${testUsername}');
      setReactValue(inputs[1], '${testPassword}');
    `);

    await pageClient.eval(`
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    `);
    await new Promise(r => setTimeout(r, 2500));

    const loggedInUrl = await pageClient.eval('window.location.href');
    check(!loggedInUrl.includes('/login'), `6. Successfully authenticated and navigated away from /login (Current: ${loggedInUrl})`);

    // ----------------------------------------------------------------
    // TEST 3: Advanced New Home Page Verification
    // ----------------------------------------------------------------
    console.log('\n--- Test 3: New Professional Home Page Structure & Feature Hints ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/home' });
    await new Promise(r => setTimeout(r, 1500));

    const homeUrl = await pageClient.eval('window.location.href');
    check(homeUrl.includes('/home') || homeUrl === 'http://localhost:5173/', '7. /home canonical route opens Home Page');

    const homeText = await pageClient.eval('document.body.innerText');
    
    // Check Hero
    check(homeText.includes("AK'S") && homeText.includes('MEN STYLE'), '8. Hero brand AK\'S MEN STYLE prominently displayed');
    check(homeText.includes('YOUR STYLE.') && homeText.includes('YOUR FIT.') && homeText.includes('YOUR CHOICE.'), '9. Hero tag line displayed');
    check(homeText.includes('EXPLORE COLLECTION') && homeText.includes('TRY VIRTUAL FITTING'), '10. Hero CTA buttons present');

    // Check Feature Hints (Req 9)
    check(homeText.includes('AI VIRTUAL TRY-ON'), '11. FEATURE 1: "AI VIRTUAL TRY-ON" hint present');
    check(homeText.includes('COMPLETE THE LOOK'), '12. FEATURE 2: "COMPLETE THE LOOK" hint present');
    check(homeText.includes('STYLE WITH FRIENDS'), '13. FEATURE 3: "STYLE WITH FRIENDS" hint present');
    check(homeText.includes('PERSONAL WISHLIST'), '14. FEATURE 4: "PERSONAL WISHLIST" hint present');
    check(homeText.includes('DIRECT PURCHASE'), '15. FEATURE 5: "DIRECT PURCHASE" hint present');

    // Check Curated Collection & Highlights
    check(homeText.includes('CURATED COLLECTION'), '16. Curated Collection showcase section present');
    check(homeText.includes('NEURAL TRY-ON STUDIO'), '17. Virtual Fitting highlight section present');
    check(homeText.includes('PRIVATE SOCIAL CIRCLE'), '18. Style with Friends highlight section present');

    // ----------------------------------------------------------------
    // TEST 4: Logout Flow
    // ----------------------------------------------------------------
    console.log('\n--- Test 4: Logout Redirection ---');
    await pageClient.eval(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const logoutBtn = buttons.find(b => b.innerText.includes('LOGOUT') || b.innerText.includes('Logout'));
      if (logoutBtn) logoutBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1500));

    const postLogoutUrl = await pageClient.eval('window.location.href');
    check(postLogoutUrl.includes('/login'), `19. Clicking Logout immediately redirects to /login (Current: ${postLogoutUrl})`);

    // ----------------------------------------------------------------
    // TEST 5: Manual Navigation to Protected Routes Without Login
    // ----------------------------------------------------------------
    console.log('\n--- Test 5: Manual Navigation Protection ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 1000));
    const protUrl1 = await pageClient.eval('window.location.href');
    check(protUrl1.includes('/login'), '20. Manual navigation to /products without auth redirects to /login');

    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/profile' });
    await new Promise(r => setTimeout(r, 1000));
    const protUrl2 = await pageClient.eval('window.location.href');
    check(protUrl2.includes('/login'), '21. Manual navigation to /profile without auth redirects to /login');

    console.log('\n================================================================');
    console.log(`✅ LOGIN & HOME BROWSER E2E: ALL ${passed} TESTS PASSED PERFECTLY!`);
    console.log('================================================================');

  } catch (err) {
    console.error(`\n❌ BROWSER E2E TEST FAILED (${passed} passed, ${failed} failed):`, err);
    process.exit(1);
  } finally {
    if (pageClient) pageClient.close();
    if (browserClient && targetId) {
      try {
        await browserClient.send('Target.closeTarget', { targetId });
      } catch (e) {}
      browserClient.close();
    }
    if (chromeProc) {
      try { chromeProc.kill(); } catch (e) {}
    }
  }
}

runBrowserE2E();
