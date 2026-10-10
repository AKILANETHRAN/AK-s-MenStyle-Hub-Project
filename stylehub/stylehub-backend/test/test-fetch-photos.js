import fs from 'fs';

async function getDuckDuckGoToken(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const vqdMatch = html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) {
    throw new Error('Failed to extract vqd token');
  }
  return vqdMatch[1];
}

async function searchImages(query, vqd) {
  const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const data = await res.json();
  return data.results || [];
}

async function test() {
  const queries = [
    { id: 1, q: "men slim fit white oxford shirt model photoshoot" },
    { id: 5, q: "men jet black dress shirt model fashion" },
    { id: 8, q: "men blue striped business dress shirt model" },
    { id: 14, q: "men graphic tshirt white bauhaus monochrome streetwear" },
    { id: 21, q: "men charcoal formal trousers tailored pants model" },
    { id: 25, q: "men taupe cargo pants streetwear model" },
    { id: 31, q: "men grey hoodie french terry streetwear fashion model" },
    { id: 42, q: "men black tactical bomber jacket streetwear model" },
    { id: 51, q: "white leather low top sneakers product photography" },
    { id: 61, q: "minimalist matte black mesh watch product photography" }
  ];

  for (const item of queries) {
    try {
      const vqd = await getDuckDuckGoToken(item.q);
      const results = await searchImages(item.q, vqd);
      const candidate = results.find(r => r.image && (r.image.startsWith('http') || r.image.startsWith('https')) && !r.image.includes('amazon') && !r.image.includes('aliexpress')) || results[0];
      console.log(`Product #${item.id} -> ${candidate?.image?.substring(0, 70)}... (${candidate?.title})`);
    } catch (err) {
      console.error(`Product #${item.id} error:`, err.message);
    }
  }
}

test();
