import asyncio
import httpx
import json

async def test_stream():
    url = "http://127.0.0.1:8521/api/agent/stream_research"
    payload = {"query": "简述 Python 异步并发的原理"}
    
    print(f"正在建立 SSE 连接至: {url}")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                print(f"HTTP 响应状态码: {response.status_code}")
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str:
                            event = json.loads(data_str)
                            print(f"[收到事件] Type: {event.get('event_type')}, Data Summary: {str(event.get('data'))[:120]}")
    except Exception as e:
        print(f"测试脚本提示: 如果服务未在 8521 端口启动，请先运行 python main.py。错误详情: {e}")

if __name__ == "__main__":
    asyncio.run(test_stream())
