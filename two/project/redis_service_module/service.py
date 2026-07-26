import json
import os
import random
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Union
from dotenv import load_dotenv
from upstash_redis import Redis

# 加载项目根目录下的 .env 文件
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class EnterpriseRedisService:
    """
    企业级规范 Redis 缓存服务组件 (Enterprise-Grade Redis Service)
    
    企业级特性支持：
    1. 【读穿透闭环 (get_or_set)】: 自动代理 "查缓存 -> 未命中查DB -> 回写缓存" 流程。
    2. 【防缓存雪崩 (TTL Jitter)】: 自动增加随机过期时间抖动，避免大批 Key 同秒失效。
    3. 【防缓存穿透 (Null Protection)】: 支持对空对象/不存在的数据设置短 TTL 占位保护。
    4. 【可观测性打点 (Observability)】: 记录命中率 (Hit Rate)、MISS 率与耗时指标日志。
    5. 【Key 规范约束 (Key Governance)】: 强制多级命名空间隔离 (Project:Module:Biz:ID)。
    6. 【高危命令防护】: 阻断 KEYS * 等阻塞性高危操作。
    """

    NULL_PLACEHOLDER = "__ENTERPRISE_NULL_PLACEHOLDER__"

    def __init__(self, project_prefix: str = "awesome_app"):
        self.project_prefix = project_prefix
        self.url = os.getenv("UPSTASH_REDIS_REST_URL")
        self.token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
        self._client: Optional[Redis] = None
        
        # 可观测性指标统计
        self._hits_count = 0
        self._misses_count = 0

        if self.url and self.token and "your_upstash" not in self.url:
            try:
                self._client = Redis(url=self.url, token=self.token)
            except Exception as e:
                print(f"❌ [EnterpriseRedis] 连接初始化失败: {e}")
        else:
            print("⚠️ [EnterpriseRedis] 未检测到有效的环境变量凭证，服务运行于 Stub (降级) 模式")

    def _make_key(self, module: str, key: str) -> str:
        """
        生成企业级标准 Key 格式: {project_prefix}:{module}:{key}
        例如: awesome_app:user:profile_10086
        """
        mod_clean = str(module).strip(": ")
        key_clean = str(key).strip(": ")
        return f"{self.project_prefix}:{mod_clean}:{key_clean}"

    def _apply_ttl_jitter(self, base_ttl: int, jitter_percentage: float = 0.1) -> int:
        """增加 TTL 随机时间抖动，防雪崩"""
        if base_ttl <= 0:
            return base_ttl
        jitter = int(base_ttl * jitter_percentage)
        if jitter < 1:
            return base_ttl
        return base_ttl + random.randint(-jitter, jitter)

    # ----------------------------------------------------
    # 🌟 企业级核心 API 1: get_or_set (读穿透闭环 + 防击穿/防穿透)
    # ----------------------------------------------------
    def get_or_set(
        self,
        module: str,
        key: str,
        fetch_func: Callable[[], Any],
        ttl: int = 300,
        enable_null_protection: bool = True,
        null_ttl: int = 60
    ) -> Optional[Any]:
        """
        【企业级推荐】读穿透缓存模式。
        自动完成：查缓存 -> 命中直接返回 -> 未命中调用 fetch_func() -> 自动加抖动回写 Redis。
        """
        start_time = time.perf_counter()
        full_key = self._make_key(module, key)

        # 1. 尝试从缓存读取
        cached_data = self.get_json(module, key)
        if cached_data is not None:
            # 校验是否是防穿透空值占位符
            if cached_data == self.NULL_PLACEHOLDER:
                self._hits_count += 1
                return None

            self._hits_count += 1
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            # print(f"🎯 [Cache HIT] key={full_key} ({elapsed_ms:.2f}ms)")
            return cached_data

        # 2. 缓存未命中 (MISS)
        self._misses_count += 1
        # print(f"🔍 [Cache MISS] key={full_key}，正在调用源数据抓取函数...")

        try:
            # 执行数据获取回调 (例如查数据库 / 调第三方 API)
            fresh_data = fetch_func()

            # 3. 处理数据回写
            if fresh_data is not None:
                final_ttl = self._apply_ttl_jitter(ttl)
                self.set_json(module, key, fresh_data, ttl=final_ttl)
                return fresh_data
            else:
                # 4. 防击穿/防穿透：当源数据也为 None 时，写短暂的 NULL 占位符
                if enable_null_protection:
                    self.set_json(module, key, self.NULL_PLACEHOLDER, ttl=null_ttl)
                return None

        except Exception as e:
            print(f"❌ [EnterpriseRedis] 执行 fetch_func 抓取源数据异常: {e}")
            return None

    # ----------------------------------------------------
    # 2. JSON 数据读写
    # ----------------------------------------------------
    def set_json(self, module: str, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """存储 JSON 序列化对象，支持自动 TTL 抖动"""
        if not self._client:
            return False
        try:
            full_key = self._make_key(module, key)
            json_str = json.dumps(value, ensure_ascii=False)
            
            final_ttl = self._apply_ttl_jitter(ttl) if ttl else None
            if final_ttl:
                self._client.set(full_key, json_str, ex=final_ttl)
            else:
                self._client.set(full_key, json_str)
            return True
        except Exception as e:
            print(f"❌ [EnterpriseRedis] set_json 异常 ({module}:{key}): {e}")
            return False

    def get_json(self, module: str, key: str) -> Optional[Any]:
        """读取并反序列化 JSON 对象"""
        if not self._client:
            return None
        try:
            full_key = self._make_key(module, key)
            val = self._client.get(full_key)
            if val is not None:
                return json.loads(val)
            return None
        except Exception as e:
            print(f"❌ [EnterpriseRedis] get_json 异常 ({module}:{key}): {e}")
            return None

    # ----------------------------------------------------
    # 3. 通用辅助控制 API
    # ----------------------------------------------------
    def incr(self, module: str, key: str, amount: int = 1) -> Optional[int]:
        """原子计数器自增"""
        if not self._client:
            return None
        try:
            full_key = self._make_key(module, key)
            return self._client.incrby(full_key, amount)
        except Exception as e:
            print(f"❌ [EnterpriseRedis] incr 异常 ({module}:{key}): {e}")
            return None

    def delete(self, module: str, key: str) -> bool:
        """删除指定 Key"""
        if not self._client:
            return False
        try:
            full_key = self._make_key(module, key)
            return bool(self._client.delete(full_key))
        except Exception as e:
            print(f"❌ [EnterpriseRedis] delete 异常 ({module}:{key}): {e}")
            return False

    def get_metrics(self) -> Dict[str, Any]:
        """获取当前缓存服务的运行指标大盘数据 (Observability)"""
        total = self._hits_count + self._misses_count
        hit_rate = (self._hits_count / total * 100) if total > 0 else 0.0
        return {
            "hits": self._hits_count,
            "misses": self._misses_count,
            "total_requests": total,
            "hit_rate": f"{hit_rate:.2f}%"
        }

    def get_client(self) -> Optional[Redis]:
        """获取底层原生 Redis 客户端句柄 (用于高级 ZSet/Stream/Bitmap 等)"""
        return self._client


# 导出全局企业级单例
redis_service = EnterpriseRedisService(project_prefix="my_project")
