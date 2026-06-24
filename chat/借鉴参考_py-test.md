# ChineseMate 借鉴参考文档（来源：py-test / VisualTutor）

> 版本：v1.0 | 日期：2026-06-14  
> 用途：记录从 py-test 项目中可复用的设计模式、代码逻辑与工程经验，供 ChineseMate 后端（NestJS）和前端（Next.js）开发参考。

---

## 一、认证与安全

### 1.1 JWT 验证 — JWKS 公钥方案

**来源文件：** `py-test/core/auth.py`

**核心思路：**  
不依赖 Supabase SDK 做服务端 token 校验，而是直接从 Supabase 的公开 JWKS 端点拉取公钥，在本地用 RSA/ES256 验签。优点：
- 无网络往返（公钥缓存在内存），验证速度极快
- 不依赖 Supabase SDK 版本，稳定性更好
- 离线也可以验证

**py-test 实现：**
```python
jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(jwks_url, cache_keys=True)

signing_key = await asyncio.to_thread(jwks_client.get_signing_key_from_jwt, token)
payload = jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256", "HS256"])
```

**ChineseMate NestJS 适配方案：**
```typescript
// 待填写：用 @nestjs/passport + jwks-rsa 实现相同逻辑
// 参考库：jwks-rsa, passport-jwt
```

**待办：**
- [ ] 安装 `jwks-rsa` 和 `passport-jwt`
- [ ] 在 `auth.module.ts` 配置 JWKS 策略
- [ ] 替换现有 `supabase.guard.ts` 的验证方式（或并行保留）

---

### 1.2 会话归属权校验（防 IDOR）

**来源文件：** `py-test/api/chat.py` L39-42

**核心思路：**  
用户 A 通过猜测 conversation_id 尝试访问用户 B 的对话记录。必须在获取会话后，校验 `conversation.user_id === 当前登录用户.id`。

**py-test 实现：**
```python
conv = await DBService.get_conversation(db, conversation_id)
if not conv or conv.user_id != user.id:
    await websocket.close(code=1008)
    return
```

**ChineseMate 适配：**
- 所有涉及 `conversation_id` 的接口都需要这个校验
- 可以封装成 NestJS Guard 或 interceptor

**待办：**
- [ ] 在 `chat.controller.ts` 的流式接口加入归属权校验
- [ ] 在 `history.controller.ts` 的历史记录接口同步加入

---

### 1.3 速率限制

**来源文件：** `py-test/core/rate_limit.py`

**双层策略：**

| 层 | py-test 方案 | ChineseMate 方案 |
|----|-------------|-----------------|
| HTTP 接口 | `slowapi`，200次/分钟/IP | `@nestjs/throttler` |
| SSE/流式接口 | 自定义 IP 并发计数器，≤5连接 | 待设计 |

**py-test WebSocket 并发限制核心逻辑：**
```python
_ws_connections: dict[str, int] = defaultdict(int)
_ws_lock = asyncio.Lock()
WS_MAX_CONNECTIONS_PER_IP = 5

async def ws_acquire(websocket) -> bool:
    client_ip = websocket.client.host
    async with _ws_lock:
        if _ws_connections[client_ip] >= WS_MAX_CONNECTIONS_PER_IP:
            return False
        _ws_connections[client_ip] += 1
    return True
```

**ChineseMate NestJS 适配思路：**
```typescript
// 待填写：用 Map<string, number> + Mutex 实现相同逻辑
// 或使用 Redis 做分布式计数（多实例部署时必须用 Redis）
```

**待办：**
- [ ] 安装 `@nestjs/throttler`，配置全局 HTTP 限流
- [ ] 为 `/api/chat/stream` SSE 接口实现 IP 并发连接限制
- [ ] MVP 阶段可先用内存 Map，后续迁移到 Redis

---

## 二、AI 对话核心

### 2.1 流式输出协议（前后端事件约定）

**来源文件：** `py-test/services/stream_parser.py`

**核心思路：**  
LLM 的 token 流不能直接透传给前端，需要在后端解析成有语义的结构化事件，前端根据 `type` 字段决定如何渲染。

**py-test 的事件类型：**
```
text-chunk       → 普通文本，打字机效果显示
board-create     → 创建画板（GeoGebra / Mermaid / Chem3D）
ggbscript-execute → 执行画板指令
notes-update     → 更新左侧笔记面板
error            → 错误通知
```

**ChineseMate 需要定义的事件协议：**
```typescript
// 建议的事件类型定义（待完善）
type ChatEvent =
  | { type: "text-chunk";   payload: string }              // AI 回复文字，流式追加
  | { type: "pinyin-data";  payload: PinyinAnnotation[] }  // 拼音注释数据
  | { type: "correction";   payload: CorrectionData }      // 用户输入纠错
  | { type: "grammar-note"; payload: string }              // 语法知识点
  | { type: "turn-done";    payload: null }                // 本轮完成
  | { type: "error";        payload: string }              // 错误

interface PinyinAnnotation {
  char: string;
  pinyin: string;
  translation?: string;
}

interface CorrectionData {
  original: string;    // 用户原始输入
  corrected: string;   // 正确表达
  explanation: string; // 纠错说明
}
```

