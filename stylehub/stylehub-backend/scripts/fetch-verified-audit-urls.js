import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const auditFile = path.resolve(__dirname, '../test/verified-audit-urls.json');

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
    await new Promise(r => setTimeout(r, 300));
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

async function verifyDownload(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);
    if (res.status !== 200) return false;
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > 0 && len < 15000) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    return true;
  } catch {
    return false;
  }
}

async function findWorkingUrl(queries) {
  for (const q of queries) {
    const candidates = await searchCandidates(q);
    for (const cand of candidates) {
      if (cand.includes('pinimg.com') || cand.includes('aliexpress') || cand.includes('amazon.com') || cand.includes('ebay.com')) {
        continue;
      }
      const ok = await verifyDownload(cand);
      if (ok) return cand;
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

async function run() {
  const prods = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../test/full-catalog-audit.json'), 'utf8'));
  let savedData = {};
  if (fs.existsSync(auditFile)) {
    savedData = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
  }

  for (const p of prods) {
    if (!savedData[p.id]) savedData[p.id] = {};

    // 1. Display photo
    if (!savedData[p.id].displayUrl) {
      console.log(`[#${p.id}] Searching display photo for: ${p.name}...`);
      let queries = [];
      if (p.id <= 50) {
        queries = [
          `men ${p.name} model photoshoot`,
          `men ${p.color} ${p.cloth_type} model wearing`,
          `men ${p.cloth_type} ${p.color} fashion photoshoot`
        ];
      } else {
        queries = [
          `${p.name} product photography studio`,
          `${p.color} ${p.cloth_type} product photo`,
          `${p.category} ${p.name}`
        ];
      }
      const displayUrl = await findWorkingUrl(queries);
      if (displayUrl) {
        console.log(`[#${p.id} DISPLAY] OK: ${displayUrl.slice(0, 70)}...`);
        savedData[p.id].displayUrl = displayUrl;
      } else {
        console.error(`[#${p.id} DISPLAY] FAILED`);
      }
      fs.writeFileSync(auditFile, JSON.stringify(savedData, null, 2));
      await new Promise(r => setTimeout(r, 600));
    }

    // 2. Garment photo (clothing IDs 1-50 only)
    if (p.id <= 50 && !savedData[p.id].garmentUrl) {
      console.log(`[#${p.id}] Searching garment photo for: ${p.name}...`);
      const queries = [
        `${p.color} ${p.cloth_type} ghost mannequin white background isolated`,
        `${p.color} ${p.cloth_type} flat lay white background product photography isolated`,
        `${p.name} isolated white background`
      ];
      const garmentUrl = await findWorkingUrl(queries);
      if (garmentUrl) {
        console.log(`[#${p.id} GARMENT] OK: ${garmentUrl.slice(0, 70)}...`);
        savedData[p.id].garmentUrl = garmentUrl;
      } else {
        console.error(`[#${p.id} GARMENT] FAILED`);
      }
      fs.writeFileSync(auditFile, JSON.stringify(savedData, null, 2));
      await new Promise(r => setTimeout(r, 600));
    }
  }

  console.log('Finished searching. Total entries in audit:', Object.keys(savedData).length);
}

run().catch(console.error);
