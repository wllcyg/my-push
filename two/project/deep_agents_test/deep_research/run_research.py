import shutil
from pathlib import Path
import sys

# 将项目根目录添加到 python 路径
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from deep_agents_test.deep_research.agnet import orchestrator_agent
from modules.core.supabase_storage import SupabaseStorageService
from modules.core.langfuse_handler import get_langfuse_callback

def run_deep_research(user_prompt: str, session_id: str = "default_session"):
    """
    运行 Agent 深度调研，并在完成后将结果上传至 Supabase，自动清理中间文件，并全程推送到 Langfuse 追踪
    """
    print(f"🚀 [1/3] 开始执行 Agent 调研任务, Session ID: {session_id}...")
    
    # 获取 Langfuse 追踪回调
    langfuse_handler = get_langfuse_callback(session_id=session_id)
    config = {"callbacks": [langfuse_handler]} if langfuse_handler else {}

    # 执行 Orchestrator Agent (全程自动录入 Langfuse)
    agent_output = orchestrator_agent.invoke(
        {"messages": [("user", user_prompt)]},
        config=config
    )
    
    # 2. 检查沙箱中生成的终稿
    workspace_dir = current_dir / "workspace"
    reports_dir = workspace_dir / "reports"
    
    report_files = list(reports_dir.glob("report_*.md")) if reports_dir.exists() else []
    
    uploaded_url = None
    if report_files:
        final_report = report_files[0]
        print(f"📄 [2/3] 找到终稿文件: {final_report.name}，正在上传至 Supabase Storage...")
        
        storage_service = SupabaseStorageService()
        remote_path = f"reports/{session_id}/{final_report.name}"
        uploaded_url = storage_service.upload_file(final_report, remote_path)
    else:
        print("⚠️ [Warning] 在 workspace/reports 目录中未找到终稿报告文件！")

    # 3. 清理中间文件 (sources/)
    sources_dir = workspace_dir / "sources"
    if sources_dir.exists():
        try:
            shutil.rmtree(sources_dir)
            print("🧹 [3/3] 沙箱中间过程文件 (workspace/sources/) 已完成清理")
        except Exception as e:
            print(f"⚠️ 清理中间文件失败: {str(e)}")

    return {
        "agent_output": agent_output,
        "supabase_report_url": uploaded_url
    }

if __name__ == "__main__":
    test_prompt = "请调研 2026 年 LangGraph 与 AutoGen 两个 Agent 框架的对比及最新进展"
    res = run_deep_research(test_prompt, session_id="test_run_001")
    print("\n调研任务执行完毕!")
    print(f"Supabase 报告 URL: {res.get('supabase_report_url')}")
