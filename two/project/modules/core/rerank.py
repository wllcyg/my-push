from typing import Any, Dict, List, Optional
import httpx
from pydantic import Field
from langchain_core.callbacks.manager import Callbacks
from langchain_core.documents import Document
from langchain_core.documents.compressor import BaseDocumentCompressor
from modules.config.settings import get_settings

class DashScopeRerank(BaseDocumentCompressor):
    """
    针对阿里云 DashScope (比如 Qwen3) 的文档重排器封装
    继承自 LangChain 的 BaseDocumentCompressor
    """
    api_key: Optional[str] = Field(default=None, description="DashScope API Key")
    model: str = Field(default="qwen3-vl-rerank", description="模型名称")
    top_n: int = Field(default=3, description="重排后保留的文档数量")
    base_url: str = Field(
        default="https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank",
        description="DashScope Rerank API URL"
    )

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        # 如果没有传入 api_key，则从应用的全局 settings 中兜底获取
        if not self.api_key:
            settings = get_settings()
            self.api_key = settings.qwen3_vl_rerank or settings.aliyun_api_key
        
        if not self.api_key:
            raise ValueError("DashScope API Key is required for reranking. Please set QWEN3_VL_RERANK in .env")

    def compress_documents(
        self,
        documents: List[Document],
        query: str,
        callbacks: Optional[Callbacks] = None,
    ) -> List[Document]:
        """同步方法执行重排（LangChain 标准接口）"""
        import asyncio
        # 如果处于异步环境但调用了同步方法，可以用 asyncio 兜底运行
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 注意：在真实的完全异步框架 (FastAPI) 中不建议混用，应优先调用 acompress_documents
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(self.acompress_documents(documents, query, callbacks))
            return asyncio.run(self.acompress_documents(documents, query, callbacks))
        except Exception:
            return asyncio.run(self.acompress_documents(documents, query, callbacks))

    async def acompress_documents(
        self,
        documents: List[Document],
        query: str,
        callbacks: Optional[Callbacks] = None,
    ) -> List[Document]:
        """异步方法执行重排，极其适合 FastAPI 等高性能异步框架"""
        if not documents:
            return []

        # 提取需要重排的文本
        doc_contents = [doc.page_content for doc in documents]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "input": {
                "query": query,
                "documents": doc_contents
            },
            "parameters": {
                "return_documents": False,
                "top_n": self.top_n
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.base_url, headers=headers, json=payload, timeout=15.0)
            
            if response.status_code != 200:
                raise ValueError(f"DashScope rerank failed: {response.status_code} {response.text}")
            
            json_data = response.json()
            results = json_data.get("output", {}).get("results")
            
            if not isinstance(results, list):
                raise ValueError(f"Unexpected rerank response: {json_data}")

            # 根据返回的 index 和 relevance_score 重新组合文档
            reranked_docs = []
            for item in results:
                idx = item.get("index")
                score = item.get("relevance_score")
                
                # 获取原始文档
                original_doc = documents[idx]
                
                # 复制一份文档并注入重排打分
                new_metadata = original_doc.metadata.copy()
                new_metadata["relevance_score"] = score
                
                reranked_docs.append(Document(
                    page_content=original_doc.page_content,
                    metadata=new_metadata
                ))

            return reranked_docs