**待办：**
- [ ] 确认并冻结上述事件协议（前后端同时遵守）
- [ ] 后端 `chat.service.ts` 解析 AI 返回的 JSON 块并转成上述事件
- [ ] 前端 `useChat.ts` Hook 按 `type` 路由到不同的 UI 更新逻辑

---

### 2.2 AI System Prompt 管理

**来源文件：** `py-test/services/prompt_manager.py` + `py-test/services/graph/prompts.py`

**核心思路：**  
Prompt 存在数据库的 `system_configs` 表，内存缓存 5 分钟，支持热更新（管理员改数据库，无需重启服务）。代码里只保留 hardcode 的 fallback 默认值。

**py-test 实现：**
```python
class PromptManager:
    _cache = {}
    _cache_ttl = 300  # 5分钟

    @classmethod
    async def get_prompt(cls, key: str, default_value: str = "") -> str:
        now = time.time()
        if key in cls._cache:
            val, expire_time = cls._cache[key]
            if now < expire_time:
                return val   # 命中缓存直接返回
        # 查数据库 → 更新缓存 → 返回
```

**ChineseMate 场景 Prompt 键设计：**
```
scene_prompt_coffee      → 咖啡厅场景系统提示词
scene_prompt_taxi        → 打车场景系统提示词
scene_prompt_restaurant  → 餐厅场景系统提示词
...（每个场景一条记录）
scene_prompt_custom      → 自定义场景的 Prompt 模板
difficulty_addon_beginner  → 初级难度附加指令
difficulty_addon_advanced  → 高级难度附加指令
```

**ChineseMate 场景 Prompt 模板（草稿）：**
```
你是一名资深普通话教师，正在扮演 {role_name} 的角色（场景：{scene_title}）。

学生当前难度等级：{difficulty}
- 初级：只使用 HSK 1-2 级词汇，句子简短，语速慢
- 中级：使用 HSK 3-4 级词汇，自然对话节奏
- 高级：可使用成语、俚语、省略句，体现地道表达

【对话规则】
1. 严格保持角色，全程使用中文，不跳出角色
2. 每条回复后，附加一个 JSON 块：
   {"pinyin": "逐词拼音（空格分隔）", "correction": null, "grammar_note": null}
3. 如用户输入有语法错误，correction 填入正确表达；无错误填 null
4. 温和纠错，不打断对话，继续场景推进
5. 适时插入文化背景小知识（不超过1句）

【开场白】
用一句符合场景的中文打招呼，等待学生回应。
```

**待办：**
- [ ] 在 Supabase 中创建 `system_configs` 表（或复用现有方案）
- [ ] 在 NestJS 实现 `PromptService`，含内存缓存逻辑
- [ ] 写入 20 个场景的 Prompt 初始数据
- [ ] 管理员界面支持在线编辑 Prompt（后续）

---

### 2.3 Redis 短期对话记忆

**来源文件：** `py-test/services/memory_store.py`

**核心思路：**  
每个 `conversation_id` 在 Redis 中缓存最近 N 条消息（序列化为 JSON），TTL 30 分钟。  
避免每次请求都查数据库，同时防止对话历史无限增长导致 token 超限。

**py-test 实现：**
```python
class RedisMemoryStore:
    ttl_seconds = 1800  # 30分钟
    key_prefix = "agent:short_memory"

    async def save_messages(self, conversation_id, messages):
        # 截断规则：超过 10 条只保留最近 8 条
        if len(messages) > 10:
            messages = messages[-8:]
        await redis_client.set(key, json.dumps(messages), ex=self.ttl_seconds)
```

**ChineseMate 适配方案：**
```typescript
// Redis Key 设计
// chat:memory:{conversation_id}:messages  → 消息列表 JSON
// chat:memory:{conversation_id}:metadata  → 场景、难度等元数据

// 截断策略（待确认）
// 对话消息 > 20 条时，只保留最近 16 条
// TTL：60 分钟（比 py-test 略长，因为学习场景用户可能中途暂停）
```

**待办：**
- [ ] 确认 Redis 连接配置（本地开发 + Supabase/Upstash 生产）
- [ ] 实现 `ConversationMemoryService`（NestJS Service）
- [ ] 确认消息截断数量（建议 20 → 16）

---

## 三、数据库设计参考

### 3.1 py-test 核心表对比

