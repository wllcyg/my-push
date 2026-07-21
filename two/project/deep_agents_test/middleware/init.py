"""

  before_agent : 正序执行
  before_model : 正序执行，支持 jump_to="end" 短路
  wrap_model_call : 洋葱包裹，第一个 middleware 最外层
  after_model  : 反序执行
  after_agent  : 反序执行

如果模型返回了 tool_calls，会自动执行 tools 并把结果重新喂回模型，
直到没有 tool_calls 为止（或达到 max_iterations）。
"""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional, AsyncGenerator


# ============================================================
# 1. 消息类型
# ============================================================

class BaseMessage:
    def __init__(self, content: str):
        self.content = content

    def __repr__(self):
        return f"{self.__class__.__name__}({self.content!r})"


class HumanMessage(BaseMessage):
    role = "human"


class AIMessage(BaseMessage):
    role = "ai"

    def __init__(self, content: str, tool_calls: Optional[List[Dict]] = None):
        super().__init__(content)
        self.tool_calls = tool_calls or []


class ToolMessage(BaseMessage):
    role = "tool"

    def __init__(self, content: str, tool_call_id: str):
        super().__init__(content)
        self.tool_call_id = tool_call_id


ModelResponse = AIMessage


# ============================================================
# 2. State：字典的简单封装，messages 走追加语义，其余字段走覆盖语义
# ============================================================

class AgentState(dict):
    pass


def merge_state(state: AgentState, update: Optional[Dict]) -> None:
    if not update:
        return
    for k, v in update.items():
        if k == "jump_to":
            continue
        if k == "messages":
            state["messages"] = state.get("messages", []) + v
        else:
            state[k] = v


# ============================================================
# 3. ModelRequest：对一次模型调用参数的封装
# ============================================================

class ModelRequest:
    def __init__(self, messages: list, system_prompt: str = "", tools: Optional[list] = None):
        self.messages = messages
        self.system_prompt = system_prompt
        self.tools = tools or []

    def override(self, **kwargs) -> "ModelRequest":
        new_req = ModelRequest(self.messages.copy(), self.system_prompt, self.tools.copy())
        new_req.__dict__.update(kwargs)
        return new_req


# ============================================================
# 4. hook_config：声明某个 hook 是否允许 jump_to
# ============================================================

def hook_config(can_jump_to: Optional[List[str]] = None):
    def decorator(fn):
        fn._can_jump_to = can_jump_to or []
        return fn
    return decorator


def _check_jump_allowed(fn, target: str, mw_name: str, hook_name: str):
    allowed = getattr(fn, "_can_jump_to", [])
    if target not in allowed:
        raise RuntimeError(
            f"{mw_name}.{hook_name} 返回了 jump_to={target!r}，"
            f"但未使用 @hook_config(can_jump_to=[...]) 声明该跳转目标"
        )


# ============================================================
# 5. Middleware 基类
# ============================================================

class AgentMiddleware:
    """中间件基类。子类按需重写下面的方法即可，不需要全部实现。"""

    def before_agent(self, state: AgentState, runtime: Any = None) -> Optional[Dict]:
        return None

    def before_model(self, state: AgentState, runtime: Any = None) -> Optional[Dict]:
        return None

    def after_model(self, state: AgentState, runtime: Any = None) -> Optional[Dict]:
        return None

    def after_agent(self, state: AgentState, runtime: Any = None) -> Optional[Dict]:
        return None

    async def wrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], AsyncGenerator]) -> AsyncGenerator:
        async for chunk in handler(request):
            yield chunk

    def wrap_tool_call(self, tool_call: Dict, handler: Callable[[Dict], Any]) -> Any:
        return handler(tool_call)


# ============================================================
# 6. 执行引擎
# ============================================================

