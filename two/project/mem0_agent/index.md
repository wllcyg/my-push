# Mem0 记忆服务说明 (Cloud & OSS 双模式)

`mem0ai` 官方提供了两种不同的使用方式，本模块在 [`service.py`](file:///d:/self/my-push/two/project/mem0/service.py) 中对两者进行了无缝兼容封装：

---

## ⚖️ 两种模式对比

| 模式 | 官方类名 | 适用场景 | 所需 Key / 凭证 | 数据存储 |
| :--- | :--- | :--- | :--- | :--- |
| **1. Cloud 模式 (云端托管)** | `MemoryClient` | 使用 Mem0 官方 SaaS 平台 | 在 [mem0.ai](https://app.mem0.ai) 申请的 API Key (如 `m0-xxx`) | 存储在 Mem0 官方云端 |
| **2. OSS 开源模式 (本地自建)** | `Memory` | 私有化部署 / 自定义向量库与大模型 | 自己的 LLM Key (如阿里云百炼/OpenAI/Ollama) | 存储在本地/自己的 Qdrant/Redis/MySQL |

---

## ⚙️ 模式切换方法

### 方式 A：使用 Cloud 模式 (`MemoryClient`)

只需要在 `.env` 或初始化时传入你在 [app.mem0.ai](https://app.mem0.ai) 申请的 Key：

```env
# .env 文件中
MEM0_API_KEY=m0-your-official-mem0-key
```

```python
from mem0 import memory_service

# 初始化（会自动识别到 MEM0_API_KEY 并以 MemoryClient 启动）
memory_service.initialize() 

print("是否为云端模式:", memory_service.is_cloud_mode) # True
```

---

### 方式 B：使用 OSS 开源自建模式 (`Memory`)

无需在 Mem0 注册，直接使用你现有的阿里云/OpenAI 等大模型凭证：

```env
# .env 文件中
OPENAI_API_KEY=sk-ws-H.RXHYLEH...
OPENAI_BASE_URL=https://ws-zltje74rc65q4wpd.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

```python
from mem0 import memory_service

# 初始化（无 MEM0_API_KEY 时，自动以开源 Memory 模式启动）
memory_service.initialize()

print("是否为云端模式:", memory_service.is_cloud_mode) # False
```

---

## 🚀 统一调用 API（接口完全一致）

无论底层是用 `MemoryClient` 还是 `Memory`，封装后的 Service 方法完全统一：

```python
from mem0 import memory_service

# 1. 添加记忆
await memory_service.add_async(
    messages=[{"role": "user", "content": "我喜欢吃川菜"}],
    user_id="user_123"
)

# 2. 检索记忆
memories = await memory_service.search_async(
    query="用户喜欢吃什么？",
    user_id="user_123"
)

# 3. 删除记忆
await memory_service.delete_async(memory_id="mem_xxx")
```
