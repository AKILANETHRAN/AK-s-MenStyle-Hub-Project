import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_DIR = path.resolve(__dirname, '../../stylehub-frontend/public/images/products');
const BACKEND_DIR = path.resolve(__dirname, '../public/images/products');

async function getDuckDuckGoToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const vqdMatch = html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) return null;
  return vqdMatch[1];
}

async function searchUnsplashImage(query) {
  try {
    const vqd = await getDuckDuckGoToken(query);
    if (!vqd) return null;
    await new Promise(r => setTimeout(r, 600));
    const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await res.json();
    const unsplashResults = (data.results || []).filter(r => r.image && r.image.includes('images.unsplash.com'));
    if (unsplashResults.length > 0) {
      const match = unsplashResults[0].image.match(/(https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9-]+)/);
      if (match) return match[1];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function testSample() {
  const samples = [
    { id: 1, q: "site:unsplash.com men white oxford shirt model fashion" },
    { id: 5, q: "site:unsplash.com men black dress shirt model fashion" },
    { id: 8, q: "site:unsplash.com men striped blue dress shirt model" },
    { id: 14, q: "site:unsplash.com men graphic tee streetwear model" },
    { id: 21, q: "site:unsplash.com men charcoal formal trousers suit pants" },
    { id: 25, q: "site:unsplash.com men cargo pants streetwear model" },
    { id: 31, q: "site:unsplash.com men grey hoodie streetwear model" },
    { id: 42, q: "site:unsplash.com men black bomber jacket fashion model" },
    { id: 51, q: "site:unsplash.com white sneakers product photography" },
    { id: 61, q: "site:unsplash.com black watch product photography" }
  ];

  for (const s of samples) {
    console.log(`Searching for #${s.id}...`);
    const photoBase = await searchUnsplashImage(s.q);
    if (photoBase) {
      const downloadUrl = `${photoBase}?auto=format&fit=crop&w=700&h=850&q=85&fm=png`;
      console.log(`Found #${s.id} -> ${downloadUrl}`);
      const imgRes = await fetch(downloadUrl);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      console.log(`Downloaded #${s.id}: ${buf.length} bytes (Magic: ${buf.slice(0, 4).toString('hex')})`);
      
      fs.writeFileSync(path.join(FRONTEND_DIR, `product_${s.id}.png`), buf);
      fs.writeFileSync(path.join(BACKEND_DIR, `product_${s.id}.png`), buf);
    } else {
      console.log(`Failed to find unsplash image for #${s.id}`);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
}

testSample();
