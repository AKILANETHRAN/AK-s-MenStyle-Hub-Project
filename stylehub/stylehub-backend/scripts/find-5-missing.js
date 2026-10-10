import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.resolve(__dirname, '../../stylehub-frontend/public/images/products');
const BACKEND_DIR = path.resolve(__dirname, '../public/images/products');

async function findOne(q) {
  const url = 'https://duckduckgo.com/?q=' + encodeURIComponent('site:unsplash.com ' + q) + '&t=h_&iax=images&ia=images';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  const m = html.match(/vqd=([\d-]+)/);
  if (!m) return null;
  const resImg = await fetch('https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent('site:unsplash.com ' + q) + '&vqd=' + m[1], { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const d = await resImg.json();
  for (const r of d.results || []) {
    if (r.image && r.image.includes('images.unsplash.com')) {
      const match = r.image.match(/(https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9-]+)/);
      if (match) {
        const testRes = await fetch(match[1] + '?auto=format&fit=crop&w=600&h=750&q=85&fm=png');
        if (testRes.status === 200) {
          const buf = Buffer.from(await testRes.arrayBuffer());
          if (buf.length > 20000) {
            return { url: match[1], buf };
          }
        }
      }
    }
  }
  return null;
}

async function run() {
  const missing = [
    { id: 5, q: 'men black dress shirt model' },
    { id: 17, q: 'men navy t-shirt fashion model' },
    { id: 22, q: 'men navy trousers pants fashion model' },
    { id: 33, q: 'men off white hoodie streetwear model' },
    { id: 46, q: 'men black windbreaker jacket streetwear' }
  ];

  for (const item of missing) {
    console.log(`Searching for #${item.id} (${item.q})...`);
    const res = await findOne(item.q);
    if (res) {
      console.log(`[PASS] Found #${item.id} -> ${res.url} (${res.buf.length} bytes)`);
      fs.writeFileSync(path.join(FRONTEND_DIR, `product_${item.id}.png`), res.buf);
      fs.writeFileSync(path.join(BACKEND_DIR, `product_${item.id}.png`), res.buf);
    } else {
      console.error(`[FAIL] Could not find photo for #${item.id}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}

run();
