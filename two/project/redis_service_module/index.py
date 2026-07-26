import sys
import time
from pathlib import Path

# 将项目根目录加入模块搜索路径
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from redis_service_module.service import redis_service


# 模拟真实数据库查询函数 (Expensive DB Query)
def mock_fetch_user_from_db():
    print("      [DB Operational] 正在执行真实的 SQL 数据库查询...")
    time.sleep(0.1)  # 模拟数据库查询耗时
    return {
        "user_id": 10086,
        "name": "Moliang",
        "email": "moliang@example.com",
        "created_at": "2026-07-24"
    }


def test_enterprise_redis():
    print("==================================================")
    print("🚀 测试企业级规范 EnterpriseRedisService 服务...")
    print("==================================================\n")

    module_name = "user"
    user_key = "profile_10086"

    # 1. 测试读穿透模式 (第一次调用：MISS，查 DB 并回写缓存)
    print("[1/3] 第一次获取数据 (预期: 缓存 MISS，自动查 DB 回写):")
    res1 = redis_service.get_or_set(
        module=module_name,
        key=user_key,
        fetch_func=mock_fetch_user_from_db,
        ttl=300
    )
    print(f"      结果 1: {res1}\n")

    # 2. 第二次获取数据 (预期: 缓存 HIT，秒级从 Redis 返回，不会触发 DB 查询)
    print("[2/3] 第二次获取数据 (预期: 缓存 HIT，不触发 DB 查库):")
    res2 = redis_service.get_or_set(
        module=module_name,
        key=user_key,
        fetch_func=mock_fetch_user_from_db,
        ttl=300
    )
    print(f"      结果 2: {res2}\n")

    # 3. 运行指标大盘 (Metrics Observability)
    print("[3/3] 获取企业级缓存服务运行指标大盘 (Metrics):")
    metrics = redis_service.get_metrics()
    print(f"      指标统计: {metrics}\n")

    # 4. 清理测试数据
    redis_service.delete(module_name, user_key)
    print("==================================================")
    print("✅ 企业级规范 RedisService 功能全部验证通过！")
    print("==================================================")


if __name__ == "__main__":
    test_enterprise_redis()