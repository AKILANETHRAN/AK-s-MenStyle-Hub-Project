import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getDDGToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
    await new Promise(r => setTimeout(r, 350));
    const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const d = await res.json();
    return (d.results || []).map(r => r.image).filter(Boolean);
  } catch (err) {
    return [];
  }
}

const bannedDomains = [
  'dreamstime', 'shutterstock', 'depositphotos', 'freepik', 'alamy',
  'gettyimages', 'istockphoto', 'stock.adobe', '123rf', 'vecteezy',
  'turbosquid', 'aliexpress', 'ebay', 'amazon', 'thredup'
];

const bannedKeywords = [
  'front-back', 'front_back', 'two-sides', 'two_sides', 'mockup',
  'vector', 'mannequin', 'hanger', 'model', 'wearing', 'woman', 'girl',
  'set', 'bundle', 'collage', 'back-view', 'back_view'
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
    const timeout = setTimeout(() => controller.abort(), 8000);
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
    id: 9,
    queries: [
      'men brown corduroy overshirt flat lay white background',
      'men earth brown corduroy shirt jacket isolated white background',
      'men brown corduroy button shirt flat lay white background'
    ]
  },
  {
    id: 10,
    queries: [
      'men steel grey polo shirt flat lay white background',
      'men grey knit polo shirt product photography isolated white background',
      'men polo shirt grey flat lay white background'
    ]
  },
  {
    id: 11,
    queries: [
      'men black plain t-shirt flat lay white background',
      'men pitch black crew neck tee product photography isolated white background',
      'men basic black t-shirt isolated white background'
    ]
  },
  {
    id: 14,
    queries: [
      'men off-white graphic t-shirt flat lay white background',
      'men white minimalist graphic print tee isolated white background',
      'men graphic t-shirt flat lay white background'
    ]
  },
  {
    id: 16,
    queries: [
      'men khaki oversized t-shirt flat lay white background',
      'men khaki green drop shoulder tee isolated white background',
      'men khaki t-shirt flat lay white background'
    ]
  },
  {
    id: 17,
    queries: [
      'men navy blue v-neck t-shirt flat lay white background',
      'men dark navy v neck tee product photography isolated white background',
      'men navy v-neck shirt flat lay white background'
    ]
  },
  {
    id: 19,
    queries: [
      'men ash grey graphic t-shirt flat lay white background',
      'men grey boxy typography graphic tee isolated white background',
      'men grey graphic tee flat lay white background'
    ]
  },
  {
    id: 20,
    queries: [
      'men taupe brown t-shirt flat lay white background',
      'men dark taupe crewneck tee product photography isolated white background',
      'men brown t-shirt flat lay white background'
    ]
  },
  {
    id: 21,
    queries: [
      'men charcoal grey formal trousers flat lay white background',
      'men charcoal suit trousers product photography isolated white background',
      'men dark grey tailored formal pants flat lay white background'
    ]
  },
  {
    id: 22,
    queries: [
      'men navy blue casual trousers flat lay white background',
      'men navy tailored pants product photography isolated white background',
      'men navy cotton trousers flat lay white background'
    ]
  },
  {
    id: 23,
    queries: [
      'men black slim fit formal trousers flat lay white background',
      'men black dress pants product photography isolated white background',
      'men black tailored trousers flat lay white background'
    ]
  },
  {
    id: 24,
    queries: [
      'men beige chinos flat lay white background',
      'men warm beige casual chino pants product photography isolated white background',
      'men beige chino trousers flat lay white background'
    ]
  },
  {
    id: 27,
    queries: [
      'men slate grey jogger pants flat lay white background',
      'men grey sweatpants joggers product photography isolated white background',
      'men grey fleece joggers flat lay white background'
    ]
  },
  {
    id: 29,
    queries: [
      'men stone grey tapered trousers flat lay white background',
      'men light grey tapered dress pants isolated white background',
      'men stone grey trousers flat lay white background'
    ]
  },
  {
    id: 30,
    queries: [
      'men mocha brown wide leg trousers flat lay white background',
      'men brown pleated wide leg pants product photography isolated white background',
      'men brown tailored trousers flat lay white background'
    ]
  },
  {
    id: 31,
    queries: [
      'men heather grey pullover hoodie flat lay white background',
      'men grey french terry hoodie product photography isolated white background',
      'men grey hoodie flat lay white background'
    ]
  },
  {
    id: 32,
    queries: [
      'men deep navy blue hoodie flat lay white background',
      'men navy fleece pullover hoodie product photography isolated white background',
      'men navy blue hoodie flat lay white background'
    ]
  },
  {
    id: 36,
    queries: [
      'men black and grey colour block hoodie flat lay white background',
      'men black grey color block pullover hoodie isolated white background',
      'men colour block hoodie black grey flat lay'
    ]
  },
  {
    id: 38,
    queries: [
      'men sandstone beige fleece hoodie flat lay white background',
      'men warm sand pullover hoodie product photography isolated white background',
      'men sand hoodie flat lay white background'
    ]
  },
  {
    id: 40,
    queries: [
      'men cream pullover hoodie flat lay white background',
      'men off-white raglan sleeve hoodie product photography isolated white background',
      'men natural cream hoodie flat lay white background'
    ]
  },
  {
    id: 43,
    queries: [
      'men charcoal grey quilted puffer jacket flat lay white background',
      'men grey lightweight puffer jacket product photography isolated white background',
      'men charcoal puffer jacket flat lay white background'
    ]
  },
  {
    id: 44,
    queries: [
      'men navy grey varsity jacket flat lay white background',
      'men navy and grey letterman jacket product photography isolated white background',
      'men navy wool varsity jacket grey sleeves flat lay'
    ]
  },
  {
    id: 45,
    queries: [
      'men black leather biker jacket flat lay white background',
      'men ashen black leather motorcycle jacket isolated white background',
      'men leather biker jacket flat lay white background'
    ]
  },
  {
    id: 47,
    queries: [
      'men desert khaki safari field jacket flat lay white background',
      'men khaki utility field jacket product photography isolated white background',
      'men safari jacket khaki flat lay white background'
    ]
  },
  {
    id: 50,
    queries: [
      'men tobacco brown canvas workwear jacket corduroy collar flat lay white background',
      'men brown barn jacket corduroy collar product photography isolated white background',
      'men brown chore jacket corduroy collar flat lay'
    ]
  }
];

