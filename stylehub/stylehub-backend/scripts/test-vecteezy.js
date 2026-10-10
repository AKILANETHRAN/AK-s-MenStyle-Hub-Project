async function checkVecteezy(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  const matches = [...html.matchAll(/https:\/\/static\.vecteezy\.com\/system\/resources\/[^\s"']+\.(png|jpg)/gi)].map(m => m[0]);
  console.log('Matches found:', matches.length);
  const preview = matches.find(m => m.includes('previews') || m.includes('thumbnails') || m.includes('large'));
  console.log('Best match:', preview || matches[0]);
}

checkVecteezy('https://www.vecteezy.com/png/27788979-classic-men-s-dark-blue-dress-pants-for-formal-business-and-elegant-occasions-free-png');
