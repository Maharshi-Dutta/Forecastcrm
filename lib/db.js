import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function getDb() {
  if (cachedDb) return cachedDb;
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(process.env.DB_NAME || 'forecastcrm');
  return cachedDb;
}

export async function ensureIndexes() {
  const db = await getDb();
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ id: 1 }, { unique: true });
  await db.collection('accounts').createIndex({ id: 1 }, { unique: true });
  await db.collection('deals').createIndex({ id: 1 }, { unique: true });
  await db.collection('deals').createIndex({ ownerId: 1 });
  await db.collection('deals').createIndex({ stage: 1 });
  await db.collection('activities').createIndex({ dealId: 1 });
  await db.collection('contacts').createIndex({ accountId: 1 });
  await db.collection('forecastSnapshots').createIndex({ id: 1 });
  await db.collection('dealAIInsights').createIndex({ dealId: 1 });
  await db.collection('auditTrail').createIndex({ entityId: 1 });
}