async function run() {
  const verifiedUrlsPath = path.resolve(__dirname, '../test/verified-audit-urls.json');
  const verifiedUrls = JSON.parse(fs.readFileSync(verifiedUrlsPath, 'utf8'));

  for (const item of targets) {
    console.log(`\n==================================================`);
    console.log(`[#${item.id}] Searching replacement garment...`);
    let success = false;

    for (const q of item.queries) {
      console.log(`Query: ${q}`);
      const candidates = await searchCandidates(q);
      console.log(`Candidates found: ${candidates.length}`);

      for (const cand of candidates) {
        if (!isGoodUrl(cand)) continue;

        const tempFile = path.resolve(__dirname, `../temp_garment_${item.id}.jpg`);
        const ok = await downloadImage(cand, tempFile);
        if (ok) {
          try {
            console.log(`✓ Valid candidate downloaded from: ${cand.slice(0, 70)}...`);
            execSync(`powershell -ExecutionPolicy Bypass -File scripts/deploy-garment.ps1 -id ${item.id} -srcPath "${tempFile}"`, { stdio: 'inherit' });
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
      await new Promise(r => setTimeout(r, 600));
    }

    if (!success) {
      console.error(`FAILED to find replacement for #${item.id}`);
    }
  }

  console.log('\nAll targets processed!');
}

run().catch(console.error);
