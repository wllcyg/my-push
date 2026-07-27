import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Supabase Connectivity (e2e)', () => {
  let client: Client;

  beforeAll(() => {
    jest.setTimeout(15000);
    const connectionString = process.env.POSTGRES_URL;
    client = new Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 12000,
    });
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('should connect to Supabase PostgreSQL and respond to query', async () => {
    await client.connect();
    const res = await client.query('SELECT NOW() as current_time, version();');

    expect(res.rows).toBeDefined();
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows[0].current_time).toBeDefined();
    expect(res.rows[0].version).toContain('PostgreSQL');
  }, 15000);

  it('should check if pgvector extension is available', async () => {
    const vectorRes = await client.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';",
    );

    expect(vectorRes.rows).toBeDefined();
    // 打印状态以供观察
    if (vectorRes.rows.length > 0) {
      console.log(
        `[Jest E2E] Supabase pgvector version: v${vectorRes.rows[0].extversion}`,
      );
    } else {
      console.warn(
        '[Jest E2E] Supabase pgvector extension is not installed yet.',
      );
    }
  }, 15000);
});
