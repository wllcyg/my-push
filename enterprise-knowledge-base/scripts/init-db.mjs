import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('🚀 开始在 Supabase 执行 SQL 初始化建表...');
  const connectionString = process.env.POSTGRES_URL;
  // 过滤掉 url 中的 sslmode 避免覆盖 ssl 对象选项
  const cleanConnectionString = connectionString ? connectionString.replace(/\?sslmode=\w+/, '') : '';
  const client = new Client({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'init.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sqlContent);
    console.log('✅ 表结构的 SQL 语句已成功在 Supabase 执行完成！(kh_document 表与 vector 扩展已创建)');
  } catch (error) {
    console.error('❌ SQL 执行失败:', error.message);
  } finally {
    await client.end();
  }
}

initDatabase();
