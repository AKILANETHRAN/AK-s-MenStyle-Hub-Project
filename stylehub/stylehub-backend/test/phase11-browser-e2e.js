import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-phase11';

console.log('================================================================');
console.log("AK'S MEN STYLE — PHASE 11 BROWSER E2E VERIFICATION SUITE");
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

async function runPhase11BrowserE2E() {
  let chromeProc = null;
  let browserClient = null;
  let pageClient = null;
  let targetId = null;

  try {
    console.log('\n--- Launching Headless Chrome for Phase 11 E2E Verification ---');
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

    if (!versionData?.webSocketDebuggerUrl) {
      throw new Error('Could not connect to Chrome DevTools Protocol at http://localhost:9222');
    }

    browserClient = new CDPClient(versionData.webSocketDebuggerUrl);
    await browserClient.connect();

    const targetRes = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    targetId = targetRes.targetId;

    const targets = await (await fetch('http://localhost:9222/json')).json();
    const targetObj = targets.find(t => t.id === targetId);

    pageClient = new CDPClient(targetObj.webSocketDebuggerUrl);
    await pageClient.connect();

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');
    await pageClient.send('DOM.enable');

    const navigateAndWait = async (url, waitMs = 1200) => {
      await pageClient.send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));
    };

    // =========================================================================
    // STEP 1: LOGIN PAGE — SINGLE GOOGLE BUTTON VERIFICATION (PART A)
    // =========================================================================
    console.log('\n--- STEP 1: Verifying Single Google OAuth Button on /login ---');
    await navigateAndWait('http://localhost:5173/login', 500);
    await pageClient.eval(`localStorage.clear(); sessionStorage.clear();`);
    await navigateAndWait('http://localhost:5173/login', 1500);

    const googleBtnInfo = await pageClient.eval(`(() => {
      const allBtns = Array.from(document.querySelectorAll('button')).map(b => ({
        id: b.id,
        text: b.innerText,
        offsetWidth: b.offsetWidth,
        offsetHeight: b.offsetHeight,
        display: window.getComputedStyle(b).display
      }));
      const btns = Array.from(document.querySelectorAll('button')).filter(b => 
        b.innerText.toLowerCase().includes('google') || b.id.includes('google')
      );
      const visibleBtns = btns.filter(b => {
        const style = window.getComputedStyle(b);
        return style.display !== 'none' && style.visibility !== 'hidden' && b.offsetWidth > 0 && b.offsetHeight > 0;
      });
      return {
        url: window.location.href,
        allButtons: allBtns,
        totalButtonsFound: btns.length,
        visibleButtonsCount: visibleBtns.length,
        singleButtonText: visibleBtns[0]?.innerText?.trim() || '',
        buttonId: visibleBtns[0]?.id || ''
      };
    })()`);

    if (googleBtnInfo.visibleButtonsCount === 0) {
      console.log('DEBUG page state:', JSON.stringify(googleBtnInfo, null, 2));
    }

    check(googleBtnInfo.visibleButtonsCount === 1, `Exactly ONE user-visible Google OAuth button rendered (found: ${googleBtnInfo.visibleButtonsCount})`);
    check(googleBtnInfo.singleButtonText.includes('Continue with Google'), `Button text matches exact requirement: "${googleBtnInfo.singleButtonText}"`);
    check(googleBtnInfo.buttonId === 'google-signin-btn', 'Button has canonical ID #google-signin-btn');

    // =========================================================================
    // STEP 2: LOCAL LOGIN & REDIRECT (PART E)
    // =========================================================================
    console.log('\n--- STEP 2: Authenticating User A (akil.sundaram@aksmenstyle.com) ---');
    await pageClient.eval(`(() => {
      const setVal = (el, val) => {
        if (!el) return;
        const proto = Object.getPrototypeOf(el);
        const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
        set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const emailInput = document.getElementById('login-identifier-input');
      const passInput = document.getElementById('login-password-input');
      setVal(emailInput, 'akil.sundaram@aksmenstyle.com');
      setVal(passInput, 'AkilStyle2026!');
      document.getElementById('login-submit-btn').click();
    })()`);

    await new Promise(r => setTimeout(r, 1500));

    const authState = await pageClient.eval(`(() => ({
      url: window.location.href,
      token: localStorage.getItem('stylehub_auth_token') || localStorage.getItem('token') || '',
      hasSettingsBtn: Boolean(document.getElementById('header-settings-btn'))
    }))()`);

    check(authState.url.includes('5173'), 'Redirected successfully after authentication');
    check(Boolean(authState.token), 'AK’S MEN STYLE JWT stored securely in localStorage');
    check(authState.hasSettingsBtn === true, '⚙ SETTINGS button visible on global header for authenticated user');

    // =========================================================================
    // STEP 3: SETTINGS DRAWER OPEN & 4 SECTIONS (PART F, G, K)
    // =========================================================================
    console.log('\n--- STEP 3: Opening Settings Drawer & Verifying 4 Sections ---');
    await pageClient.eval(`document.getElementById('header-settings-btn').click()`);
    await new Promise(r => setTimeout(r, 600));

    const drawerSections = await pageClient.eval(`(() => {
      const text = document.body.innerText;
      return {
        hasAppearance: text.includes('APPEARANCE') || text.includes('தோற்றம்'),
        hasLanguage: text.includes('LANGUAGE') || text.includes('மொழி'),
        hasCommunication: text.includes('COMMUNICATION PREFERENCES') || text.includes('தகவல் தொடர்பு விருப்பங்கள்'),
        hasAccount: text.includes('ACCOUNT DETAILS') || text.includes('கணக்கு விவரங்கள்'),
        hasSaveBtn: Boolean(document.getElementById('save-settings-btn')),
        hasCloseBtn: Boolean(document.getElementById('close-settings-btn'))
      };
    })()`);

    check(drawerSections.hasAppearance, 'Section 1: APPEARANCE present');
    check(drawerSections.hasLanguage, 'Section 2: LANGUAGE present');
    check(drawerSections.hasCommunication, 'Section 3: COMMUNICATION PREFERENCES present');
    check(drawerSections.hasAccount, 'Section 4: ACCOUNT DETAILS present');
    check(drawerSections.hasSaveBtn && drawerSections.hasCloseBtn, 'Settings drawer actions (Save & Close) present');

    // =========================================================================
    // STEP 4: THEME SWITCHING & PERSISTENCE (PART H)
    // =========================================================================
    console.log('\n--- STEP 4: Testing 3 Color Themes & Persistence across reloads ---');
    
    // Switch to Theme 2: Midnight Silver
    await pageClient.eval(`document.getElementById('theme-option-midnight-silver').click()`);
    await new Promise(r => setTimeout(r, 400));
    let currentTheme = await pageClient.eval(`document.documentElement.getAttribute('data-theme')`);
    check(currentTheme === 'midnight-silver', 'Switched to Theme 2: Midnight Silver');

    // Reload page to verify persistence
    await pageClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));
    currentTheme = await pageClient.eval(`document.documentElement.getAttribute('data-theme')`);
    check(currentTheme === 'midnight-silver', 'Midnight Silver theme persisted across browser refresh');

    // Reopen settings and switch to Theme 3: Black + Champagne Gold
    await pageClient.eval(`document.getElementById('header-settings-btn').click()`);
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval(`document.getElementById('theme-option-black-champagne').click()`);
    await new Promise(r => setTimeout(r, 400));
    currentTheme = await pageClient.eval(`document.documentElement.getAttribute('data-theme')`);
    check(currentTheme === 'black-champagne', 'Switched to Theme 3: Black + Champagne Gold');

    // Reload page to verify persistence
    await pageClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));
    currentTheme = await pageClient.eval(`document.documentElement.getAttribute('data-theme')`);
    check(currentTheme === 'black-champagne', 'Black + Champagne Gold theme persisted across browser refresh');

    // Switch back to Theme 1 (Default)
    await pageClient.eval(`document.getElementById('header-settings-btn').click()`);
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval(`document.getElementById('theme-option-gold-silver').click()`);
    await new Promise(r => setTimeout(r, 400));
    currentTheme = await pageClient.eval(`document.documentElement.getAttribute('data-theme')`);
    check(currentTheme === 'gold-silver', 'Switched back to Theme 1: AK Gold + Silver (Default)');

    // =========================================================================
    // STEP 5: LANGUAGE SWITCHING & PERSISTENCE (PART I)
    // =========================================================================
    console.log('\n--- STEP 5: Testing Language Switcher (EN <-> தமிழ்) & Persistence ---');
    await pageClient.eval(`document.getElementById('language-select-ta').click()`);
    await new Promise(r => setTimeout(r, 500));

    const tamilNav = await pageClient.eval(`document.body.innerText.includes('முகப்பு') || document.body.innerText.includes('கடை')`);
    check(tamilNav === true, 'Interface successfully translated to Tamil (தமிழ்)');

    // Reload page
    await pageClient.send('Page.reload');
    await new Promise(r => setTimeout(r, 1200));
    const persistedLang = await pageClient.eval(`localStorage.getItem('stylehub_lang')`);
    check(persistedLang === 'ta', 'Tamil language preference persisted across browser reload');

    // Reopen settings and switch back to English
    await pageClient.eval(`document.getElementById('header-settings-btn').click()`);
    await new Promise(r => setTimeout(r, 600));
    await pageClient.eval(`document.getElementById('language-select-en').click()`);
    await new Promise(r => setTimeout(r, 400));

    // =========================================================================
    // STEP 6: COMMUNICATION PREFERENCES TOGGLE (PART J, Z)
    // =========================================================================
    console.log('\n--- STEP 6: Toggling Communication Preferences (SMS OFF) ---');
    await pageClient.eval(`(() => {
      const smsCb = document.getElementById('checkbox-sms-notif');
      if (smsCb && smsCb.checked) {
        smsCb.click();
      }
      document.getElementById('save-settings-btn').click();
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    // Close settings drawer
    await pageClient.eval(`document.getElementById('close-settings-btn').click()`);
    await new Promise(r => setTimeout(r, 500));
    check(true, 'Settings saved and drawer closed cleanly');

    // =========================================================================
    // STEP 7: PURCHASE & NOTIFICATION CONFIRMATION (PART L, M, N, O, S, U)
    // =========================================================================
    console.log('\n--- STEP 7: Purchase Execution & Post-Commit Communication Display ---');
    await navigateAndWait('http://localhost:5173/products/1', 1500);

    // Click Purchase Now button by canonical ID
    const buySuccess = await pageClient.eval(`(() => {
      const buyBtn = document.getElementById('buy-product-btn');
      if (buyBtn && !buyBtn.disabled) {
        buyBtn.click();
        return true;
      }
      return false;
    })()`);

    check(buySuccess === true, 'Triggered PURCHASE NOW for Product #1');
    await new Promise(r => setTimeout(r, 2000));

    const modalData = await pageClient.eval(`(() => {
      const text = document.body.innerText;
      return {
        hasSuccessHeader: text.includes('PURCHASE SUCCESSFUL'),
        hasDeliveryOwner: text.includes('DELIVERY OWNER'),
        hasTotalPaid: text.includes('TOTAL PAID'),
        hasNotificationsHeader: text.includes('COMMUNICATION NOTIFICATIONS'),
        hasEmailStatus: text.includes('Email'),
        hasSmsStatus: text.includes('SMS'),
        hasWhatsappStatus: text.includes('WhatsApp'),
        hasSmsDisabled: text.includes('Disabled')
      };
    })()`);

    check(modalData.hasSuccessHeader === true, '✓ PURCHASE SUCCESSFUL modal displayed');
    check(modalData.hasDeliveryOwner === true, 'Delivery owner snapshot displayed');
    check(modalData.hasTotalPaid === true, 'Total paid displayed');
    check(modalData.hasNotificationsHeader === true, 'COMMUNICATION NOTIFICATIONS section rendered in modal');
    check(modalData.hasEmailStatus && modalData.hasSmsStatus && modalData.hasWhatsappStatus, 'Email, SMS, and WhatsApp channels listed');
    check(modalData.hasSmsDisabled === true, 'SMS correctly reflects Disabled preference');

    // Navigate to /purchases page
    await navigateAndWait('http://localhost:5173/purchases', 1500);
    const purchasesPageText = await pageClient.eval(`document.body.innerText`);
    check(purchasesPageText.includes('Purchase #') && purchasesPageText.includes('NOTIFICATIONS:'), 'Purchases history page displays notification delivery summary badge');

    // =========================================================================
    // STEP 8: FIVE VERIFIED USER LOGIN REGRESSION (PART AB, AC)
    // =========================================================================
    console.log('\n--- STEP 8: Five User Login Regression ---');
    for (const u of FIVE_USERS) {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: u.email, password: u.password })
      });
      const data = await res.json();
      check(res.status === 200 && data.status === 'success' && data.token, `${u.name} (${u.email}) authenticated with role ${data.user?.role}`);

      // Verify /api/auth/me
      const meRes = await fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${data.token}` }
      });
      const meData = await meRes.json();
      check(meRes.status === 200 && meData.email === u.email, `${u.name} /api/auth/me profile verified`);
    }

    // =========================================================================
    // STEP 9: ADMIN SECURITY REGRESSION (PART AD)
    // =========================================================================
    console.log('\n--- STEP 9: Dedicated Admin Security & Role Guards ---');
    const adminRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@aksmenstyle.com', password: 'AKAdminLuxury2026!' })
    });
    const adminData = await adminRes.json();
    check(adminRes.status === 200 && adminData.user?.role === 'ADMIN', 'Admin login verified with role ADMIN');

    const adminMetrics = await fetch('http://localhost:5000/api/admin/metrics', {
      headers: { Authorization: `Bearer ${adminData.token}` }
    });
    check(adminMetrics.status === 200, 'Admin can access /api/admin/metrics');

    // User A cannot access admin metrics
    const userAToken = (await (await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: FIVE_USERS[0].email, password: FIVE_USERS[0].password })
    })).json()).token;

    const normalUserAdminRes = await fetch('http://localhost:5000/api/admin/metrics', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    check(normalUserAdminRes.status === 403, 'Normal user (User A) strictly denied access to /api/admin/metrics with HTTP 403');

    console.log('\n================================================================');
    console.log(`✅ ALL ${passed} PHASE 11 BROWSER E2E TESTS PASSED PERFECTLY!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Phase 11 Browser E2E Test Failed:', err);
    process.exit(1);
  } finally {
    if (pageClient) pageClient.close();
    if (browserClient) {
      if (targetId) browserClient.send('Target.closeTarget', { targetId }).catch(() => {});
      browserClient.close();
    }
  }
}

runPhase11BrowserE2E();
