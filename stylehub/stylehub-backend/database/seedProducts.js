import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase } from '../config/database.js';
import { productsData } from './productsData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function seedProducts() {
  initDatabase();

  console.log(`Starting catalog seed with ${productsData.length} products...`);

  const upsertStmt = db.prepare(`
    INSERT INTO products (
      id, name, description, brand, category, cloth_type, color,
      price, original_price, discount_percent, stock, status,
      image, garment_image, vton_supported, vton_garment_category,
      updated_at
    ) VALUES (
      @id, @name, @description, @brand, @category, @cloth_type, @color,
      @price, @original_price, @discount_percent, @stock, @status,
      @image, @garment_image, @vton_supported, @vton_garment_category,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      brand = excluded.brand,
      category = excluded.category,
      cloth_type = excluded.cloth_type,
      color = excluded.color,
      price = excluded.price,
      original_price = excluded.original_price,
      discount_percent = excluded.discount_percent,
      stock = excluded.stock,
      status = excluded.status,
      image = excluded.image,
      garment_image = excluded.garment_image,
      vton_supported = excluded.vton_supported,
      vton_garment_category = excluded.vton_garment_category,
      updated_at = CURRENT_TIMESTAMP
  `);

  const seedTransaction = db.transaction((items) => {
    // Clean up any extra demo products beyond IDs 1-100
    db.prepare('DELETE FROM products WHERE id > 100').run();

    for (const item of items) {
      upsertStmt.run({
        id: item.id,
        name: item.name,
        description: item.description,
        brand: item.brand,
        category: item.category,
        cloth_type: item.cloth_type,
        color: item.color,
        price: item.price,
        original_price: item.original_price,
        discount_percent: item.discount_percent,
        stock: item.stock,
        status: item.status,
        image: item.image,
        garment_image: item.garment_image,
        vton_supported: item.vton_supported,
        vton_garment_category: item.vton_garment_category
      });
    }
  });

  seedTransaction(productsData);

  // Synchronize db.json files
  const backendDbJson = path.join(__dirname, '../db.json');
  const frontendDbJson = path.join(__dirname, '../../stylehub-frontend/db.json');
  const rootDbJson = path.join(__dirname, '../../db.json');

  const payload = JSON.stringify({ products: productsData }, null, 2);

  fs.writeFileSync(backendDbJson, payload, 'utf-8');
  fs.writeFileSync(frontendDbJson, payload, 'utf-8');
  fs.writeFileSync(rootDbJson, payload, 'utf-8');

  const count = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const vtonCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE vton_supported = 1').get().count;
  const accCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE vton_supported = 0').get().count;

  console.log(`Seeding complete: Total=${count}, VTON Clothing=${vtonCount}, Accessories=${accCount}`);
  console.log(`db.json files updated at:\n- ${backendDbJson}\n- ${frontendDbJson}\n- ${rootDbJson}`);

  return { total: count, vtonCount, accCount };
}

// Allow direct execution: node database/seedProducts.js
if (process.argv[1] && process.argv[1].endsWith('seedProducts.js')) {
  seedProducts();
}
