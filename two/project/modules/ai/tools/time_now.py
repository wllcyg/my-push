import json
from datetime import datetime, timezone
from langchain_core.tools import tool

@tool('time_now')
async def time_now() -> str:
    """
    获取当前服务器时间，返回包含 ISO 字符串（iso）和毫秒级时间戳（timestamp）的 JSON 字符串。
    """
    now = datetime.now(timezone.utc)
    
    result = {
        # 兼容 JS 的 toISOString() 格式，例如 2026-07-16T09:21:08.123Z
        "iso": now.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        # Python 的 timestamp 是秒级浮点数，乘以 1000 转换为毫秒级
        "timestamp": int(now.timestamp() * 1000)
    }
    
    # 建议返回 JSON 字符串，方便大模型解析
    return json.dumps(result, ensure_ascii=False)
