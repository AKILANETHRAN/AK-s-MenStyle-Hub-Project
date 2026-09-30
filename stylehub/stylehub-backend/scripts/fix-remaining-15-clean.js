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

const banned = [
  'dreamstime', 'shutterstock', 'depositphotos', 'freepik', 'alamy',
  'getty', 'istock', 'front-back', 'two-sides', 'mannequin', 'hanger',
  'model', 'wearing', 'woman', 'girl', 'female', 'lookbook', 'editorial',
  'back-view', 'back_view', 'outfit', 'street-style', 'streetstyle'
];

function isCleanUrl(url) {
  const u = url.toLowerCase();
  for (const b of banned) {
    if (u.includes(b)) return false;
  }
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

const remaining = [
  {
    id: 9,
    queries: [
      'men brown corduroy shirt packshot white background',
      'men brown corduroy overshirt still life white background',
      'brown corduroy shirt flatshot white background'
    ]
  },
  {
    id: 10,
    queries: [
      'men grey polo shirt packshot white background',
      'men grey knit polo shirt still life white background',
      'grey polo shirt flatshot white background'
    ]
  },
  {
    id: 14,
    queries: [
      'men white graphic t shirt packshot white background',
      'men off white graphic tee still life white background',
      'white graphic tee flatshot white background'
    ]
  },
  {
    id: 17,
    queries: [
      'men navy v neck t-shirt packshot white background',
      'men navy blue v-neck tee still life white background',
      'navy v-neck t-shirt flatshot white background'
    ]
  },
  {
    id: 20,
    queries: [
      'men brown t-shirt packshot white background',
      'men taupe t-shirt still life white background',
      'men dark taupe crewneck tee flatshot white background'
    ]
  },
  {
    id: 21,
    queries: [
      'men charcoal formal trousers packshot white background',
      'men charcoal grey dress pants still life white background',
      'charcoal wool trousers flatshot white background'
    ]
  },
  {
    id: 22,
    queries: [
      'men navy trousers packshot white background',
      'men navy blue casual pants still life white background',
      'navy cotton trousers flatshot white background'
    ]
  },
  {
    id: 23,
    queries: [
      'men black formal trousers packshot white background',
      'men black dress pants still life white background',
      'black slim trousers flatshot white background'
    ]
  },
  {
    id: 24,
    queries: [
      'men beige chinos packshot white background',
      'men warm beige chino pants still life white background',
      'beige chinos flatshot white background'
    ]
  },
  {
    id: 30,
    queries: [
      'men brown trousers packshot white background',
      'men brown wide leg pants still life white background',
      'brown pleated trousers flatshot white background'
    ]
  },
  {
    id: 32,
    queries: [
      'men navy pullover hoodie packshot white background',
      'men dark navy hoodie still life white background',
      'navy blue hoodie flatshot white background'
    ]
  },
  {
    id: 36,
    queries: [
      'men black and grey hoodie packshot white background',
      'black grey color block hoodie front still life white background',
      'black grey two tone hoodie flatshot white background'
    ]
  },
  {
    id: 38,
    queries: [
      'men sand hoodie packshot white background',
      'men sandstone hoodie front still life white background',
      'beige pullover hoodie flatshot white background'
    ]
  },
  {
    id: 40,
    queries: [
      'men cream pullover hoodie packshot white background',
      'men off-white hoodie still life white background',
      'natural cream hoodie flatshot white background'
    ]
  },
  {
    id: 50,
    queries: [
      'men brown canvas jacket corduroy collar packshot white background',
      'men brown barn jacket still life white background',
      'brown work jacket corduroy collar flatshot white background'
    ]
  }
];

async function run() {
  const verifiedUrlsPath = path.resolve(__dirname, '../test/verified-audit-urls.json');
  const verifiedUrls = JSON.parse(fs.readFileSync(verifiedUrlsPath, 'utf8'));

  for (const item of remaining) {
    console.log(`[#${item.id}] Searching packshot/still-life asset...`);
    let found = false;

    for (const q of item.queries) {
      const candidates = await searchBing(q);
      for (const cand of candidates) {
        if (!isCleanUrl(cand)) continue;
        const temp = path.resolve(__dirname, `../temp_clean_${item.id}.jpg`);
        const ok = await download(cand, temp);
        if (ok) {
          try {
            const deployScript = path.resolve(__dirname, 'deploy-garment.ps1');
            execSync(`powershell -ExecutionPolicy Bypass -File "${deployScript}" -id ${item.id} -srcPath "${temp}"`, { stdio: 'inherit' });
            if (fs.existsSync(temp)) fs.unlinkSync(temp);
            verifiedUrls[item.id].garmentUrl = cand;
            fs.writeFileSync(verifiedUrlsPath, JSON.stringify(verifiedUrls, null, 2));
            console.log(`✓ FIXED #${item.id} with ${cand.slice(0, 65)}...`);
            found = true;
            break;
          } catch (e) {
            if (fs.existsSync(temp)) fs.unlinkSync(temp);
          }
        }
      }
      if (found) break;
      await new Promise(r => setTimeout(r, 400));
    }
  }

  console.log('Finished 15 remaining fixes.');
}

run().catch(console.error);
