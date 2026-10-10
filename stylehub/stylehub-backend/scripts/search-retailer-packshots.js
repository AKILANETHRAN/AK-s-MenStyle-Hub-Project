import fs from 'fs';

async function searchBing(q) {
  try {
    const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&FORM=HDRSC2';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await res.text();
    return [...html.matchAll(/murl&quot;:&quot;(https:[^&]+)&quot;/g)].map(m => m[1]);
  } catch (err) {
    return [];
  }
}

async function run() {
  const queries = [
    { name: 'suitsupply_trousers', q: 'site:cdn.suitsupply.com "products/Trousers/default"' },
    { name: 'suitsupply_navy', q: 'site:cdn.suitsupply.com "products/Trousers/default" navy' },
    { name: 'suitsupply_charcoal', q: 'site:cdn.suitsupply.com "products/Trousers/default" charcoal OR grey' },
    { name: 'suitsupply_black', q: 'site:cdn.suitsupply.com "products/Trousers/default" black' },
    { name: 'suitsupply_beige', q: 'site:cdn.suitsupply.com "products/Trousers/default" beige OR sand' },
    { name: 'suitsupply_polo', q: 'site:cdn.suitsupply.com "products/Knitwear/default" polo grey' }
  ];

  for (const q of queries) {
    const urls = await searchBing(q.q);
    console.log(`Query: ${q.name} -> ${urls.length} results`);
    urls.slice(0, 5).forEach(u => console.log('  ' + u));
    await new Promise(r => setTimeout(r, 400));
  }
}

run();
