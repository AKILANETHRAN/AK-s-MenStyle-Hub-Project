import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function searchBing(query) {
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(query) + '&FORM=RESTAB';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  return [...html.matchAll(/murl&quot;:&quot;(https:[^&]+\.jpg[^&]*)&quot;/gi)].map(m => m[1]);
}

async function fix44() {
  const candidates = await searchBing('men navy wool varsity jacket grey sleeves flat lay isolated white background');
  for (const cand of candidates) {
    if (cand.includes('dreamstime') || cand.includes('shutterstock') || cand.includes('freepik') || cand.includes('mannequin') || cand.includes('team')) continue;
    try {
      const res = await fetch(cand, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 20000) {
          const tempPath = path.resolve(__dirname, '../temp_44.jpg');
          fs.writeFileSync(tempPath, buf);
          const deployScript = path.resolve(__dirname, 'deploy-garment.ps1');
          execSync(`powershell -ExecutionPolicy Bypass -File "${deployScript}" -id 44 -srcPath "${tempPath}"`, { stdio: 'inherit' });
          fs.unlinkSync(tempPath);
          console.log('SUCCESS for #44 with:', cand);
          return;
        }
      }
    } catch {}
  }
}

fix44();
