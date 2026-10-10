import { connectMongo, getMongoDb } from '../config/mongodb.js';

function parseNumericId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getMongoCollection(collectionName, res) {
  try {
    await connectMongo();
    return getMongoDb().collection(collectionName);
  } catch (error) {
    console.error(`[MongoDB] Could not read ${collectionName}:`, error.message);
    res.status(503).json({
      status: 'error',
      message: 'MongoDB is currently unavailable.'
    });
    return null;
  }
}

export async function getMirroredUser(req, res) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ status: 'error', message: 'User ID must be a positive integer.' });
  }

  const users = await getMongoCollection('users', res);
  if (!users) return;

  const user = await users.findOne({ _id: id });
  if (!user) {
    return res.status(404).json({ status: 'error', message: 'User not found in MongoDB mirror.' });
  }

  return res.status(200).json(user);
}

export async function getMirroredOrder(req, res) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    return res.status(400).json({ status: 'error', message: 'Order ID must be a positive integer.' });
  }

  const orders = await getMongoCollection('orders', res);
  if (!orders) return;

  const order = await orders.findOne({ _id: id });
  if (!order) {
    return res.status(404).json({ status: 'error', message: 'Order not found in MongoDB mirror.' });
  }

  return res.status(200).json(order);
}
