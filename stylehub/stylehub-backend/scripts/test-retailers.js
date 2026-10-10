async function searchSites(q) {
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&FORM=RESTAB';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  const urls = [...html.matchAll(/murl&quot;:&quot;(https:[^&]+)&quot;/g)].map(m => m[1]);
  console.log('Query:', q);
  console.log('Found:', urls.length);
  urls.slice(0, 5).forEach(u => console.log(' ->', u));
}

searchSites('site:uniqlo.com "corduroy overshirt" brown');
searchSites('site:uniqlo.com "smart ankle pants" charcoal');
