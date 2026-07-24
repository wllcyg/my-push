import json
import os
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional

# 获取 workspace 绝对路径
CURRENT_DIR = Path(__file__).resolve().parent
DEEP_RESEARCH_DIR = CURRENT_DIR.parent.parent / "deep_agents_test" / "deep_research"
WORKSPACE_DIR = DEEP_RESEARCH_DIR / "workspace"


def _safe_json_dumps(data: Dict[str, Any]) -> str:
    """安全的 JSON 序列化辅助函数"""
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return json.dumps({"event_type": "error", "data": {"message": "JSON 序列化失败"}}, ensure_ascii=False)


async def parse_agent_events(
    agent: Any, 
    input_messages: Dict[str, Any], 
    config: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """
    接收 CompiledAgentWrapper 实例与输入参数，监听 LangGraph 内部的 astream_events(v2)，
    转化为前端可直接消费的 Server-Sent Events (SSE) 流数据。
    """
    if config is None:
        config = {"recursion_limit": 100}
    elif "recursion_limit" not in config:
        config["recursion_limit"] = 100

    # 追溯追踪已生成报告的内容哈希，避免重复推送大量全文
    last_report_content = ""

    # 推送初始化开始事件
    yield f"data: {_safe_json_dumps({'event_type': 'status_change', 'data': {'status': 'started', 'message': 'Deep Research Agent 已启动，正在进行战略规划...'}})}\n\n"

    try:
        # 调用底层 LangGraph 的 astream_events
        async for event in agent.astream_events(input_messages, version="v2", config=config):
            kind = event.get("event")
            name = event.get("name", "")
            data_field = event.get("data", {})

            # ----------------------------------------------------
            # 1. 工具调用开始 (on_tool_start)
            # ----------------------------------------------------
            if kind == "on_tool_start":
                tool_input = data_field.get("input", {})
                
                # 情况 A：委派子 Agent (task 工具)
                if name == "task":
                    subagent_type = tool_input.get("subagent_type", "general")
                    description = tool_input.get("description", "")
                    target_file = tool_input.get("target_file", "")
                    
                    payload = {
                        "event_type": "subagent_delegate",
                        "data": {
                            "subagent_type": subagent_type,
                            "description": description,
                            "target_file": target_file,
                            "status": "active"
                        }
                    }
                    yield f"data: {_safe_json_dumps(payload)}\n\n"

                # 情况 B：写文件工具 (write_file / edit_file)
                elif name in ("write_file", "edit_file"):
                    file_path = tool_input.get("file_path", tool_input.get("path", ""))
                    content = tool_input.get("content", "")
                    
                    payload = {
                        "event_type": "tool_call",
                        "data": {
                            "tool_name": name,
                            "status": "start",
                            "input": {"file_path": file_path, "summary": f"准备写入文件: {file_path}"}
                        }
                    }
                    yield f"data: {_safe_json_dumps(payload)}\n\n"

                # 情况 C：通用工具 (web_search, python_repl, write_todos 等)
                else:
                    payload = {
                        "event_type": "tool_call",
                        "data": {
                            "tool_name": name,
                            "status": "start",
                            "input": tool_input
                        }
                    }
                    yield f"data: {_safe_json_dumps(payload)}\n\n"

            # ----------------------------------------------------
            # 2. 工具调用结束 (on_tool_end)
            # ----------------------------------------------------
            elif kind == "on_tool_end":
                raw_output = data_field.get("output", "")
                output_str = str(raw_output)

                # 如果是 write_file 工具结束，检查是否产生了报告或 findings
                if name in ("write_file", "edit_file"):
                    tool_input = data_field.get("input", {})
                    file_path_str = tool_input.get("file_path", tool_input.get("path", ""))
                    
                    # 灵活匹配报告文件路径
                    if any(k in file_path_str for k in ("reports", "draft", "report", "findings", "简报")):
                        # 在 WORKSPACE_DIR 及其子目录中查找该文件
                        target_file_name = Path(file_path_str).name
                        found_path = None
                        
                        # 优先查找直连路径
                        direct_path = WORKSPACE_DIR / file_path_str.lstrip("/")
                        if direct_path.exists():
                            found_path = direct_path
                        else:
                            # 递归搜索相符的文件
                            matched_files = list(WORKSPACE_DIR.glob(f"**/{target_file_name}"))
                            if matched_files:
                                found_path = matched_files[0]
                                
                        if found_path and found_path.exists():
                            try:
                                report_text = found_path.read_text(encoding="utf-8")
                                if report_text != last_report_content:
                                    last_report_content = report_text
                                    report_payload = {
                                        "event_type": "report_update",
                                        "data": {
                                            "file_name": found_path.name,
                                            "file_path": str(found_path),
                                            "content": report_text
                                        }
                                    }
                                    yield f"data: {_safe_json_dumps(report_payload)}\n\n"
                            except Exception as e:
                                print(f"[AgentStreamer] 读取报告文件失败: {e}")

                payload = {
                    "event_type": "tool_call",
                    "data": {
                        "tool_name": name,
                        "status": "end",
                        "output_summary": output_str[:300] + "..." if len(output_str) > 300 else output_str
                    }
                }
                yield f"data: {_safe_json_dumps(payload)}\n\n"

            # ----------------------------------------------------
            # 3. 大模型 Token 打字机实时流 (on_chat_model_stream)
            # ----------------------------------------------------
            elif kind == "on_chat_model_stream":
                chunk = data_field.get("chunk", None)
                if chunk and hasattr(chunk, "content") and chunk.content:
                    # 避免推送纯空白或者非文本内容
                    text_delta = str(chunk.content)
                    if text_delta:
                        payload = {
                            "event_type": "text_stream",
                            "data": {
                                "delta": text_delta
                            }
                        }
                        yield f"data: {_safe_json_dumps(payload)}\n\n"

            # ----------------------------------------------------
            # 4. Chain 节点状态转换 (on_chain_start)
            # ----------------------------------------------------
            elif kind == "on_chain_start":
                node_name = name if name else "Agent Pipeline"
                # 过滤不必要的内部 LangGraph node
                if node_name not in ("LangGraph", "StateGraph", "__start__"):
                    payload = {
                        "event_type": "node_state",
                        "data": {
                            "node": node_name,
                            "status": "running"
                        }
                    }
                    yield f"data: {_safe_json_dumps(payload)}\n\n"

    except Exception as e:
        error_payload = {
            "event_type": "error",
            "data": {
                "message": f"Agent 执行异常: {str(e)}"
            }
        }
        yield f"data: {_safe_json_dumps(error_payload)}\n\n"

    # 全流程完成推送到前端
    finished_payload = {
        "event_type": "status_change",
        "data": {
            "status": "completed",
            "message": "调研全流程已顺利完成！"
        }
    }
    yield f"data: {_safe_json_dumps(finished_payload)}\n\n"
