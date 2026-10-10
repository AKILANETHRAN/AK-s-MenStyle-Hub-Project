import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../config/stylehub.sqlite');
const db = new Database(dbPath);

console.log('Synchronizing database product records with audited image paths...');

const updateStmt = db.prepare(`
  UPDATE products
  SET image = ?,
      garment_image = ?,
      vton_supported = ?,
      vton_garment_category = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const syncTransaction = db.transaction(() => {
  for (let id = 1; id <= 100; id++) {
    const image = `/images/products/product_${id}.png`;
    const isClothing = id <= 50;
    const garmentImage = isClothing ? `/images/garments/product_${id}.png` : null;
    const vtonSupported = isClothing ? 1 : 0;
    
    let vtonCategory = null;
    if (isClothing) {
      if (id <= 20) vtonCategory = 'tops';
      else if (id <= 30) vtonCategory = 'bottoms';
      else if (id <= 40) vtonCategory = 'tops'; // hoodies
      else if (id <= 50) vtonCategory = 'tops'; // jackets
    }

    updateStmt.run(image, garmentImage, vtonSupported, vtonCategory, id);
  }
});

syncTransaction();
console.log('Successfully updated SQLite products table.');

// Export updated products to JSON files
const products = db.prepare(`SELECT * FROM products ORDER BY id ASC`).all();

const rootDbJson = path.resolve(__dirname, '../../db.json');
const frontDbJson = path.resolve(__dirname, '../../stylehub-frontend/db.json');

[rootDbJson, frontDbJson].forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data)) {
        fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
      } else if (data.products) {
        data.products = products;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
      console.log(`Synchronized ${filePath}`);
    } catch (e) {
      console.warn(`Could not sync ${filePath}: ${e.message}`);
    }
  }
});

console.log('Database and db.json synchronization complete.');
