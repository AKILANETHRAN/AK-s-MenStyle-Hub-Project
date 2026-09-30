import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dir = 'c:/Users/admin/Downloads/files (7)/stylehub/stylehub-backend/public/images/garments';

const hashes = {};
const duplicates = [];

for (let id = 1; id <= 50; id++) {
  const filePath = path.join(dir, `product_${id}.png`);
  if (!fs.existsSync(filePath)) {
    console.log(`MISSING: product_${id}.png`);
    continue;
  }
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('md5').update(buf).digest('hex');
  const size = buf.length;
  
  if (hashes[hash]) {
    duplicates.push({ id1: hashes[hash], id2: id, hash });
  } else {
    hashes[hash] = id;
  }
}

console.log('Duplicates found:', duplicates.length);
duplicates.forEach(d => console.log(`Duplicate: product_${d.id1}.png === product_${d.id2}.png`));
