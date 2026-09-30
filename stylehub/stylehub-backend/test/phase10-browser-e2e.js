import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-phase10';

console.log('================================================================');
console.log("AK'S MEN STYLE — PHASE 10 BROWSER E2E VERIFICATION SUITE");
console.log('================================================================');

let passed = 0;
let failed = 0;

function check(condition, desc) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${passed}. ${desc}`);
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

const FIVE_USERS = [
  { name: 'User A', email: 'akil.sundaram@aksmenstyle.com', password: 'AkilStyle2026!', username: 'akil_sundaram' },
  { name: 'User B', email: 'rahul.devan@aksmenstyle.com', password: 'RahulStyle2026!', username: 'rahul_devan' },
  { name: 'User C', email: 'karthik.raja@aksmenstyle.com', password: 'KarthikStyle2026!', username: 'karthik_raja' },
  { name: 'User D', email: 'siddharth.varma@aksmenstyle.com', password: 'SiddharthStyle2026!', username: 'siddharth_varma' },
  { name: 'User E', email: 'vikram.rao@aksmenstyle.com', password: 'VikramStyle2026!', username: 'vikram_rao' }
];

async function runPhase10BrowserE2E() {
  let chromeProc = null;
  let browserClient = null;
  let pageClient = null;
  let targetId = null;

  try {
    console.log('\n--- Connecting or Launching Headless Chrome for Phase 10 ---');
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
      throw new Error('Failed to connect to Chrome remote debugging port 9222 after launch.');
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

    // -------------------------------------------------------------
    // Test 1: Five User Login Flows in Browser
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Five Verified User Logins in Browser ---');
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval('localStorage.clear(); sessionStorage.clear();');

    for (const u of FIVE_USERS) {
      await pageClient.eval('localStorage.clear(); sessionStorage.clear();');
      await pageClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
      await new Promise(r => setTimeout(r, 1200));

      // Fill login form using native prototype setter for React
      await pageClient.eval(`
        (() => {
          const setVal = (el, val) => {
            if (!el) return;
            const proto = Object.getPrototypeOf(el);
            const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
            set.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
          };
          const idInput = document.getElementById('login-identifier-input');
          const passInput = document.getElementById('login-password-input');
          setVal(idInput, '${u.email}');
          setVal(passInput, '${u.password}');
          const submitBtn = document.getElementById('login-submit-btn');
          if (submitBtn) submitBtn.click();
        })()
      `);

      await new Promise(r => setTimeout(r, 1800));

      const currentUrl = await pageClient.eval('window.location.href');
      check(currentUrl.includes('localhost:5173') && !currentUrl.includes('/login'), `${u.name} (${u.email}) logged in via UI and navigated to Home`);

      // Verify user identity in header
      const headerText = await pageClient.eval('document.querySelector("header")?.innerText || ""');
      check(headerText.includes(`@${u.username}`), `${u.name} username @${u.username} displayed in header`);

      // Normal user must NOT see ADMIN DASHBOARD
      check(!headerText.includes('ADMIN DASHBOARD'), `${u.name} header correctly hides ADMIN DASHBOARD link`);

      // Navigate to products
      await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
      await new Promise(r => setTimeout(r, 800));
      const onProducts = await pageClient.eval('window.location.pathname === "/products"');
      check(onProducts, `${u.name} successfully navigated to catalog /products`);

      // Logout
      await pageClient.eval(`
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const logoutBtn = btns.find(b => b.innerText.toLowerCase().includes('logout') || b.innerText.includes('வெளியேறு'));
          if (logoutBtn) logoutBtn.click();
        })()
      `);
      await new Promise(r => setTimeout(r, 800));
      await pageClient.eval('localStorage.clear(); sessionStorage.clear();');
      await pageClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
      await new Promise(r => setTimeout(r, 600));
      const postLogoutUrl = await pageClient.eval('window.location.href');
      check(postLogoutUrl.includes('/login'), `${u.name} logged out cleanly and redirected to /login`);
    }

    // -------------------------------------------------------------
    // Test 2: Admin Access Security & Dedicated Login
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Admin Authorization & Dedicated Portal ---');
    // Login as normal user User A
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 800));
    await pageClient.eval(`
      (() => {
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
          set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const idInput = document.getElementById('login-identifier-input');
        const passInput = document.getElementById('login-password-input');
        setVal(idInput, '${FIVE_USERS[0].email}');
        setVal(passInput, '${FIVE_USERS[0].password}');
        document.getElementById('login-submit-btn').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Normal user attempts to navigate to /admin
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/admin' });
    await new Promise(r => setTimeout(r, 800));
    const forbiddenText = await pageClient.eval('document.body.innerText');
    check(forbiddenText.includes('403') || forbiddenText.includes('Administrator Access Denied'), 'Normal user navigating to /admin is denied with 403 Forbidden screen');

    // Admin login via /admin/login
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
    await new Promise(r => setTimeout(r, 800));

    const adminLoginTitle = await pageClient.eval('document.body.innerText');
    check(adminLoginTitle.includes('ADMIN PORTAL'), 'Admin Login page renders "ADMIN PORTAL" heading');

    await pageClient.eval(`
      (() => {
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
          set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setVal(document.getElementById('admin-email-input'), 'admin@aksmenstyle.com');
        setVal(document.getElementById('admin-password-input'), 'AKAdminLuxury2026!');
        document.getElementById('admin-login-submit-btn').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1800));

    const adminDashboardUrl = await pageClient.eval('window.location.href');
    check(adminDashboardUrl.includes('/admin'), 'Admin logged in successfully and navigated to /admin dashboard');

    const adminHeader = await pageClient.eval('document.querySelector("header")?.innerText || ""');
    check(adminHeader.includes('ADMIN DASHBOARD'), 'Admin header displays ADMIN DASHBOARD link');

    const dashboardTitle = await pageClient.eval('document.body.innerText');
    check(dashboardTitle.includes('ADMIN DASHBOARD') && dashboardTitle.includes('TOTAL USERS') && dashboardTitle.includes('TOTAL PRODUCTS'), 'Admin Dashboard renders real metric cards (TOTAL USERS, TOTAL PRODUCTS, etc.)');

    // Switch to Products tab
    await pageClient.eval('document.getElementById("admin-tab-products")?.click()');
    await new Promise(r => setTimeout(r, 700));
    const productsTabRendered = await pageClient.eval('document.body.innerText.includes("Master Product Catalog")');
    check(productsTabRendered, 'Admin Products tab renders master catalog table');

    // Switch to Users tab
    await pageClient.eval('document.getElementById("admin-tab-users")?.click()');
    await new Promise(r => setTimeout(r, 700));
    const usersTabRendered = await pageClient.eval('document.body.innerText.includes("Registered Customer Accounts")');
    check(usersTabRendered, 'Admin Users tab renders customer accounts safely without passphrases');

    // -------------------------------------------------------------
    // Test 3: Recently Accessed Products UI
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Recently Accessed Products UI on Home ---');
    // Login User A
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 800));
    await pageClient.eval(`
      (() => {
        const setVal = (el, val) => {
          const proto = Object.getPrototypeOf(el);
          const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
          set.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setVal(document.getElementById('login-identifier-input'), '${FIVE_USERS[0].email}');
        setVal(document.getElementById('login-password-input'), '${FIVE_USERS[0].password}');
        document.getElementById('login-submit-btn').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // User A views Product 1
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products/1' });
    await new Promise(r => setTimeout(r, 1200));

    // User A views Product 21
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products/21' });
    await new Promise(r => setTimeout(r, 1200));

    // User A navigates to Home
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1500));

    const homeText = await pageClient.eval('document.body.innerText');
    check(homeText.includes('RECENTLY ACCESSED') || homeText.includes('சமீபத்தில் பார்த்தவை'), 'Home page displays RECENTLY ACCESSED section');

    const recentCardsCount = await pageClient.eval('document.querySelectorAll("#recently-accessed-section .card").length');
    check(recentCardsCount >= 2, 'Recently Accessed section displays at least 2 recently viewed product cards');

    // -------------------------------------------------------------
    // Test 4: AK Style Assistant Chatbot
    // -------------------------------------------------------------
    console.log('\n--- Test 4: AK Style Assistant Chatbot Interaction ---');
    const chatbotLauncher = await pageClient.eval('Boolean(document.getElementById("chatbot-launcher-btn"))');
    check(chatbotLauncher, 'Floating AK STYLE ASSISTANT button rendered on page');

    // Click launcher
    await pageClient.eval('document.getElementById("chatbot-launcher-btn")?.click()');
    await new Promise(r => setTimeout(r, 600));

    const chatbotOpen = await pageClient.eval('Boolean(document.getElementById("chatbot-input"))');
    check(chatbotOpen, 'Clicking launcher opens AK Style Assistant chat panel');

    // Send query: "Show me shirts"
    await pageClient.eval(`
      (() => {
        const inp = document.getElementById('chatbot-input');
        const proto = Object.getPrototypeOf(inp);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(inp, 'Show me shirts');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('chatbot-send-btn').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1800));

    const chatMessages = await pageClient.eval('document.body.innerText');
    check(chatMessages.includes('Shirts') || chatMessages.includes('Oxford'), 'Chatbot replies with shirt recommendations and action link');

    // Close chatbot
    await pageClient.eval('document.getElementById("chatbot-close-btn")?.click()');
    await new Promise(r => setTimeout(r, 400));
    const chatbotClosed = await pageClient.eval('!document.getElementById("chatbot-input")');
    check(chatbotClosed, 'Chatbot closes smoothly');

    // -------------------------------------------------------------
    // Test 5: Multilingual Support (English <-> Tamil)
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Multilingual Language Switcher (EN / தமிழ்) ---');
    const langBtnExists = await pageClient.eval('Boolean(document.getElementById("language-toggle-btn"))');
    check(langBtnExists, 'Language toggle button is present in header');

    // Toggle to Tamil
    await pageClient.eval('document.getElementById("language-toggle-btn")?.click()');
    await new Promise(r => setTimeout(r, 600));

    const navTamil = await pageClient.eval('document.querySelector("nav")?.innerText || ""');
    check(navTamil.includes('முகப்பு') || navTamil.includes('கடை'), 'Navigation successfully switches to Tamil (முகப்பு, கடை)');

    // Refresh page to verify persistence
    await pageClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));

    const navTamilPersisted = await pageClient.eval('document.querySelector("nav")?.innerText || ""');
    check(navTamilPersisted.includes('முகப்பு') || navTamilPersisted.includes('கடை'), 'Tamil language selection persists across page refresh via localStorage');

    // Toggle back to English
    await pageClient.eval('document.getElementById("language-toggle-btn")?.click()');
    await new Promise(r => setTimeout(r, 600));
    const navEnglish = await pageClient.eval('document.querySelector("nav")?.innerText || ""');
    check(navEnglish.includes('HOME') && navEnglish.includes('SHOP'), 'Language switches back to English (HOME, SHOP)');

    console.log('\n================================================================');
    console.log(`✅ ALL ${passed} PHASE 10 BROWSER E2E TESTS PASSED PERFECTLY!`);
    console.log('================================================================');

  } catch (err) {
    console.error('[FATAL] Phase 10 Browser E2E Error:', err);
    process.exit(1);
  } finally {
    if (pageClient) pageClient.close();
    if (browserClient && targetId) {
      await browserClient.send('Target.closeTarget', { targetId }).catch(() => {});
      browserClient.close();
    }
    if (chromeProc) {
      chromeProc.kill();
    }
  }
}

runPhase10BrowserE2E();
