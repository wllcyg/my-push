import os
from functools import lru_cache
from langchain_openai import OpenAIEmbeddings
from langchain_milvus import Milvus
from modules.config.settings import get_settings

_settings = get_settings()

@lru_cache(maxsize=1)
def get_embeddings() -> OpenAIEmbeddings:
    """获取 Embedding 模型的单例"""
    return OpenAIEmbeddings(
        model=_settings.open_ai_embedding_name or "text-embedding-v4",
        api_key=_settings.aliyun_api_key,
        base_url=_settings.open_ai_baseuel,
        check_embedding_ctx_length=False
    )

@lru_cache(maxsize=1)
def get_vector_store(collection_name: str) -> Milvus:
    """
    获取并初始化 Milvus VectorStore 的单例。
    通过 lru_cache 防止重复连接。
    """
    print(f"正在连接到 Milvus (集合: {collection_name})...")
    
    zilliz_endpoint = _settings.zilliz_endpoint or ""
    zilliz_api_key = _settings.zilliz_api_key or ""
    
    vector_store = Milvus(
        embedding_function=get_embeddings(),
        collection_name=collection_name,
        connection_args={"uri": zilliz_endpoint, "token": zilliz_api_key},
        text_field="content",
        primary_field="id",
        vector_field="vector",
        index_params={
            "metric_type": "COSINE",
            "index_type": "HNSW",
            "params": {"M": 16, "efConstruction": 200}
        },
        search_params={
            "metric_type": "COSINE",
            "params": {"ef": 64}
        }
    )
    
    # 在新版 pymilvus 或 Zilliz Serverless 中，通常不需要手动 load 
    # 或者如果需要，应当使用 vector_store.client.load_collection(collection_name)
    # 我们这里直接移除这块容易报错的逻辑，Zilliz 会自动处理
        
    return vector_store
