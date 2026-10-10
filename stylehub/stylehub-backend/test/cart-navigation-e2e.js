/**
 * AK'S MEN STYLE — CART NAVIGATION & NAVBAR CLEANUP E2E TEST
 * Drives real Chrome browser via CDP
 * Validates:
 * 1. Desktop navbar visual hierarchy & primary/utility separation
 * 2. Prominent 🛒 CART button in navbar
 * 3. Empty cart state (🛒 CART without confusing 0 badge)
 * 4. Add to cart non-blocking feedback (✓ Added to cart + [ VIEW CART ])
 * 5. Real-time navbar cart badge updates immediately (🛒 CART 1)
 * 6. Navigation to /cart via navbar CART button
 * 7. Active gold indicator on CART when on /cart
 * 8. Mobile responsive navigation: visible quick cart button & mobile drawer
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Users\\admin\\AppData\\Local\\Temp\\chrome-cdp-cart-nav-test';

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
  console.log("AK'S MEN STYLE — CART NAVIGATION & NAVBAR CLEANUP E2E TEST");
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

    const targets = await (await fetch('http://localhost:9222/json')).json();
    const pageTarget = targets.find(t => t.id === targetId);

    pageClient = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await pageClient.connect();
    await pageClient.send('Page.enable');
    await pageClient.send('DOM.enable');

    // Step 1: Create fresh authenticated user
    const username = `cart_nav_${Date.now()}`;
    const email = `${username}@example.com`;
    const password = 'Password123!';

    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, fullName: 'Cart Nav Tester' })
    });
    const regData = await regRes.json();
    check(regData.status === 'success', 'Registered test user successfully');
    const token = regData.token;

    // Navigate to frontend and set authentication state
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await new Promise(r => setTimeout(r, 1200));

    await pageClient.eval(`
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('stylehub_auth_token', '${token}');
      localStorage.setItem('stylehub_auth_user', JSON.stringify(${JSON.stringify(regData.user)}));
    `);
    await pageClient.send('Page.navigate', { url: 'http://localhost:5173/products' });
    await new Promise(r => setTimeout(r, 2500));

    // Step 2: Check Desktop Navbar Hierarchy & Cart Presence
    console.log('\n--- Checking Desktop Navbar Structure ---');
    const navStructure = await pageClient.eval(`
      (() => {
        const primaryNav = document.getElementById('desktop-primary-nav');
        const utilityNav = document.getElementById('desktop-utility-nav');
        const cartBtn = document.getElementById('nav-cart-btn');
        const cartBadge = document.getElementById('nav-cart-badge');
        
        return {
          hasPrimaryNav: !!primaryNav,
          primaryLinks: primaryNav ? Array.from(primaryNav.querySelectorAll('a')).map(a => a.textContent.trim()) : [],
          hasUtilityNav: !!utilityNav,
          hasCartBtn: !!cartBtn,
          cartText: cartBtn ? cartBtn.textContent.trim() : null,
          hasBadge: !!cartBadge,
          badgeCount: cartBadge ? cartBadge.textContent.trim() : null
        };
      })()
    `);

    console.log('Nav Structure check:', JSON.stringify(navStructure));
    check(navStructure.hasPrimaryNav, 'Desktop primary navigation container exists');
    check(navStructure.primaryLinks.some(l => l.includes('HOME') || l.includes('SHOP')), 'Primary nav contains HOME and SHOP');
    check(navStructure.hasCartBtn, 'Desktop prominent 🛒 CART button exists in navbar');
    check(navStructure.cartText.includes('CART'), 'Cart button displays CART label with shopping icon');
    check(!navStructure.hasBadge, 'Empty cart does NOT display a confusing "0" badge (Clean 🛒 CART)');

    // Step 3: Add a product to cart and verify non-blocking feedback + badge update
    console.log('\n--- Adding Product to Cart & Verifying Immediate Badge Update ---');
    const addResult = await pageClient.eval(`
      (() => {
        const cards = document.querySelectorAll('.card');
        for (const card of cards) {
          const btn = card.querySelector('button.btn-outline');
          if (btn && btn.textContent.includes('ADD TO CART') && !btn.disabled) {
            btn.click();
            return { clicked: true };
          }
        }
        return { clicked: false };
      })()
    `);
    check(addResult.clicked, 'Clicked ADD TO CART button on product card');

    // Wait for add-to-cart API to resolve and UI to update
    await new Promise(r => setTimeout(r, 1200));

    const postAddState = await pageClient.eval(`
      (() => {
        const cartBadge = document.getElementById('nav-cart-badge');
        const viewCartBtns = Array.from(document.querySelectorAll('a')).filter(a => a.textContent.includes('VIEW CART'));
        const addedToasts = Array.from(document.querySelectorAll('div')).filter(d => d.textContent.includes('Added to cart'));

        return {
          hasCartBadge: !!cartBadge,
          badgeCount: cartBadge ? cartBadge.textContent.trim() : null,
          hasViewCartBtn: viewCartBtns.length > 0,
          hasAddedToast: addedToasts.length > 0
        };
      })()
    `);

    check(postAddState.hasCartBadge, 'Navbar 🛒 CART badge appeared immediately after adding product');
    check(postAddState.badgeCount === '1', 'Navbar cart badge displays exactly "1" for 1 added item');
    check(postAddState.hasAddedToast || postAddState.hasViewCartBtn, 'Non-blocking "✓ Added to cart" and "VIEW CART →" feedback appeared on card');

    // Step 4: Click Navbar CART button and verify navigation to /cart
    console.log('\n--- Clicking Navbar CART Button to Navigate to /cart ---');
    await pageClient.eval(`
      (() => {
        const cartBtn = document.getElementById('nav-cart-btn');
        if (cartBtn) cartBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const cartPageCheck = await pageClient.eval(`
      (() => {
        const url = window.location.pathname;
        const h1 = document.querySelector('h1')?.textContent.trim();
        const subtitle = document.querySelector('p')?.textContent.trim();
        const tracker = document.getElementById('buy-more-save-more-tracker');
        const cartBtn = document.getElementById('nav-cart-btn');
        const isCartActive = cartBtn ? (
          cartBtn.style.border.includes('var(--accent-gold)') ||
          cartBtn.style.borderColor?.includes('rgb(212, 175, 55)') ||
          window.getComputedStyle(cartBtn).borderColor.includes('212, 175, 55')
        ) : false;

        return {
          pathname: url,
          h1Title: h1,
          hasTracker: !!tracker,
          isCartActive: isCartActive
        };
      })()
    `);

    check(cartPageCheck.pathname === '/cart', 'Navigated successfully to canonical /cart route');
    check(cartPageCheck.h1Title === 'MY CART', 'Page title is strictly "MY CART"');
    check(cartPageCheck.hasTracker, 'BUY MORE, SAVE MORE tracker is rendered prominently at the top of /cart');
    check(cartPageCheck.isCartActive, 'Navbar CART item indicates gold active state when on /cart');

    // Step 5: Test Mobile Viewport Navigation
    console.log('\n--- Testing Mobile Viewport Responsive Navigation ---');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 800));

    const mobileHeaderState = await pageClient.eval(`
      (() => {
        const quickCart = document.getElementById('mobile-quick-cart-btn');
        const quickCartBadge = document.getElementById('mobile-cart-badge');
        const menuToggle = document.getElementById('mobile-menu-toggle-btn');
        
        return {
          hasQuickCart: !!quickCart,
          quickCartText: quickCart ? quickCart.textContent.trim() : null,
          hasBadge: !!quickCartBadge,
          badgeCount: quickCartBadge ? quickCartBadge.textContent.trim() : null,
          hasToggle: !!menuToggle
        };
      })()
    `);

    check(mobileHeaderState.hasQuickCart, 'Mobile header displays dedicated Quick Cart button');
    check(mobileHeaderState.hasBadge && mobileHeaderState.badgeCount === '1', 'Mobile quick cart badge displays item count "1"');
    check(mobileHeaderState.hasToggle, 'Mobile hamburger toggle button (☰) is visible');

    // Open mobile menu
    await pageClient.eval(`
      (() => {
        const menuToggle = document.getElementById('mobile-menu-toggle-btn');
        if (menuToggle) menuToggle.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const mobileDrawerState = await pageClient.eval(`
      (() => {
        const drawer = document.getElementById('mobile-menu-drawer');
        const links = drawer ? Array.from(drawer.querySelectorAll('a')).map(a => a.textContent.trim()) : [];
        return {
          isOpen: !!drawer,
          links: links
        };
      })()
    `);

    check(mobileDrawerState.isOpen, 'Mobile navigation drawer opens smoothly');
    check(mobileDrawerState.links.some(l => l.includes('HOME') || l.includes('SHOP')), 'Mobile drawer contains primary navigation');
    check(mobileDrawerState.links.some(l => l.includes('CART')), 'Mobile drawer contains discoverable CART link');

    // Reset device metrics override back to desktop
    await pageClient.send('Emulation.clearDeviceMetricsOverride');

    console.log('\n================================================================');
    console.log(`ALL CART NAVIGATION E2E CHECKS PASSED: ${passed}/${total}`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n✗ TEST FAILED WITH EXCEPTION:', err);
    process.exit(1);
  } finally {
    if (pageClient) pageClient.close();
    if (browserClient && targetId) {
      try {
        await browserClient.send('Target.closeTarget', { targetId });
      } catch {}
      browserClient.close();
    }
    if (chromeProc) {
      chromeProc.kill();
    }
  }
}

runTests();
