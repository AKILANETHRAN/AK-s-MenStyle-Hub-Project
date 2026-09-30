import fs from 'fs';
import path from 'path';

const auditUrls = JSON.parse(fs.readFileSync('./test/verified-audit-urls.json', 'utf8'));
const products = JSON.parse(fs.readFileSync('./scripts/audit-products-metadata.json', 'utf8'));

console.log('AUDITING ALL 50 GARMENT IMAGES:');
console.log('--------------------------------------------------');

const auditResults = [];

products.forEach(p => {
  const urlEntry = auditUrls[p.id] || {};
  const gUrl = urlEntry.garmentUrl || '';
  
  auditResults.push({
    id: p.id,
    name: p.name,
    category: p.category,
    cloth_type: p.cloth_type,
    color: p.color,
    garmentUrl: gUrl
  });
  
  console.log(`[#${p.id}] ${p.name} (${p.category} - ${p.cloth_type} - ${p.color})`);
  console.log(`     Garment URL: ${gUrl}`);
});

fs.writeFileSync('./scripts/garment-source-audit.json', JSON.stringify(auditResults, null, 2));
