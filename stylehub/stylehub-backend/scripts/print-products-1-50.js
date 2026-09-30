import fs from 'fs';
const prods = JSON.parse(fs.readFileSync('./scripts/audit-products-metadata.json', 'utf8'));
prods.forEach(p => {
  console.log(`${p.id}: ${p.name} | Cat: ${p.category} | Type: ${p.cloth_type} | Color: ${p.color}`);
});