| py-test 表 | 用途 | ChineseMate 是否需要 |
|-----------|------|---------------------|
| `users` | 用户信息，含 client_id | ✅ 需要（复用 Supabase Auth，users 表已有） |
| `conversations` | 对话记录，含 token 消耗统计 | ✅ 需要 |
| `messages` | 消息记录，含 `vector(1024)` 向量 | ✅ 需要（向量字段 MVP 可先不加） |
| `user_settings` | 用户自定义 LLM 配置 | ⬜ 暂不需要（用全局配置） |
| `system_configs` | 全局系统配置（Prompt / 模型参数） | ✅ 需要 |
| `molecule_cache` | 化学分子缓存 | ❌ 不需要 |

### 3.2 ChineseMate 需要新增的表

```sql
-- 对话会话表（每次进入场景练习创建一条）
CREATE TABLE practice_sessions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    scene_id    TEXT NOT NULL,           -- 场景 ID，如 "coffee", "taxi"
    difficulty  TEXT NOT NULL,           -- "beginner" | "intermediate" | "advanced"
    status      TEXT DEFAULT 'active',   -- "active" | "completed"
    message_count INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    ended_at    TIMESTAMPTZ
);

-- 消息记录表
CREATE TABLE practice_messages (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT REFERENCES practice_sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,       -- "user" | "assistant"
    content         TEXT NOT NULL,       -- 原始文本
    pinyin_data     JSONB,               -- AI 回复的拼音注释
    correction      JSONB,               -- 纠错数据
    grammar_note    TEXT,                -- 语法知识点
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 系统配置表（Prompt 热更新）
CREATE TABLE system_configs (
    id           BIGSERIAL PRIMARY KEY,
    config_key   TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description  TEXT,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 用户学习统计表
CREATE TABLE user_stats (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id),
    streak_days      INT DEFAULT 0,
    last_active_date DATE,
    total_sessions   INT DEFAULT 0,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**待办：**
- [ ] 在 Supabase 中执行上述 SQL 建表
- [ ] 为 `practice_sessions` 和 `practice_messages` 配置 RLS 策略
- [ ] NestJS 中使用 TypeORM / Prisma 定义对应 Entity

---

## 四、前端借鉴

### 4.1 流式 SSE 消费模式

py-test 前端通过 WebSocket 接收事件；ChineseMate 前端通过 SSE（EventSource）接收。  
核心的事件路由逻辑完全一样：

```typescript
// 建议的 useChat Hook 骨架（待实现）
function useChat(sceneId: string, difficulty: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (userInput: string) => {
    setIsStreaming(true);
    
    const eventSource = new EventSource(`/api/chat/stream?...`);
    
    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data);
      
      switch (event.type) {
        case "text-chunk":
          // 追加到最后一条 AI 消息
          break;
        case "pinyin-data":
          // 更新拼音注释
          break;
        case "correction":
          // 显示纠错气泡
          break;
        case "turn-done":
          setIsStreaming(false);
          eventSource.close();
          break;
        case "error":
          // 显示错误提示
          break;
      }
    };
  };

  return { messages, isStreaming, sendMessage };
}
```

**待办：**
- [ ] 实现完整的 `useChat.ts` Hook
- [ ] 实现带拼音注释的 AI 消息气泡组件
- [ ] 实现纠错展示组件

---

## 五、待确认问题

> 开发过程中遇到的待决策问题，请补充回答。

| # | 问题 | 当前状态 | 回答/决策 |
|---|------|---------|---------|
| 1 | AI 接入用哪个 API？Claudfire / OpenAI / 其他？ | 待确认 | |
| 2 | 后端是否引入 Redis？MVP 是否必须？ | 待确认 | |
| 3 | `system_configs` 表用 Supabase 还是 NestJS 自己管？ | 待确认 | |
| 4 | 消息是否需要向量化存储？MVP 跳过还是上来就做？ | 待确认 | |
| 5 | 每用户每日对话次数上限是多少？（参考 PRD：20轮） | 待确认 | |
| 6 | 场景 Prompt 谁来写初稿？开发者还是产品？ | 待确认 | |

---

## 六、参考文件路径速查

| 文件 | 用途 |
|------|------|
| [py-test/core/auth.py](../py-test/core/auth.py) | JWKS JWT 验证 |
| [py-test/core/rate_limit.py](../py-test/core/rate_limit.py) | 速率限制 + WS 并发控制 |
| [py-test/services/stream_parser.py](../py-test/services/stream_parser.py) | 流式协议解析状态机 |
| [py-test/services/prompt_manager.py](../py-test/services/prompt_manager.py) | Prompt 热更新管理 |
| [py-test/services/memory_store.py](../py-test/services/memory_store.py) | Redis 短期记忆封装 |
| [py-test/services/agent_graph.py](../py-test/services/agent_graph.py) | LangGraph 多智能体图（整体架构参考） |
| [py-test/services/graph/prompts.py](../py-test/services/graph/prompts.py) | System Prompt 工程示范 |
| [py-test/api/chat.py](../py-test/api/chat.py) | 完整对话生命周期（安全 + 缓存 + 流式） |

---

*文档结束 · 持续更新中*
