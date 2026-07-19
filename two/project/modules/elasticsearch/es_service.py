import logging
from typing import Any, Dict, List, Optional
from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk
from elasticsearch.exceptions import NotFoundError

logger = logging.getLogger(__name__)

class ElasticSearchService:
    """
    Elasticsearch 增删改查服务的优雅封装 (Singleton 模式实现)
    """
    _instance = None
    client: AsyncElasticsearch = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def connect(self, host: str):
        """初始化连接"""
        if self.client is None:
            self.client = AsyncElasticsearch(host)
            try:
                # Ping 一下测试连通性
                info = await self.client.info()
                print(f"✅ 成功连接到 Elasticsearch! 集群名称: {info.get('cluster_name')}")
            except Exception as e:
                print(f"❌ 连接 Elasticsearch 失败: {e}")
                self.client = None

    async def close(self):
        """关闭连接"""
        if self.client:
            await self.client.close()
            logger.info("🛑 已断开 Elasticsearch 连接。")
            self.client = None

    async def create_index_if_not_exists(self, index_name: str, mappings: Dict[str, Any]):
        """创建索引（如果不存在）"""
        exists = await self.client.indices.exists(index=index_name)
        if exists:
            logger.info(f"ℹ️ 索引 [{index_name}] 已存在，跳过创建。")
            return False
        
        await self.client.indices.create(
            index=index_name,
            body={"mappings": mappings}
        )
        logger.info(f"✅ 成功创建索引 [{index_name}]")
        return True
        
    async def insert_one(self, index_name: str, doc: Dict[str, Any], doc_id: Optional[str] = None) -> str:
        """单条插入/覆盖更新文档"""
        # 如果提供了 doc_id，且文档存在，则为全量覆盖更新；否则为新增
        response = await self.client.index(index=index_name, id=doc_id, document=doc, refresh=True)
        return response["_id"]

    async def update_one(self, index_name: str, doc_id: str, doc_partial: Dict[str, Any]) -> bool:
        """局部更新文档 (推荐)"""
        try:
            await self.client.update(
                index=index_name,
                id=doc_id,
                doc=doc_partial,
                refresh=True
            )
            return True
        except NotFoundError:
            logger.warning(f"⚠️ 更新失败，未找到文档 ID: {doc_id}")
            return False

    async def delete_one(self, index_name: str, doc_id: str) -> bool:
        """根据 ID 删除单条文档"""
        try:
            await self.client.delete(index=index_name, id=doc_id, refresh=True)
            return True
        except NotFoundError:
            return False

    async def bulk_insert(self, index_name: str, docs: List[Dict[str, Any]]) -> int:
        """
        批量插入文档 (性能极佳)
        传入的 docs 如果包含 `_id` 键，则会作为文档的自定义 ID。
        """
        async def generate_actions():
            for doc in docs:
                action = {
                    "_index": index_name,
                    "_source": {k: v for k, v in doc.items() if k != "_id"}
                }
                if "_id" in doc:
                    action["_id"] = doc["_id"]
                yield action

        success_count, _ = await async_bulk(self.client, generate_actions(), refresh=True)
        logger.info(f"✅ 批量写入完成，成功插入 {success_count} 条数据到 [{index_name}]")
        return success_count

    async def search(self, index_name: str, query: Dict[str, Any], size: int = 10, _from: int = 0) -> Dict[str, Any]:
        """
        全文搜索查询
        :param query: 比如 {"match": {"title": "混合检索"}}
        """
        body = {
            "query": query,
            "size": size,
            "from": _from
        }
        
        try:
            response = await self.client.search(index=index_name, body=body)
            hits = response["hits"]["hits"]
            total = response["hits"]["total"]["value"]
            
            # 返回干净的数据结构，剥离掉 ES 的元数据
            return {
                "total": total,
                "items": [
                    {
                        "_id": hit["_id"],
                        "_score": hit["_score"],
                        **hit["_source"]
                    }
                    for hit in hits
                ]
            }
        except NotFoundError:
            return {"total": 0, "items": []}

# 实例化一个全局的 service 供整个应用使用
es_service = ElasticSearchService()
