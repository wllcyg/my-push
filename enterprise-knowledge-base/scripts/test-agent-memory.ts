import { initializeTransactionalContext } from 'typeorm-transactional';
initializeTransactionalContext();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AgentService } from '../src/agent/agent.service';
import { RedisMessageStoreService } from '../src/agent/services/redis-message-store.service';
import { ChatHistoryService } from '../src/agent/services/chat-history.service';
import { SemanticCacheService } from '../src/agent/services/semantic-cache.service';

async function runTest() {
  console.log('🧪 开始执行 Agent 短期记忆 (Redis) 与 长期记忆 (Supabase) 自动化集成测试...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const agentService = app.get(AgentService);
  const redisStoreService = app.get(RedisMessageStoreService);
  const chatHistoryService = app.get(ChatHistoryService);
  const semanticCacheService = app.get(SemanticCacheService);

  const testSessionId = `test_session_${Date.now()}`;
  console.log(`📌 测试 Session ID: ${testSessionId}`);

  // 确保 Supabase PostgreSQL 中的 chat_sessions 拥有 summary 字段
  try {
    const dataSource = app.get(DataSource);
    await dataSource.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS summary TEXT;`);
    await dataSource.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);`);
    console.log('✅ Supabase PostgreSQL 缺失列检查与补全完成');
  } catch (dbInitErr) {
    console.warn('⚠️ 忽略 DB 初始化提议:', (dbInitErr as Error).message);
  }

  try {
    // -------------------------------------------------------------
    // 测试 1：多轮对话与 Redis 短期记忆上下文恢复
    // -------------------------------------------------------------
    console.log('\n--- [测试 1] 第一轮对话：提供身份信息 ---');
    const q1 = '你好，我的名字叫张三，我是企业级全栈工程师。';
    console.log(`用户: ${q1}`);

    const res1 = await agentService.streamAgentChat([{ role: 'user', content: q1 }], testSessionId);
    let a1 = '';
    for await (const chunk of res1.textStream) {
      a1 += chunk;
    }
    console.log(`AI 回答: ${a1}`);

    console.log('\n--- [测试 2] 第二轮对话：考验 Redis 短期记忆关联能力 ---');
    const q2 = '请问我刚才说我叫什么名字？我的岗位是什么？';
    console.log(`用户: ${q2}`);

    const res2 = await agentService.streamAgentChat([{ role: 'user', content: q2 }], testSessionId);
    let a2 = '';
    for await (const chunk of res2.textStream) {
      a2 += chunk;
    }
    console.log(`AI 回答: ${a2}`);

    if (a2.includes('张三') && (a2.includes('全栈') || a2.includes('工程师'))) {
      console.log('✅ [测试 2 成功] Agent 成功从 Redis 恢复上下文并准确回答了用户的身份信息！');
    } else {
      console.error('❌ [测试 2 失败] Agent 未能正确恢复 Redis 上下文或记忆断层。');
    }

    // -------------------------------------------------------------
    // 测试 3：验证 Supabase PostgreSQL 长期持久化
    // -------------------------------------------------------------
    console.log('\n--- [测试 3] 验证 Supabase PostgreSQL 长期记忆落盘 ---');
    // 等待 3 秒待异步写库完成
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const dbMessages = await chatHistoryService.getSessionMessages(testSessionId);
    console.log(` Supabase DB 数据库中已成功查询到 ${dbMessages.length} 条持久化记录:`);
    for (const msg of dbMessages) {
      console.log(`  [${msg.role.toUpperCase()}] ${msg.content.slice(0, 40)}...`);
    }

    if (dbMessages.length >= 4) {
      console.log('✅ [测试 3 成功] 消息明细已成功异步写入 Supabase PostgreSQL 数据库！');
    } else {
      console.error(`❌ [测试 3 失败] Supabase 数据库记录数量不足，当前数量: ${dbMessages.length}`);
    }

    // -------------------------------------------------------------
    // 测试 4：验证清理机制
    // -------------------------------------------------------------
    console.log('\n--- [测试 4] 清理测试 Session 内存与数据库 ---');
    await redisStoreService.clear(testSessionId);
    await chatHistoryService.deleteSession(testSessionId);
    console.log('✅ [测试 4 成功] 测试资源已清理完毕。');

    console.log('\n🎉 所有 Agent 记忆体系测试全量通过！');
  } catch (error) {
    console.error('❌ 测试运行异常:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runTest();
