import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function searchBing(q) {
  try {
    const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&FORM=HDRSC2';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    return [...html.matchAll(/murl&quot;:&quot;(https:[^&]+)&quot;/g)].map(m => m[1]);
  } catch (err) {
    return [];
  }
}

const targets = [
  { id: 9, q: 'men brown corduroy overshirt flat lay site:shopify.com OR site:endclothing.com' },
  { id: 10, q: 'men grey knit polo shirt flat lay site:shopify.com OR site:mrporter.com' },
  { id: 14, q: 'men white graphic t-shirt flat lay site:shopify.com OR site:endclothing.com' },
  { id: 20, q: 'men taupe t-shirt flat lay site:shopify.com OR site:endclothing.com' },
  { id: 21, q: 'men charcoal grey formal trousers flat lay site:shopify.com OR site:mrporter.com' },
  { id: 22, q: 'men navy trousers flat lay site:shopify.com OR site:mrporter.com' },
  { id: 23, q: 'men black trousers flat lay site:shopify.com OR site:mrporter.com' },
  { id: 24, q: 'men beige chinos flat lay site:shopify.com OR site:mrporter.com' },
  { id: 32, q: 'men navy hoodie flat lay site:shopify.com OR site:endclothing.com' },
  { id: 36, q: 'men black grey color block hoodie flat lay site:shopify.com OR site:endclothing.com' },
  { id: 38, q: 'men sand hoodie flat lay site:shopify.com OR site:endclothing.com' },
  { id: 40, q: 'men cream hoodie flat lay site:shopify.com OR site:endclothing.com' },
  { id: 50, q: 'men brown duck canvas workwear jacket corduroy collar flat lay site:shopify.com OR site:mrporter.com' }
];

async function run() {
  const results = {};
  for (const t of targets) {
    const urls = await searchBing(t.q);
    console.log(`ID ${t.id} (${urls.length} results):`);
    // filter out clearly bad urls
    const good = urls.filter(u => !u.includes('lookbook') && !u.includes('blog'));
    results[t.id] = good.slice(0, 10);
    good.slice(0, 4).forEach(u => console.log('  ' + u));
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync(path.resolve(__dirname, 'clean-flatlay-urls.json'), JSON.stringify(results, null, 2));
}

run();
