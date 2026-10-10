import Database from 'better-sqlite3';

const mem = new Database(':memory:');
mem.exec(`
  CREATE TABLE cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    size TEXT CHECK(size IN ('S','M','L','XL','XXL') OR size IS NULL),
    quantity INTEGER NOT NULL CHECK(quantity > 0)
  );
  CREATE UNIQUE INDEX uq_cart_clothing ON cart_items(cart_id, product_id, size) WHERE size IS NOT NULL;
  CREATE UNIQUE INDEX uq_cart_accessory ON cart_items(cart_id, product_id) WHERE size IS NULL;
`);

mem.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(1, 10, 'M', 1);
mem.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(1, 10, 'L', 1);
console.log('Multiple sizes for clothing inserted successfully!');

try {
  mem.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(1, 10, 'M', 1);
  console.log('ERROR: duplicate allowed!');
} catch(e) {
  console.log('Duplicate clothing size blocked as expected:', e.message);
}

mem.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(1, 50, null, 1);
console.log('Accessory inserted successfully!');

try {
  mem.prepare('INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, ?, ?)').run(1, 50, null, 1);
  console.log('ERROR: duplicate accessory allowed!');
} catch(e) {
  console.log('Duplicate accessory blocked as expected:', e.message);
}

try {
  mem.prepare("INSERT INTO cart_items (cart_id, product_id, size, quantity) VALUES (?, ?, 'XXXL', 1)").run(1, 11);
  console.log('ERROR: invalid size allowed!');
} catch(e) {
  console.log('Invalid size rejected as expected:', e.message);
}
