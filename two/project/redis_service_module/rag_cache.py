"""
RAG 检索链路 Redis 缓存模块
============================
按照文档规范实现两层缓存：

  [4] Query 改写结果缓存 (query_augmentation_cache)
       - Key: rag:query_augment:{query_hash}
       - Value: {"queries": [...]} 扩写结果 JSON
       - TTL: 1 小时（改写结果相对稳定）
       - 收益: 省去一次 LLM structured_output 调用

  [6] 检索结果缓存 (retrieval_result_cache)
       - Key: rag:retrieval:{query_hash}:{index}
       - Value: [{"_id": "...", "doc_text": "...", ...}, ...] 召回 doc 列表（含 chunk 内容）
       - TTL: 10 分钟（知识库可能随时更新，不宜过长）
       - 收益: 省去 ES + Milvus 双路并发检索 + 去重 + rerank 全链路
"""

import hashlib
import re
from typing import Any, Dict, List, Optional

from redis_service_module.service import EnterpriseRedisService


class RagCache:
    """
    RAG 链路 Redis 二级缓存管理器

    使用示例：
        rag_cache = RagCache()

        # [4] Query 改写缓存
        cached = rag_cache.get_augmentation("用户的问题")
        if cached is None:
            result = await augment_query(model, query)
            rag_cache.set_augmentation("用户的问题", result)

        # [6] 检索结果缓存
        cached_docs = rag_cache.get_retrieval("用户的问题", "life_notes")
        if cached_docs is None:
            docs = ... # 调 ES + Milvus + merge + rerank
            rag_cache.set_retrieval("用户的问题", "life_notes", docs)
    """

    # [4] Query 改写结果缓存 TTL：1 小时（改写结果相对稳定）
    AUGMENTATION_TTL = 3600

    # [6] 检索结果缓存 TTL：10 分钟（知识库可能随时变更，保守设置）
    RETRIEVAL_TTL = 600

    def __init__(self, redis_service: Optional[EnterpriseRedisService] = None):
        if redis_service is None:
            from redis_service_module.service import redis_service as default_redis
            self._redis = default_redis
        else:
            self._redis = redis_service

        # 命中率统计
        self._aug_hits = 0
        self._aug_misses = 0
        self._ret_hits = 0
        self._ret_misses = 0

    # ------------------------------------------------------------------ #
    #  内部工具方法
    # ------------------------------------------------------------------ #

    @staticmethod
    def _normalize_query(query: str) -> str:
        """
        归一化原始 query，提升缓存命中率。
        步骤：去首尾空格 → 统一小写 → 合并多余空白 → 去除标点符号
        """
        q = query.strip().lower()
        q = re.sub(r"\s+", " ", q)
        # 去除常见中英文标点，保留数字/字母/汉字
        q = re.sub(r"[^\w\u4e00-\u9fff]", "", q)
        return q

    @staticmethod
    def _make_query_hash(query: str) -> str:
        """对归一化后的 query 取 MD5 hash，作为 Key 的一部分"""
        normalized = RagCache._normalize_query(query)
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()[:16]

    # ------------------------------------------------------------------ #
    #  [4] Query 改写结果缓存
    # ------------------------------------------------------------------ #

    def get_augmentation(self, query: str) -> Optional[Dict[str, Any]]:
        """
        读取 Query 改写缓存。
        返回 None 表示 Cache MISS（需要调用 LLM 改写）。
        返回 dict 表示 Cache HIT（直接使用，跳过 LLM 调用）。
        """
        query_hash = self._make_query_hash(query)
        result = self._redis.get_json("rag:query_augment", query_hash)

        if result is not None:
            self._aug_hits += 1
            print(f"[RagCache][HIT] Query 改写缓存命中: hash={query_hash}")
        else:
            self._aug_misses += 1
            print(f"[RagCache][MISS] Query 改写缓存未命中: hash={query_hash}")

        return result

    def set_augmentation(self, query: str, augmentation: Dict[str, Any]) -> None:
        """将 LLM 改写结果写入 Redis，带 TTL 抖动防雪崩"""
        query_hash = self._make_query_hash(query)
        self._redis.set_json("rag:query_augment", query_hash, augmentation, ttl=self.AUGMENTATION_TTL)
        print(f"[RagCache][SET] Query 改写结果已缓存: hash={query_hash}, TTL={self.AUGMENTATION_TTL}s")

    # ------------------------------------------------------------------ #
    #  [6] 检索结果缓存（合并 + Rerank 后的 topDocuments）
    # ------------------------------------------------------------------ #

    @staticmethod
    def _make_retrieval_key(query: str, index: str) -> str:
        """
        生成检索缓存的复合 Key（query_hash + index 索引名）。
        必须带 index 维度，防止不同知识库串结果。
        """
        query_hash = RagCache._make_query_hash(query)
        return f"{query_hash}:{index}"

    def get_retrieval(self, query: str, index: str) -> Optional[List[Dict[str, Any]]]:
        """
        读取检索结果缓存（ES + Milvus merge + rerank 后的 topDocuments）。
        返回 None 表示 Cache MISS。
        返回 list 表示 Cache HIT，可直接跳过整个检索链路，送入 generate_answer_agent。
        """
        composite_key = self._make_retrieval_key(query, index)
        result = self._redis.get_json("rag:retrieval", composite_key)

        if result is not None:
            self._ret_hits += 1
            print(f"[RagCache][HIT] 检索结果缓存命中: key={composite_key}, 共 {len(result)} 篇文档")
        else:
            self._ret_misses += 1
            print(f"[RagCache][MISS] 检索结果缓存未命中: key={composite_key}")

        return result

    def set_retrieval(self, query: str, index: str, top_documents: List[Dict[str, Any]]) -> None:
        """
        将 rerank 后的 topDocuments 写入 Redis 检索结果缓存。
        TTL 较短（10 分钟），因为知识库可能随时增删改。
        """
        if not top_documents:
            return  # 空结果不缓存，防止穿透

        composite_key = self._make_retrieval_key(query, index)
        self._redis.set_json("rag:retrieval", composite_key, top_documents, ttl=self.RETRIEVAL_TTL)
        print(f"[RagCache][SET] 检索结果已缓存: key={composite_key}, {len(top_documents)} 篇, TTL={self.RETRIEVAL_TTL}s")

    def invalidate_retrieval_by_index(self, index: str) -> None:
        """
        【方案 B 精确失效】当知识库文档更新时，按 index 维度批量清除相关缓存（占位方法）。
        当前 upstash_redis 客户端不支持 SCAN，可在切换本地 Redis 后实现完整版本。
        """
        print(f"⚠️ [RagCache] 精确失效暂不支持（请使用短 TTL 方案A），index={index}")

    # ------------------------------------------------------------------ #
    #  可观测性
    # ------------------------------------------------------------------ #

    def get_metrics(self) -> Dict[str, Any]:
        """获取当前 RAG 缓存命中率指标"""
        aug_total = self._aug_hits + self._aug_misses
        ret_total = self._ret_hits + self._ret_misses

        return {
            "query_augmentation": {
                "hits": self._aug_hits,
                "misses": self._aug_misses,
                "hit_rate": f"{(self._aug_hits / aug_total * 100):.1f}%" if aug_total else "N/A",
            },
            "retrieval": {
                "hits": self._ret_hits,
                "misses": self._ret_misses,
                "hit_rate": f"{(self._ret_hits / ret_total * 100):.1f}%" if ret_total else "N/A",
            }
        }


# 导出全局单例，供 ask_rag.py 各节点直接 import 使用
rag_cache = RagCache()
