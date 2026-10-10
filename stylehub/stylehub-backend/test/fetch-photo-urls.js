import fs from 'fs';

async function getDuckDuckGoToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await res.text();
  const vqdMatch = html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) return null;
  return vqdMatch[1];
}

async function searchCandidates(query) {
  try {
    const vqd = await getDuckDuckGoToken(query);
    if (!vqd) return [];
    await new Promise(r => setTimeout(r, 600));
    const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await res.json();
    return (data.results || []).map(r => r.image).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function verifyDownload(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);
    if (res.status !== 200) return false;
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > 0 && len < 15000) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const prods = JSON.parse(fs.readFileSync('test/catalog-summary.json', 'utf8'));
  console.log(`Starting candidate search for ${prods.length} products...`);

  const results = {};
  if (fs.existsSync('test/product-photo-urls.json')) {
    Object.assign(results, JSON.parse(fs.readFileSync('test/product-photo-urls.json', 'utf8')));
  }

  for (let i = 0; i < prods.length; i++) {
    const p = prods[i];
    if (results[p.id]) {
      console.log(`Product #${p.id} already has verified URL.`);
      continue;
    }

    const queries = [
      `${p.name} men fashion`,
      `men ${p.color} ${p.cloth_type} fashion model`,
      `${p.color} ${p.category} men product photo`
    ];

    let foundUrl = null;

    for (const q of queries) {
      console.log(`[#${p.id}] Searching: "${q}"...`);
      const candidates = await searchCandidates(q);
      for (const cand of candidates) {
        // Skip notorious 403 blockers
        if (cand.includes('pinimg.com') || cand.includes('aliexpress') || cand.includes('amazon.com') || cand.includes('ebay.com')) {
          continue;
        }
        const ok = await verifyDownload(cand);
        if (ok) {
          foundUrl = cand;
          console.log(`[#${p.id} PASS] Found: ${cand.slice(0, 75)}...`);
          break;
        }
      }
      if (foundUrl) break;
      await new Promise(r => setTimeout(r, 1200));
    }

    if (foundUrl) {
      results[p.id] = foundUrl;
      fs.writeFileSync('test/product-photo-urls.json', JSON.stringify(results, null, 2));
    } else {
      console.warn(`[#${p.id} FAIL] No working image found for "${p.name}"`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('Search finished. Total verified URLs:', Object.keys(results).length);
}

main().catch(console.error);
