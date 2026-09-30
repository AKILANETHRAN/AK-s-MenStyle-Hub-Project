const Database = require('better-sqlite3');
const db = new Database('./config/stylehub.sqlite');

console.log('Tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));

console.log('\nProducts columns:');
console.log(db.prepare("PRAGMA table_info(products)").all().map(c => ({ name: c.name, type: c.type })));

console.log('\nSample products 1, 2, 51:');
console.log(db.prepare("SELECT id, name, price, discount_percent, stock, garment_image, vton_supported FROM products WHERE id IN (1, 2, 51)").all());

console.log('\nwishlist_shares SQL:');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name='wishlist_shares'").get().sql);
console.log('\nwishlist_share_items SQL:');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name='wishlist_share_items'").get().sql);

console.log('\nPurchase items columns:');
console.log(db.prepare("PRAGMA table_info(purchase_items)").all().map(c => ({ name: c.name, type: c.type })));

console.log('\nWishlist shares columns:');
console.log(db.prepare("PRAGMA table_info(wishlist_shares)").all().map(c => ({ name: c.name, type: c.type })));

console.log('\nWishlist share items columns:');
console.log(db.prepare("PRAGMA table_info(wishlist_share_items)").all().map(c => ({ name: c.name, type: c.type })));

console.log('\nWishlist feedback columns:');
console.log(db.prepare("PRAGMA table_info(wishlist_feedback)").all().map(c => ({ name: c.name, type: c.type })));
