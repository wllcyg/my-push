import asyncio
import sys
from pathlib import Path

# 保证在 Windows 控制台输出 Unicode/Emoji 不抛出 GBK 编码异常
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 将项目根目录放入 sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))


from modules.ai.ai_service import AiService

async def test_deep_research_stream():
    print("==================================================")
    print("🚀 [测试] 开始测试 Deep Research 多 Agent 报告生成流")
    print("==================================================")

    ai_svc = AiService()
    prompt = "撰写一份关于 LangGraph 的简短分析报告"
    test_session_id = "test_deep_research_session_999"

    print(f"提问: {prompt}")
    print(f"Session ID: {test_session_id}\n")

    stream_gen, session_id = await ai_svc.generate_reply_stream(
        prompt=prompt,
        user_id=1,
        session_id=test_session_id
    )

    print("--- 接收流式输出 (Stream Output) ---")
    full_output = []
    async for chunk in stream_gen:
        print(chunk, end="", flush=True)
        full_output.append(chunk)

    print("\n--------------------------------------------------")
    print("✅ [测试] 完整流式输出接收完毕！")
    
    # 验证本地临时沙箱目录已被自动清理
    session_workspace = project_root / "workspace_sessions" / test_session_id
    if not session_workspace.exists():
        print(f"✅ [验证成功] 本地临时沙箱目录已成功自动清理: {session_workspace}")
    else:
        print(f"⚠️ [警告] 临时沙箱目录仍存在: {session_workspace}")

if __name__ == "__main__":
    asyncio.run(test_deep_research_stream())
