import time
import json
from typing import List, Dict, Any
from langchain_core.callbacks import BaseCallbackHandler

class ExecutionTraceTracker:
    """链路轨迹追踪器：用于收集全链路层级 Trace 事件"""
    def __init__(self):
        self._trace: List[Dict[str, Any]] = []

    def add_event(self, event: Dict[str, Any]):
        self._trace.append(event)

    def get_trace(self) -> List[Dict[str, Any]]:
        return self._trace

    def clear(self):
        self._trace.clear()

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self._trace, indent=indent, ensure_ascii=False)


class MultiAgentLoggingCallback(BaseCallbackHandler):
    """
    通用多 Agent 层级日志与 Trace 记录 Callback
    """
    def __init__(
        self, 
        agent_name: str = "Supervisor", 
        is_subagent: bool = False,
        tracker: ExecutionTraceTracker = None
    ):
        self.agent_name = agent_name
        self.is_subagent = is_subagent
        self.tracker = tracker
        self.start_time = None

    def on_chat_model_start(self, serialized, messages, **kwargs):
        self.start_time = time.time()
        if not self.is_subagent:
            print(f"\n👑 [{self.agent_name}] 开始思考下步调度...")
        else:
            print(f"    🤖 [{self.agent_name}] 开始推理...")

    def on_chat_model_end(self, response, **kwargs):
        duration = round(time.time() - (self.start_time or time.time()), 2)
        text = response.generations[0][0].text[:60].replace("\n", " ")
        if self.tracker:
            self.tracker.add_event({
                "step_type": "LLM_GENERATE",
                "agent": self.agent_name,
                "output_preview": text + "...",
                "duration_sec": duration
            })

    def on_tool_start(self, serialized, input_str, **kwargs):
        tool_name = serialized.get("name", "tool")
        if not self.is_subagent:
            print(f"👑 [{self.agent_name}] ➔ 调度子 Agent 工具: 【{tool_name}】")
        else:
            print(f"        🛠️  [{self.agent_name} 原子工具] 执行 {tool_name} | 参数: {input_str}")
        
        if self.tracker:
            self.tracker.add_event({
                "step_type": "TOOL_START",
                "agent": self.agent_name,
                "tool_name": tool_name,
                "input_args": input_str
            })

    def on_tool_end(self, output, **kwargs):
        if self.is_subagent:
            print(f"        ✅ [{self.agent_name} 原子工具] 执行完毕")
            
        if self.tracker:
            self.tracker.add_event({
                "step_type": "TOOL_END",
                "agent": self.agent_name,
                "output_result": str(output)[:100]
            })
