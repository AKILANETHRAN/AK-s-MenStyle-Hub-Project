import db from '../config/database.js';
import {
  connectMongo,
  getMongoDb,
  isMongoConfigured
} from '../config/mongodb.js';

function withSyncMetadata(document) {
  return {
    ...document,
    synced_at: new Date()
  };
}

async function replaceCollection(collectionName, documents) {
  const collection = getMongoDb().collection(collectionName);

  if (documents.length > 0) {
    await collection.bulkWrite(
      documents.map((document) => ({
        replaceOne: {
          filter: { _id: document._id },
          replacement: withSyncMetadata(document),
          upsert: true
        }
      }))
    );
    await collection.deleteMany({
      _id: { $nin: documents.map((document) => document._id) }
    });
  } else {
    await collection.deleteMany({});
  }
}

export async function syncMongoMirror() {
  if (!isMongoConfigured()) {
    return { skipped: true };
  }

  await connectMongo();

  const products = (await db.prepare('SELECT * FROM products').all())
    .map((product) => ({ _id: product.id, ...product }));

  // Password hashes are intentionally excluded from the MongoDB mirror.
  const users = (await db.prepare(`
    SELECT id, username, full_name, email, role, phone, age, address, city,
           state, pincode, created_at, updated_at
    FROM users
  `).all()).map((user) => ({ _id: user.id, ...user }));

  const orders = (await db.prepare('SELECT * FROM orders').all());
  const orderItems = (await db.prepare('SELECT * FROM order_items').all());
  const itemsByOrderId = new Map();

  for (const item of orderItems) {
    const items = itemsByOrderId.get(item.order_id) || [];
    items.push(item);
    itemsByOrderId.set(item.order_id, items);
  }

  const ordersWithItems = orders.map((order) => ({
    _id: order.id,
    ...order,
    items: itemsByOrderId.get(order.id) || []
  }));

  await replaceCollection('products', products);
  await replaceCollection('users', users);
  await replaceCollection('orders', ordersWithItems);

  return {
    skipped: false,
    products: products.length,
    users: users.length,
    orders: ordersWithItems.length
  };
}

export async function startMongoMirror() {
  if (!isMongoConfigured()) {
    console.warn('[MongoDB] MONGODB_URI is not configured; mirror is disabled.');
    return;
  }

  try {
    const result = await syncMongoMirror();
    console.log('[MongoDB] Initial PostgreSQL mirror complete:', result);
  } catch (error) {
    console.error('[MongoDB] Initial mirror failed:', error.message);
  }

  const intervalMs = Number(process.env.MONGODB_SYNC_INTERVAL_MS || 30000);
  if (!Number.isFinite(intervalMs) || intervalMs < 5000) {
    console.error('[MongoDB] Mirror disabled: MONGODB_SYNC_INTERVAL_MS must be at least 5000 milliseconds.');
    return;
  }

  const interval = setInterval(async () => {
    try {
      const result = await syncMongoMirror();
      console.log('[MongoDB] PostgreSQL mirror refreshed:', result);
    } catch (error) {
      console.error('[MongoDB] Mirror refresh failed:', error.message);
    }
  }, intervalMs);
  interval.unref();
}
