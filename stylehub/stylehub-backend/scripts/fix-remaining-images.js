import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDisplays = [15, 16, 28, 55, 58, 60, 74, 99];
const targetGarments = [1, 33];

const auditUrlsPath = path.resolve(__dirname, '../test/verified-audit-urls.json');
const auditUrls = JSON.parse(fs.readFileSync(auditUrlsPath, 'utf8'));

const prods = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../test/full-catalog-audit.json'), 'utf8'));

async function getDDGToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const d = await res.json();
    return (d.results || []).map(r => r.image).filter(Boolean);
  } catch {
    return [];
  }
}

async function verifyAndFetchBuffer(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);
    if (res.status !== 200) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return null;
    // Check magic bytes for JPEG (FF D8) or PNG (89 50 4E 47)
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    if (!isJpeg && !isPng) return null;
    return buf;
  } catch {
    return null;
  }
}

async function findWorkingUrl(queries) {
  for (const q of queries) {
    console.log(`Searching query: "${q}"...`);
    const candidates = await searchCandidates(q);
    for (const cand of candidates) {
      if (cand.includes('asos-media') || cand.includes('vecteezy') || cand.includes('arthurknight') || cand.includes('pinterest') || cand.includes('ebay.com')) {
        continue;
      }
      const buf = await verifyAndFetchBuffer(cand);
      if (buf) {
        return { url: cand, buf };
      }
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

async function run() {
  // 1. Fix Displays
  for (const id of targetDisplays) {
    const p = prods.find(x => x.id === id);
    console.log(`Fixing display for #${id}: ${p.name} (${p.color})...`);
    const queries = [
      `men ${p.color} ${p.cloth_type} model photo`,
      `men ${p.name} model wearing`,
      `${p.name} menswear photoshoot`,
      `${p.color} ${p.cloth_type} fashion shoot`
    ];
    const res = await findWorkingUrl(queries);
    if (res) {
      console.log(`[#${id} DISPLAY FOUND]: ${res.url}`);
      auditUrls[id].displayUrl = res.url;
      // Save temp file to process
      const tmpPath = path.resolve(__dirname, `../temp_${id}_disp.jpg`);
      fs.writeFileSync(tmpPath, res.buf);
    } else {
      console.error(`[#${id} DISPLAY NOT FOUND]`);
    }
  }

  // 2. Fix Garments
  for (const id of targetGarments) {
    const p = prods.find(x => x.id === id);
    console.log(`Fixing garment for #${id}: ${p.name} (${p.color})...`);
    const queries = [
      `${p.color} ${p.cloth_type} white background isolated`,
      `${p.color} ${p.cloth_type} ghost mannequin isolated`,
      `${p.name} product photography isolated white`
    ];
    const res = await findWorkingUrl(queries);
    if (res) {
      console.log(`[#${id} GARMENT FOUND]: ${res.url}`);
      auditUrls[id].garmentUrl = res.url;
      const tmpPath = path.resolve(__dirname, `../temp_${id}_garm.jpg`);
      fs.writeFileSync(tmpPath, res.buf);
    } else {
      console.error(`[#${id} GARMENT NOT FOUND]`);
    }
  }

  fs.writeFileSync(auditUrlsPath, JSON.stringify(auditUrls, null, 2));
  console.log('Updated verified-audit-urls.json');
}

run().catch(console.error);
