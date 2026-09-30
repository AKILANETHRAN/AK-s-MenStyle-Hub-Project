import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function searchBing(query) {
  try {
    const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(query) + '&FORM=RESTAB';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    return [...html.matchAll(/murl&quot;:&quot;(https:[^&]+)&quot;/g)].map(m => m[1]);
  } catch (err) {
    return [];
  }
}

const bannedKeywords = [
  'model', 'wearing', 'outfit', 'lookbook', 'street', 'face', 'hands', 'feet', 'shoes',
  'woman', 'female', 'girl', 'two-sides', 'front-back', 'mannequin', 'hanger', 'set', 'collage'
];

function isCleanRetailerUrl(url) {
  const u = url.toLowerCase();
  for (const b of bannedKeywords) {
    if (u.includes(b)) return false;
  }
  // MrPorter, EndClothing, SSENSE, Lyst, SuitSupply have clean flat shot naming
  return true;
}

async function download(url, dest) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
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

const targets = [
  {
    id: 9,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:lyst.com "corduroy" overshirt brown flat',
      'brown corduroy overshirt still life white background',
      'men brown corduroy shirt flat lay'
    ]
  },
  {
    id: 10,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:lyst.com "polo" grey flat',
      'steel grey polo shirt flat lay white background',
      'men grey knit polo shirt still life'
    ]
  },
  {
    id: 20,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:lyst.com "t-shirt" taupe flat',
      'dark taupe t-shirt flat lay white background',
      'men brown cotton t-shirt still life'
    ]
  },
  {
    id: 21,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:suitsupply.com "charcoal" trousers flat',
      'site:lyst.com charcoal formal trousers flat',
      'charcoal grey suit trousers flat lay white background'
    ]
  },
  {
    id: 22,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:suitsupply.com "navy" trousers flat',
      'site:lyst.com navy casual trousers flat',
      'navy blue cotton trousers flat lay white background'
    ]
  },
  {
    id: 23,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:suitsupply.com "black" trousers flat',
      'site:lyst.com black slim trousers flat',
      'black dress trousers flat lay white background'
    ]
  },
  {
    id: 24,
    queries: [
      'site:mrporter.com OR site:endclothing.com OR site:suitsupply.com "beige" chinos flat',
      'site:lyst.com beige chinos flat',
      'warm beige chinos flat lay white background'
    ]
  },
  {
    id: 32,
    queries: [
      'site:endclothing.com OR site:mrporter.com OR site:lyst.com "navy" hoodie flat',
      'deep navy blue hoodie flat lay white background',
      'navy pullover hoodie still life'
    ]
  },
  {
    id: 36,
    queries: [
      'site:endclothing.com OR site:lyst.com color block hoodie black grey flat',
      'men black grey color block hoodie flat lay white background',
      'black grey colour block hoodie still life'
    ]
  },
  {
    id: 38,
    queries: [
      'site:endclothing.com OR site:mrporter.com OR site:lyst.com sand hoodie flat',
      'sandstone beige hoodie flat lay white background',
      'sand hoodie still life white background'
    ]
  },
  {
    id: 40,
    queries: [
      'site:endclothing.com OR site:mrporter.com OR site:lyst.com cream hoodie flat',
      'cream off-white hoodie flat lay white background',
      'natural cream hoodie still life'
    ]
  },
  {
    id: 50,
    queries: [
      'site:endclothing.com OR site:mrporter.com OR site:lyst.com corduroy collar jacket brown flat',
      'brown canvas jacket corduroy collar flat lay white background',
      'tobacco brown workwear jacket still life'
    ]
  }
];

async function run() {
  for (const t of targets) {
    console.log(`\nProcessing #${t.id}...`);
    let done = false;

    for (const q of t.queries) {
      console.log(`Query: ${q}`);
      const urls = await searchBing(q);
      for (const u of urls) {
        if (!isCleanRetailerUrl(u)) continue;
        const temp = path.resolve(__dirname, `../temp_ret_${t.id}.jpg`);
        const ok = await download(u, temp);
        if (ok) {
          try {
            console.log(`Candidate: ${u.slice(0, 80)}...`);
            const deployScript = path.resolve(__dirname, 'deploy-garment.ps1');
            execSync(`powershell -ExecutionPolicy Bypass -File "${deployScript}" -id ${t.id} -srcPath "${temp}"`, { stdio: 'inherit' });
            if (fs.existsSync(temp)) fs.unlinkSync(temp);
            console.log(`DEPLOYED #${t.id}!`);
            done = true;
            break;
          } catch (e) {
            if (fs.existsSync(temp)) fs.unlinkSync(temp);
          }
        }
      }
      if (done) break;
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log('\nRetailer fetch complete!');
}

run().catch(console.error);
