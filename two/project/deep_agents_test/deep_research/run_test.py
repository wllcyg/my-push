import asyncio
from pathlib import Path
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

# 加载根目录下的 .env 环境变量
root_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(root_dir / ".env")

from deep_agents_test.deep_research.agnet import orchestrator_agent, workspace_dir, get_todos

async def main():
    print("==================================================")
    print("🚀 开始运行 Python 多 Agent 深度调研助手 (Deep Research Agent)")
    print("==================================================")
    print(f"📁 工作区物理沙箱路径: {workspace_dir}")
    
    user_query = "对比分析 LangGraph 与 AutoGen 框架的核心架构与适用场景，并生成一份简报。"
    print(f"\n💡 用户提问: {user_query}\n")
    print("--------------------------------------------------")
    print("🤖 主 Agent (Orchestrator) 启动流转...\n")
    
    try:
        res = await orchestrator_agent.ainvoke({"messages": [HumanMessage(content=user_query)]})
        reply = res["messages"][-1].content
        
        print("\n==================================================")
        print("🎉 【最终报告 / Agent 回复】:\n")
        print(reply)
        
        print("\n==================================================")
        print("📋 【全流程结构化 TODO 状态汇总】:\n")
        todos = get_todos()
        if todos:
            for item in todos:
                status = item.get("status", "pending")
                content = item.get("content", "")
                icon = "✓" if status == "completed" else ("⏳" if status == "in_progress" else " ")
                print(f"[{icon}] {status.upper()}: {content}")
        else:
            print("(无结构化 TODO 记录)")
            
    except Exception as e:
        print(f"\n❌ 执行失败，捕获到异常: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
