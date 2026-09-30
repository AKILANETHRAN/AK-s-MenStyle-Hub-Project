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

const remaining = [
  { id: 10, queries: ['men grey knit polo shirt "ghost mannequin" white background', 'men grey polo shirt flat lay white background', 'steel grey polo shirt product photography white background'] },
  { id: 14, queries: ['white bauhaus graphic t shirt flat lay white background', 'men white geometric graphic tee flat lay white background', 'white graphic t shirt product photography white background'] },
  { id: 21, queries: ['men charcoal dress pants flat lay white background', 'charcoal grey trousers "flat lay" white background -shoes -man', 'charcoal wool trousers flat lay white background'] },
  { id: 22, queries: ['men navy chinos flat lay white background', 'navy casual pants flat lay white background -shoes -man', 'navy trousers "flat lay" white background'] },
  { id: 23, queries: ['men black dress pants flat lay white background', 'black trousers "flat lay" white background -shoes -man', 'black slim fit trousers flat lay white background'] },
  { id: 24, queries: ['men beige chinos flat lay white background -shoes -man', 'warm beige chinos "flat lay" white background', 'beige trousers flat lay white background'] },
  { id: 32, queries: ['men navy blue pullover hoodie flat lay white background', 'navy fleece hoodie "flat lay" white background', 'navy hoodie flat lay white background'] },
  { id: 38, queries: ['men sand hoodie flat lay white background', 'sand stone fleece hoodie "flat lay" white background', 'beige sand pullover hoodie flat lay white background'] },
  { id: 40, queries: ['men cream pullover hoodie flat lay white background', 'off white cream hoodie "flat lay" white background', 'natural cream hoodie flat lay white background'] },
  { id: 50, queries: ['men brown canvas chore coat corduroy collar flat lay', 'men tobacco brown workwear jacket flat lay white background', 'brown canvas jacket corduroy collar product photography'] }
];

async function run() {
  const dir = 'C:/Users/admin/.gemini/antigravity-ide/brain/0b0c4162-44d6-403d-b5af-22e656f25bd1/clean_candidates';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const item of remaining) {
    console.log(`\nSearching for #${item.id}...`);
    let found = 0;
    for (const q of item.queries) {
      console.log(`  Query: ${q}`);
      const urls = await searchDDG(q);
      for (const u of urls) {
        if (u.includes('lookbook') || u.includes('stock-footage') || u.includes('model') || u.includes('feet')) continue;
        const dest = path.join(dir, `item_${item.id}_cand_${found}.jpg`);
        const ok = await dl(u, dest);
        if (ok) {
          console.log(`    Downloaded candidate ${found}: ${u.slice(0, 80)}`);
          found++;
          if (found >= 4) break;
        }
      }
      if (found >= 4) break;
      await new Promise(r => setTimeout(r, 400));
    }
  }
}

run();
