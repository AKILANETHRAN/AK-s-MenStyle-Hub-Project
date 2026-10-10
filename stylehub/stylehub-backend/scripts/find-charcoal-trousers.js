import fs from 'fs';

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
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    'charcoal suit trousers flat lay site:shopify.com',
    'charcoal grey formal trousers flat lay white background',
    'charcoal dress trousers flat lay site:lyst.com',
    'charcoal trousers ghost mannequin site:endclothing.com',
    'site:hawesandcurtis.com charcoal trousers flat'
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    console.log(`Query: ${q}`);
    const urls = await searchDDG(q);
    let count = 0;
    for (const u of urls) {
      if (u.includes('model') || u.includes('feet')) continue;
      const file = `scripts/charcoal_test_${i}_${count}.jpg`;
      const ok = await dl(u, file);
      if (ok) {
        console.log(`  Saved: ${u.slice(0, 80)}`);
        count++;
        if (count >= 3) break;
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

run();
