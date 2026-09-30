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
    console.error('Search error for:', query, err.message);
    return [];
  }
}

const bannedDomains = [
  'dreamstime', 'shutterstock', 'depositphotos', 'freepik', 'alamy',
  'gettyimages', 'istockphoto', 'stock.adobe', '123rf', 'vecteezy',
  'turbosquid', 'aliexpress', 'ebay', 'amazon', 'thredup', 'pinimg'
];

const bannedKeywords = [
  'front-back', 'front_back', 'two-sides', 'two_sides', 'mockup',
  'vector', 'mannequin', 'hanger', 'model', 'wearing', 'woman', 'girl',
  'female', 'legs', 'feet', 'shoes', 'face', 'person'
];

function isGoodUrl(url) {
  const u = url.toLowerCase();
  for (const b of bannedDomains) {
    if (u.includes(b)) return false;
  }
  for (const k of bannedKeywords) {
    if (u.includes(k)) return false;
  }
  return true;
}

async function downloadImage(url, destFile) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    fs.writeFileSync(destFile, buf);
    return true;
  } catch {
    return false;
  }
}

const targets = [
  {
    id: 17,
    queries: [
      'men navy blue v-neck t-shirt product flat lay isolated white background',
      'men navy cotton v neck tee flat lay white background',
      'navy v-neck t-shirt men product photography white background'
    ]
  },
  {
    id: 19,
    queries: [
      'men ash grey graphic t-shirt product flat lay white background',
      'men grey graphic tee shirt flat lay white background',
      'men grey typography t-shirt product photography white background'
    ]
  },
  {
    id: 20,
    queries: [
      'men dark taupe crewneck t-shirt product flat lay white background',
      'men taupe brown t-shirt flat lay white background',
      'men brown plain cotton t-shirt product photography white background'
    ]
  },
  {
    id: 21,
    queries: [
      'men charcoal grey dress trousers flat lay white background',
      'men charcoal formal trousers product photography isolated white background',
      'men charcoal grey suit pants flat lay white background'
    ]
  },
  {
    id: 22,
    queries: [
      'men navy blue casual trousers flat lay white background',
      'men navy blue chinos pants product photography isolated white background',
      'men navy casual pants flat lay white background'
    ]
  },
  {
    id: 23,
    queries: [
      'men black slim fit trousers flat lay white background',
      'men black formal dress pants product photography isolated white background',
      'men black tailored trousers flat lay white background'
    ]
  },
  {
    id: 24,
    queries: [
      'men beige chinos pants flat lay white background',
      'men beige casual chino trousers product photography isolated white background',
      'men khaki beige chinos flat lay white background'
    ]
  },
  {
    id: 27,
    queries: [
      'men slate grey sweatpants joggers flat lay white background',
      'men grey jogger pants product photography isolated white background',
      'men heather grey fleece joggers flat lay white background'
    ]
  },
  {
    id: 29,
    queries: [
      'men stone grey tapered trousers flat lay white background',
      'men grey tailored trousers product photography isolated white background',
      'men light grey formal pants flat lay white background'
    ]
  },
  {
    id: 30,
    queries: [
      'men brown wide leg trousers flat lay white background',
      'men mocha brown pleated pants product photography isolated white background',
      'men brown tailored wide leg trousers flat lay white background'
    ]
  },
  {
    id: 31,
    queries: [
      'men heather grey hoodie flat lay white background',
      'men grey french terry pullover hoodie product photography isolated white background',
      'men grey hooded sweatshirt flat lay white background'
    ]
  },
  {
    id: 32,
    queries: [
      'men navy blue pullover hoodie flat lay white background',
      'men dark navy fleece hoodie product photography isolated white background',
      'men navy hooded sweatshirt flat lay white background'
    ]
  },
  {
    id: 36,
    queries: [
      'men black and grey colour block hoodie flat lay white background',
      'men black grey colorblock hoodie product photography isolated white background',
      'men black grey two tone hoodie flat lay'
    ]
  },
  {
    id: 38,
    queries: [
      'men sandstone beige hoodie flat lay white background',
      'men sand fleece pullover hoodie product photography isolated white background',
      'men tan beige hoodie flat lay white background'
    ]
  },
  {
    id: 40,
    queries: [
      'men cream pullover hoodie flat lay white background',
      'men off-white cream hoodie product photography isolated white background',
      'men natural cream hooded sweatshirt flat lay'
    ]
  },
  {
    id: 43,
    queries: [
      'men charcoal grey quilted puffer jacket flat lay white background',
      'men grey puffer jacket product photography isolated white background',
      'men charcoal down jacket flat lay white background'
    ]
  },
  {
    id: 44,
    queries: [
      'men navy and grey varsity jacket flat lay white background',
      'men navy grey baseball jacket product photography isolated white background',
      'men navy letterman jacket grey sleeves flat lay'
    ]
  },
  {
    id: 45,
    queries: [
      'men black leather biker jacket flat lay white background',
      'men black motorcycle leather jacket product photography isolated white background',
      'men asymmetrical leather biker jacket flat lay white background'
    ]
  },
  {
    id: 47,
    queries: [
      'men desert khaki safari field jacket flat lay white background',
      'men khaki utility jacket product photography isolated white background',
      'men safari jacket flat lay white background'
    ]
  },
  {
    id: 50,
    queries: [
      'men brown canvas jacket corduroy collar flat lay white background',
      'men tobacco brown barn jacket product photography isolated white background',
      'men brown workwear jacket flat lay white background'
    ]
  }
];

async function run() {
  const verifiedUrlsPath = path.resolve(__dirname, '../test/verified-audit-urls.json');
  const verifiedUrls = JSON.parse(fs.readFileSync(verifiedUrlsPath, 'utf8'));

  for (const item of targets) {
    console.log(`\n==================================================`);
    console.log(`[#${item.id}] Searching clean flat lay garment...`);
    let success = false;

    for (const q of item.queries) {
      console.log(`Query: ${q}`);
      const candidates = await searchBing(q);
      console.log(`Bing candidates found: ${candidates.length}`);

      for (const cand of candidates) {
        if (!isGoodUrl(cand)) continue;

        const tempFile = path.resolve(__dirname, `../temp_garment_${item.id}.jpg`);
        const ok = await downloadImage(cand, tempFile);
        if (ok) {
          try {
            console.log(`✓ Valid candidate: ${cand.slice(0, 75)}...`);
            const deployScript = path.resolve(__dirname, 'deploy-garment.ps1');
            execSync(`powershell -ExecutionPolicy Bypass -File "${deployScript}" -id ${item.id} -srcPath "${tempFile}"`, { stdio: 'inherit' });
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

            if (!verifiedUrls[item.id]) verifiedUrls[item.id] = {};
            verifiedUrls[item.id].garmentUrl = cand;
            fs.writeFileSync(verifiedUrlsPath, JSON.stringify(verifiedUrls, null, 2));

            success = true;
            break;
          } catch (e) {
            console.error(`Error deploying #${item.id}:`, e.message);
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          }
        }
      }
      if (success) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!success) {
      console.error(`FAILED to find replacement for #${item.id}`);
    }
  }

  console.log('\nAll targets completed!');
}

run().catch(console.error);
