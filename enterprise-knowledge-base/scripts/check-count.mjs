import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pkg;
async function count() {
  const pgUrl = process.env.POSTGRES_URL.replace(/\?sslmode=\w+/, '');
  const pgClient = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  const res = await pgClient.query('SELECT count(*), count(embedding) FROM kh_document_chunk');
  console.log('🔥 实时数据库切片数:', res.rows[0]);
  await pgClient.end();
}
count();
