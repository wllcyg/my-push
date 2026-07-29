import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

async function fixTimezone() {
  console.log('🚀 开始更新 Supabase 数据库时区列类型...');
  const connectionString = process.env.POSTGRES_URL;
  const cleanConnectionString = connectionString
    ? connectionString.replace(/\?sslmode=\w+/, '')
    : '';
  const client = new Client({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();

    const sql = `
      -- 1. 将现有的 kh_document 表的时间列提升为 TIMESTAMPTZ
      ALTER TABLE kh_document 
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN publish_time TYPE TIMESTAMPTZ USING publish_time AT TIME ZONE 'UTC';

      -- 2. 将字典表的时间列提升为 TIMESTAMPTZ
      ALTER TABLE kh_category ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
      ALTER TABLE kh_team ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
      ALTER TABLE kh_tag ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
    `;

    await client.query(sql);
    console.log('✅ 数据库时区列类型已成功修正为 TIMESTAMPTZ！');
  } catch (error) {
    console.error('❌ 时区修复 SQL 执行失败:', error.message);
  } finally {
    await client.end();
  }
}

fixTimezone();
