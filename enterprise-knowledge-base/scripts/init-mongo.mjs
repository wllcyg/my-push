import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function initMongoDB() {
  console.log('🚀 开始在 MongoDB Atlas 初始化集合 (Collection)...');
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<your-cluster>')) {
    console.error('❌ MONGODB_URI 未正确配置！');
    return;
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const dbName = process.env.MONGODB_DB || 'knowledge_hub';
    const db = client.db(dbName);
    console.log(`📌 目标数据库: ${dbName}`);

    // 1. 获取现有集合列表
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map((c) => c.name);

    // 2. 初始化集合 kh_document
    if (!existingNames.includes('kh_document')) {
      await db.createCollection('kh_document');
      console.log('✅ 集合 kh_document 创建成功！');
    } else {
      console.log('ℹ️  集合 kh_document 已存在，无需重复创建');
    }

    // 3. 初始化集合 kh_chunk
    if (!existingNames.includes('kh_chunk')) {
      await db.createCollection('kh_chunk');
      console.log('✅ 集合 kh_chunk 创建成功！');
    } else {
      console.log('ℹ️  集合 kh_chunk 已存在，无需重复创建');
    }

    console.log('--------------------------------------------------');
    console.log('✨ MongoDB Atlas 集合初始化完成！');
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('❌ MongoDB 初始化失败:', error.message);
  } finally {
    await client.close();
  }
}

initMongoDB();
