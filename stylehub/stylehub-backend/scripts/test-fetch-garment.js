import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getDDGToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const m = html.match(/vqd=([\d-]+)/);
  return m ? m[1] : null;
}

async function searchCandidates(query) {
  try {
    const vqd = await getDDGToken(query);
    if (!vqd) return [];
    await new Promise(r => setTimeout(r, 400));
    const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const d = await res.json();
    return (d.results || []).map(r => r.image).filter(Boolean);
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

const bannedDomains = [
  'dreamstime', 'shutterstock', 'depositphotos', 'freepik', 'alamy',
  'gettyimages', 'istockphoto', 'stock.adobe', '123rf', 'vecteezy',
  'turbosquid', 'aliexpress', 'ebay', 'amazon'
];

const bannedKeywords = [
  'front-back', 'front_back', 'two-sides', 'two_sides', 'mockup',
  'vector', 'mannequin', 'hanger', 'model', 'wearing', 'woman', 'girl'
];

function isGoodUrl(url) {
  const u = url.toLowerCase();
  for (const b of bannedDomains) {
    if (u.includes(b)) return false;
  }
  for (const k of bannedKeywords) {
    if (u.includes(k)) return false;
  }
  return true;
}

async function downloadImage(url, destFile) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    fs.writeFileSync(destFile, buf);
    return true;
  } catch {
    return false;
  }
}

async function testProduct8() {
  const queries = [
    'men slate blue stripe dress shirt flat lay white background',
    'men blue striped button down shirt product flat lay white background',
    'slate blue vertical stripe shirt product photography white background'
  ];
  for (const q of queries) {
    console.log('Searching:', q);
    const candidates = await searchCandidates(q);
    console.log('Candidates found:', candidates.length);
    for (const cand of candidates) {
      if (!isGoodUrl(cand)) continue;
      console.log('Testing candidate:', cand);
      const tempPath = path.resolve(__dirname, '../temp_test_8.jpg');
      const ok = await downloadImage(cand, tempPath);
      if (ok) {
        console.log('Download SUCCESS! Deploying Product 8...');
        execSync(`powershell -ExecutionPolicy Bypass -File scripts/deploy-garment.ps1 -id 8 -srcPath "${tempPath}"`, { stdio: 'inherit' });
        fs.unlinkSync(tempPath);
        return true;
      }
    }
  }
  return false;
}

testProduct8().then(ok => console.log('Product 8 result:', ok));