class AgentExecutor:
    def __init__(
        self,
        model_fn: Callable[[ModelRequest], ModelResponse],
        tools: List[Callable],
        system_prompt: str,
        middleware: List[AgentMiddleware],
        max_iterations: int = 5,
    ):
        self.model_fn = model_fn
        self.tools_by_name = {t.__name__: t for t in tools}
        self.system_prompt = system_prompt
        self.middleware = middleware
        self.max_iterations = max_iterations

    # ---- 洋葱包裹：model ----
    def _build_model_chain(self) -> Callable[[ModelRequest], AsyncGenerator]:
        handler = self.model_fn
        for mw in reversed(self.middleware):
            def make_wrapped(h, m):
                async def wrapped_handler(req: ModelRequest):
                    async for chunk in m.wrap_model_call(req, h):
                        yield chunk
                return wrapped_handler
            handler = make_wrapped(handler, mw)
        return handler

    # ---- 洋葱包裹：tool ----
    def _build_tool_chain(self) -> Callable[[Dict], Any]:
        def base_handler(tool_call: Dict) -> Any:
            fn = self.tools_by_name.get(tool_call["name"])
            if fn is None:
                return f"[错误] 未找到工具: {tool_call['name']}"
            return fn(**tool_call.get("args", {}))

        handler = base_handler
        for mw in reversed(self.middleware):
            handler = (lambda h, m: (lambda tc: m.wrap_tool_call(tc, h)))(handler, mw)
        return handler

    async def astream(self, initial_state: Dict) -> AsyncGenerator[Dict, None]:
        state = AgentState(initial_state)

        # 1. before_agent —— 正序
        for mw in self.middleware:
            res = mw.before_agent(state)
            merge_state(state, res)
            if res and res.get("jump_to") == "end":
                _check_jump_allowed(mw.before_agent, "end", mw.__class__.__name__, "before_agent")
                yield {"event": "on_chain_end", "data": {"output": dict(state)}}
                return

        for _ in range(self.max_iterations):
            # 2. before_model —— 正序，支持短路
            jumped = False
            for mw in self.middleware:
                res = mw.before_model(state)
                merge_state(state, res)
                if res and res.get("jump_to") == "end":
                    _check_jump_allowed(mw.before_model, "end", mw.__class__.__name__, "before_model")
                    jumped = True
                    break
            if jumped:
                break

            # 3. 组装洋葱并真正调用模型
            request = ModelRequest(
                messages=state.get("messages", []),
                system_prompt=self.system_prompt,
                tools=list(self.tools_by_name.values()),
            )
            model_chain = self._build_model_chain()
            
            response = None
            async for chunk in model_chain(request):
                if chunk["event"] == "on_chat_model_stream":
                    yield chunk
                elif chunk["event"] == "on_model_end":
                    response = chunk["data"]["response"]
                    
            if response is None:
                response = AIMessage(content="", tool_calls=[])
                
            merge_state(state, {"messages": [response]})

            # 4. after_model —— 反序
            for mw in reversed(self.middleware):
                res = mw.after_model(state)
                merge_state(state, res)

            # 5. 如果模型要调用工具，执行工具后再回到循环顶部重新调模型
            if response.tool_calls:
                tool_chain = self._build_tool_chain()
                tool_messages = []
                for tc in response.tool_calls:
                    yield {"event": "on_tool_start", "name": tc.get("name"), "data": tc}
                    result = tool_chain(tc)
                    yield {"event": "on_tool_end", "name": tc.get("name"), "data": {"output": result}}
                    tool_messages.append(ToolMessage(content=str(result), tool_call_id=tc.get("id", "")))
                merge_state(state, {"messages": tool_messages})
                continue  # 回到循环顶部，带着 tool 结果再问一次模型

            break  # 没有 tool_calls，本轮结束

        # 6. after_agent —— 反序
        for mw in reversed(self.middleware):
            res = mw.after_agent(state)
            merge_state(state, res)

        yield {"event": "on_chain_end", "data": {"output": dict(state)}}


def create_agent(
    model: Callable[[ModelRequest], AsyncGenerator],
    tools: Optional[List[Callable]] = None,
    system_prompt: str = "",
    middleware: Optional[List[AgentMiddleware]] = None,
    max_iterations: int = 5,
) -> AgentExecutor:
    return AgentExecutor(
        model_fn=model,
        tools=tools or [],
        system_prompt=system_prompt,
        middleware=middleware or [],
        max_iterations=max_iterations,
    )
