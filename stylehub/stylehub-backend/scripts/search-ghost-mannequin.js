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
    return (d.results || []).map(r => r.image);
  } catch (e) {
    return [];
  }
}

async function run() {
  const queries = [
    { id: 9, q: 'men brown corduroy overshirt ghost mannequin OR flat lay' },
    { id: 10, q: 'men grey knit polo shirt ghost mannequin OR flat lay' },
    { id: 14, q: 'white graphic tee ghost mannequin OR flat lay' },
    { id: 21, q: 'charcoal grey formal trousers ghost mannequin OR flat lay' },
    { id: 22, q: 'navy blue trousers ghost mannequin OR flat lay' },
    { id: 23, q: 'black formal trousers ghost mannequin OR flat lay' },
    { id: 24, q: 'beige chinos ghost mannequin OR flat lay' },
    { id: 32, q: 'navy blue hoodie ghost mannequin OR flat lay' },
    { id: 36, q: 'colour block hoodie black grey ghost mannequin' },
    { id: 38, q: 'sand hoodie ghost mannequin OR flat lay' },
    { id: 40, q: 'cream hoodie ghost mannequin OR flat lay' },
    { id: 50, q: 'brown workwear jacket corduroy collar ghost mannequin OR flat lay' }
  ];

  const results = {};
  for (const q of queries) {
    const res = await searchDDG(q.q);
    console.log(`ID ${q.id} (${res.length} results):`);
    results[q.id] = res.slice(0, 10);
    res.slice(0, 4).forEach(u => console.log('  ' + u));
    await new Promise(r => setTimeout(r, 500));
  }
  fs.writeFileSync('scripts/ghost-search-results.json', JSON.stringify(results, null, 2));
}

run();
