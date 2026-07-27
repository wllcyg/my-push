import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

describe('MongoDB Connectivity (e2e)', () => {
  let client: MongoClient;
  const uri = process.env.MONGODB_URI || '';

  beforeAll(() => {
    jest.setTimeout(15000);
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 12000,
    });
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should successfully connect to MongoDB cluster and ping', async () => {
    if (!uri || uri.includes('<your-cluster>')) {
      return;
    }

    await client.connect();
    const adminDb = client.db('admin');
    const pingResult = await adminDb.command({ ping: 1 });

    expect(pingResult).toBeDefined();
    expect(pingResult.ok).toBe(1);
  }, 15000);

  it('should list available databases from MongoDB cluster', async () => {
    if (!uri || uri.includes('<your-cluster>')) {
      return;
    }

    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();

    expect(dbs.databases).toBeDefined();
    expect(Array.isArray(dbs.databases)).toBe(true);
    console.log(
      `[Jest E2E] MongoDB databases: ${dbs.databases.map((db) => db.name).join(', ')}`,
    );
  }, 15000);
});
