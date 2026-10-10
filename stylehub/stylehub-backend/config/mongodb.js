import { MongoClient } from 'mongodb';

let client;
let database;

function getMongoUri() {
  return process.env.MONGODB_URI?.trim();
}

export function isMongoConfigured() {
  return Boolean(getMongoUri());
}

export async function connectMongo() {
  if (database) {
    return database;
  }

  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000
  });
  await client.connect();

  database = client.db(process.env.MONGODB_DB_NAME?.trim() || 'stylehub');
  await database.command({ ping: 1 });
  return database;
}

export function getMongoDb() {
  if (!database) {
    throw new Error('MongoDB is not connected.');
  }
  return database;
}

export async function checkMongoHealth() {
  if (!isMongoConfigured()) {
    return 'MONGODB_NOT_CONFIGURED';
  }

  try {
    await connectMongo();
    await getMongoDb().command({ ping: 1 });
    return 'MONGODB_CONNECTED';
  } catch (error) {
    console.error('[MongoDB] Health check failed:', error.message);
    return 'MONGODB_UNAVAILABLE';
  }
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
  }
}
