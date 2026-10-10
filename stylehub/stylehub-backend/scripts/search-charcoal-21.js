import fs from 'fs';
import path from 'path';

async function searchDDG(query) {
  try {
    const url = 'https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&t=h_&iax=images&ia=images';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const html = await res.text();
    const m = html.match(/vqd=([\d-]+)/);
    if (!m) return [];
    const vqd = m[1];
    await new Promise(r => setTimeout(r, 400));
    const apiUrl = 'https://duckduckgo.com/i.js?l=us-en&o=json&q=' + encodeURIComponent(query) + '&vqd=' + vqd;
    const res2 = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await res2.json();
    return (d.results || []).map(r => r.image).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function dl(url, dest) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const queries = [
    'site:savilerowco.com charcoal trousers',
    'site:hawesandcurtis.com charcoal trousers flat',
    'charcoal suit trousers "flat lay" white background',
    'charcoal dress trousers "ghost mannequin" white background',
    'men charcoal wool trousers "product shot" white background'
  ];

  const dir = 'C:/Users/admin/.gemini/antigravity-ide/brain/0b0c4162-44d6-403d-b5af-22e656f25bd1/charcoal_candidates';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let count = 0;
  for (const q of queries) {
    console.log(`Query: ${q}`);
    const urls = await searchDDG(q);
    for (const u of urls) {
      if (u.includes('model') || u.includes('feet') || u.includes('lookbook')) continue;
      const dest = path.join(dir, `charcoal_${count}.jpg`);
      const ok = await dl(u, dest);
      if (ok) {
        console.log(`  Downloaded: ${u.slice(0, 90)}`);
        count++;
        if (count >= 8) break;
      }
    }
    if (count >= 8) break;
    await new Promise(r => setTimeout(r, 400));
  }
}

run();
