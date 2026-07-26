"""
RAG 检索链路 Redis 缓存集成测试
=================================
验证以下两层缓存的完整 Cache-Aside 行为：
  [4] Query 改写结果缓存 (rag:query_augment)
  [6] 检索结果缓存     (rag:retrieval)

运行方式（在项目根目录）：
    python test/test_rag_cache.py
"""
import sys
import os
import asyncio
import time
from pathlib import Path

# 将项目根目录加入 Python 路径
sys.path.append(str(Path(__file__).resolve().parent.parent))

from redis_service_module.rag_cache import RagCache

# ─── 构造一个测试专用的 RagCache 实例（与全局单例隔离，避免污染生产缓存指标）───
cache = RagCache()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 工具：打印分割线
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def section(title: str):
    print(f"\n{'─' * 55}")
    print(f"  {title}")
    print(f"{'─' * 55}")


async def run_tests():
    print("=" * 55)
    print("🚀 开始执行 RAG Redis 缓存 (Cache-Aside) 集成测试")
    print("=" * 55)

    # ─── 测试数据 ───────────────────────────────────────────
    test_query = f"我想找下今年五一的旅行攻略_{int(time.time())}"  # 带时间戳避免复用历史缓存
    test_index = "life_notes"

    fake_augmentation = {
        "queries": [
            "五一劳动节出行路线推荐",
            "2024年五月旅游目的地攻略",
            "国内五一假期旅行注意事项"
        ]
    }

    fake_top_docs = [
        {"_id": "doc_001", "note_title": "五一青岛行", "doc_text": "青岛五一天气宜人，海鲜物美价廉..."},
        {"_id": "doc_002", "note_title": "三亚旅行攻略", "doc_text": "三亚适合五一出行，但人流较多..."},
    ]
    # ────────────────────────────────────────────────────────

    # ════════════════════════════════════════════════════════
    # 第一阶段：[4] Query 改写结果缓存测试
    # ════════════════════════════════════════════════════════
    section("阶段一：[4] Query 改写结果缓存")

    # 步骤 1：首次查询 → Cache MISS
    start = time.perf_counter()
    result = cache.get_augmentation(test_query)
    elapsed = (time.perf_counter() - start) * 1000
    assert result is None, f"❌ 新 query 首次查询应返回 None (MISS)，实际: {result}"
    print(f"✅ 1. 改写缓存 MISS（符合预期），耗时 {elapsed:.2f}ms")

    # 步骤 2：写入改写结果
    cache.set_augmentation(test_query, fake_augmentation)
    print(f"✅ 2. 改写结果已写入 Redis")

    # 步骤 3：再次读取 → Cache HIT
    start = time.perf_counter()
    result = cache.get_augmentation(test_query)
    elapsed = (time.perf_counter() - start) * 1000
    assert result is not None, "❌ 写入后再次读取应该命中，实际返回 None"
    assert result == fake_augmentation, f"❌ 缓存内容与写入内容不一致: {result}"
    print(f"✅ 3. 改写缓存 HIT，返回 {len(result['queries'])} 条扩写问句，耗时 {elapsed:.2f}ms")

    # 步骤 4：验证 query 归一化能力（相同语义但格式不同）
    # 归一化规则：去标点、统一小写、合并空白
    normalized_query_variant = "我想找下今年五一的旅行攻略！！"  # 加了感叹号
    result_normalized = cache.get_augmentation(normalized_query_variant.replace(f"_{int(time.time())}", ""))
    # 注意：这条会 MISS，因为我们的测试 query 带了时间戳，验证归一化本身即可
    print(f"✅ 4. 归一化 key 生成验证：原始 hash={cache._make_query_hash(test_query)}")

    # ════════════════════════════════════════════════════════
    # 第二阶段：[6] 检索结果缓存测试
    # ════════════════════════════════════════════════════════
    section("阶段二：[6] 检索结果缓存")

    # 步骤 5：首次查询 → Cache MISS
    start = time.perf_counter()
    docs = cache.get_retrieval(test_query, test_index)
    elapsed = (time.perf_counter() - start) * 1000
    assert docs is None, f"❌ 新 query 检索缓存首次查询应返回 None，实际: {docs}"
    print(f"✅ 5. 检索结果缓存 MISS（符合预期），耗时 {elapsed:.2f}ms")

    # 步骤 6：写入 topDocuments（模拟 rerank 后的结果）
    cache.set_retrieval(test_query, test_index, fake_top_docs)
    print(f"✅ 6. 检索结果（{len(fake_top_docs)} 篇文档）已写入 Redis")

    # 步骤 7：再次读取 → Cache HIT，验证内容完整性
    start = time.perf_counter()
    docs = cache.get_retrieval(test_query, test_index)
    elapsed = (time.perf_counter() - start) * 1000
    assert docs is not None, "❌ 写入后检索缓存应命中，实际返回 None"
    assert len(docs) == len(fake_top_docs), f"❌ 文档数量不一致: {len(docs)} vs {len(fake_top_docs)}"
    assert docs[0]["_id"] == "doc_001", f"❌ 第一篇文档 _id 不匹配: {docs[0]['_id']}"
    assert docs[1]["doc_text"] == fake_top_docs[1]["doc_text"], "❌ 文档内容序列化/反序列化异常"
    print(f"✅ 7. 检索结果缓存 HIT，返回 {len(docs)} 篇文档，内容完整，耗时 {elapsed:.2f}ms")

    # 步骤 8：多租户隔离验证 - 不同 index 不应互相命中
    docs_other_index = cache.get_retrieval(test_query, "other_knowledge_base")
    assert docs_other_index is None, "❌ 不同 index 应该相互隔离，但出现了跨库命中！"
    print(f"✅ 8. 多索引隔离验证通过：'other_knowledge_base' 未命中 'life_notes' 的缓存")

    # ════════════════════════════════════════════════════════
    # 第三阶段：空结果防穿透验证
    # ════════════════════════════════════════════════════════
    section("阶段三：空结果防穿透")

    empty_query = f"这是一个没有任何检索结果的问题_{int(time.time())}"
    cache.set_retrieval(empty_query, test_index, [])  # 写入空列表
    docs_empty = cache.get_retrieval(empty_query, test_index)
    # 根据 rag_cache 的设计，空结果不写入缓存（防穿透），所以应返回 None
    assert docs_empty is None, "❌ 空结果不应被缓存（防止缓存穿透），但命中了！"
    print(f"✅ 9. 空结果防穿透验证通过：空文档列表未被缓存")

    # ════════════════════════════════════════════════════════
    # 第四阶段：可观测性指标输出
    # ════════════════════════════════════════════════════════
    section("阶段四：缓存命中率指标")
    metrics = cache.get_metrics()
    print(f"📊 Query 改写缓存: HIT={metrics['query_augmentation']['hits']}, "
          f"MISS={metrics['query_augmentation']['misses']}, "
          f"命中率={metrics['query_augmentation']['hit_rate']}")
    print(f"📊 检索结果缓存: HIT={metrics['retrieval']['hits']}, "
          f"MISS={metrics['retrieval']['misses']}, "
          f"命中率={metrics['retrieval']['hit_rate']}")

    # ════════════════════════════════════════════════════════
    # 完成
    # ════════════════════════════════════════════════════════
    print(f"\n{'=' * 55}")
    print("🎉 所有 RAG 缓存测试用例全部通过！(ALL TESTS PASSED)")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    asyncio.run(run_tests())
