import os
import asyncio
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# 加载 .env 环境变量
load_dotenv()


class MemoryService:
    """
    Mem0 统一记忆服务封装类（单例模式）
    
    自动兼容：
    1. Cloud 模式 (MemoryClient): 官方云服务 (使用 MEM0_API_KEY + filters 参数)
    2. Local/OSS 开源模式 (Memory): 本地自建 (使用 OPENAI_API_KEY / ALIYUN_API_KEY + 命名参数)
    """
    _instance: Optional['MemoryService'] = None
    _client: Any = None
    _is_cloud_mode: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(
        self, 
        mem0_api_key: Optional[str] = None, 
        custom_config: Optional[Dict[str, Any]] = None,
        use_cloud: Optional[bool] = None
    ):
        """
        初始化 Mem0 客户端，优先使用 .env 中的环境变量配置
        """
        if self._client is not None:
            return

        # 优先检测 Mem0 官方平台的 Key (如 m0-xxx)
        mem0_key = mem0_api_key or os.getenv("MEM0_API_KEY")

        # 若存在有效的 MEM0_API_KEY 且未填占位符，以 Cloud 模式初始化
        if use_cloud is True or (use_cloud is not False and mem0_key and not mem0_key.startswith("your_")):
            try:
                from mem0 import MemoryClient
                self._client = MemoryClient(api_key=mem0_key)
                self._is_cloud_mode = True
                print("[Mem0] 已基于 MEM0_API_KEY 以 [Cloud 模式 (MemoryClient)] 初始化完成")
                return
            except Exception as e:
                print(f"[Mem0] 初始化 MemoryClient 失败 ({e})，正在回退至 [.env 环境变量开源模式]...")

        # 本地/开源自建模式 (Memory)
        from mem0 import Memory

        if custom_config is None:
            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ALIYUN_API_KEY")
            base_url = os.getenv("OPENAI_BASE_URL") or os.getenv("OPEN_AI_BASEUEL")
            model_name = os.getenv("OPEN_AI_MODEL_NAME", "glm-4")
            embedding_name = os.getenv("OPEN_AI_EMBEDDING_NAME", "text-embedding-v3")

            custom_config = {
                "llm": {
                    "provider": "openai",
                    "config": {
                        "model": model_name,
                        "openai_base_url": base_url,
                        "api_key": api_key
                    }
                },
                "embedder": {
                    "provider": "openai",
                    "config": {
                        "model": embedding_name,
                        "openai_base_url": base_url,
                        "api_key": api_key
                    }
                }
            }

        self._client = Memory.from_config(custom_config)
        self._is_cloud_mode = False
        print("[Mem0] 已基于 .env 配置以 [开源模式 (Memory)] 初始化完成")

    @property
    def client(self) -> Any:
        if self._client is None:
            self.initialize()
        return self._client

    @property
    def is_cloud_mode(self) -> bool:
        """返回当前是否为 Cloud 模式 (自动触发懒加载初始化)"""
        if self._client is None:
            self.initialize()
        return self._is_cloud_mode

    # ------------------ 同步接口 ------------------

    def add(
        self,
        messages: List[Dict[str, str]],
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """添加/提取记忆 (兼容 Cloud 与 Local 模式)"""
        kwargs = {"messages": messages}
        if user_id: kwargs["user_id"] = user_id
        if agent_id: kwargs["agent_id"] = agent_id
        if run_id: kwargs["run_id"] = run_id
        if metadata: kwargs["metadata"] = metadata

        return self.client.add(**kwargs)

    def search(
        self,
        query: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """检索相关记忆 (自动抹平 Cloud 与 Local 模式在 API 上的传参差异)"""
        if self.is_cloud_mode:
            filters = {}
            if user_id: filters["user_id"] = user_id
            if agent_id: filters["agent_id"] = agent_id
            if run_id: filters["run_id"] = run_id

            res = self.client.search(query, filters=filters, top_k=limit)
        else:
            kwargs = {"query": query, "limit": limit}
            if user_id: kwargs["user_id"] = user_id
            if agent_id: kwargs["agent_id"] = agent_id
            if run_id: kwargs["run_id"] = run_id

            res = self.client.search(**kwargs)

        if isinstance(res, dict):
            return res.get("results", [])
        return res

    def get_all(
        self,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取所有记忆 (自动抹平 Cloud 与 Local 模式在 API 上的传参差异)"""
        if self.is_cloud_mode:
            filters = {}
            if user_id: filters["user_id"] = user_id
            if agent_id: filters["agent_id"] = agent_id
            if run_id: filters["run_id"] = run_id

            res = self.client.get_all(filters=filters)
        else:
            kwargs = {}
            if user_id: kwargs["user_id"] = user_id
            if agent_id: kwargs["agent_id"] = agent_id
            if run_id: kwargs["run_id"] = run_id

            res = self.client.get_all(**kwargs)

        if isinstance(res, dict):
            return res.get("results", [])
        return res

    def delete(self, memory_id: str) -> Dict[str, Any]:
        """删除特定记忆"""
        return self.client.delete(memory_id=memory_id)

    # ------------------ 异步接口 (FastAPI 推荐) ------------------

    async def add_async(
        self,
        messages: List[Dict[str, str]],
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """异步添加记忆"""
        return await asyncio.to_thread(
            self.add,
            messages=messages,
            user_id=user_id,
            agent_id=agent_id,
            run_id=run_id,
            metadata=metadata
        )

    async def search_async(
        self,
        query: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """异步检索记忆"""
        return await asyncio.to_thread(
            self.search,
            query=query,
            user_id=user_id,
            agent_id=agent_id,
            run_id=run_id,
            limit=limit
        )

    async def get_all_async(
        self,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """异步获取所有记忆"""
        return await asyncio.to_thread(
            self.get_all,
            user_id=user_id,
            agent_id=agent_id,
            run_id=run_id
        )

    async def delete_async(self, memory_id: str) -> Dict[str, Any]:
        """异步删除记忆"""
        return await asyncio.to_thread(self.delete, memory_id=memory_id)


# 全局单例
memory_service = MemoryService()

def get_memory_service() -> MemoryService:
    """FastAPI 依赖注入"""
    return memory_service
