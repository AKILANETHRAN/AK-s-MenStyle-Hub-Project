import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadAndDeploy(id, url) {
  console.log(`Downloading #${id} from ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!res.ok) {
    console.error('Failed HTTP:', res.status);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const temp = path.resolve(__dirname, `../temp_${id}.jpg`);
  fs.writeFileSync(temp, buf);
  const deployScript = path.resolve(__dirname, 'deploy-garment.ps1');
  execSync(`powershell -ExecutionPolicy Bypass -File "${deployScript}" -id ${id} -srcPath "${temp}"`, { stdio: 'inherit' });
  if (fs.existsSync(temp)) fs.unlinkSync(temp);
  console.log(`DEPLOYED #${id}!`);
  return true;
}

downloadAndDeploy(9, 'https://dz3aw12iizk17.cloudfront.net/cache/catalog/Filson/filson_6_Wale_Corduroy_overshirt_Brown_1-870x1110.jpg');
