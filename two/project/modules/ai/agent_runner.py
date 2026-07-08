from typing import List
from langchain_core.messages import BaseMessage, ToolMessage, AIMessage
from langchain_core.runnables import Runnable
from langchain_core.tools import BaseTool
from typing import AsyncIterable, Generator

def run_agent_loop(
    model_with_tools: Runnable,
    tools: List[BaseTool],
    messages: List[BaseMessage],
    max_iterations: int = 30
) -> AIMessage:
    """
    封装的 Agent 运行循环（Python 版）
    类似于 LangChain 底层的 AgentExecutor，不使用内置的高级封装，完全手动实现
    """
    print("🤖 [Agent] 思考中...")
    # 第一步：把消息发给绑定了 Tools 的大模型
    response: AIMessage = model_with_tools.invoke(messages)
    messages.append(response)
    
    iteration = 0
    # 判断模型是否在 AIMessage 中发出了工具调用请求 (tool_calls)
    while response.tool_calls and len(response.tool_calls) > 0:
        if iteration >= max_iterations:
            print(f"\n❌ [Agent] 达到最大循环次数 ({max_iterations})，强制退出以防死循环！")
            break
            
        iteration += 1
        tool_names = ", ".join([tc['name'] for tc in response.tool_calls])
        print(f"\n🔧 [Agent] 决定调用 {len(response.tool_calls)} 个工具: {tool_names}")
        
        # 遍历所有的 tool_call (大模型可能会建议并行调用多个工具)
        for tool_call in response.tool_calls:
            # 在我们注册的 tools 列表中寻找同名工具
            target_tool = next((t for t in tools if t.name == tool_call['name']), None)
            
            if not target_tool:
                # 找不到工具，返回一个报错的 ToolMessage 告诉大模型
                error_msg = f"Error: No tool found with name {tool_call['name']}"
                messages.append(ToolMessage(
                    content=error_msg,
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
                continue
            
            # 第二步：在本地真正执行工具代码
            try:
                print(f"   -> 执行工具 [{target_tool.name}]...")
                
                # 获取工具执行的参数字典，并调用工具的 invoke
                tool_result = target_tool.invoke(tool_call['args'])
                
                # 把执行结果封入 ToolMessage (非常重要：必须带上原本的 tool_call_id，这样大模型才知道这是哪个调用的结果)
                messages.append(ToolMessage(
                    content=str(tool_result),
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
            except Exception as e:
                print(f"   -> 工具 [{target_tool.name}] 执行出错: {str(e)}")
                messages.append(ToolMessage(
                    content=f"Error executing tool: {str(e)}",
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
                
        print("\n🤖 [Agent] 工具执行完毕，正在基于结果继续思考...")
        
        # 第三步：把带着工具执行结果的 messages 重新喂给大模型
        response = model_with_tools.invoke(messages)
        messages.append(response)
        
    print("\n✅ [Agent] 任务完成！\n")
    return response


async def run_agent_loop_stream(
    model_with_tools: Runnable,
    tools: List[BaseTool],
    messages: List[BaseMessage],
    max_iterations: int = 30
) -> AsyncIterable[str]:
    """
    封装的 Agent 运行循环（Python 流式版 - 异步实现）
    在模型决定调用工具时保持静默并在后台执行，当模型给出文本回答时流式打字机输出
    """
    iteration = 0
    while iteration < max_iterations:
        iteration += 1
        
        # 请求流式响应，使用异步流 astream
        response_stream = model_with_tools.astream(messages)
        
        full_chunk = None
        async for chunk in response_stream:
            # 持续累加 chunk 得到本轮完整的消息
            if full_chunk is None:
                full_chunk = chunk
            else:
                full_chunk += chunk
            
            # 只要 full_chunk 里出现了工具调用的影子，就停止往前端推文本
            is_tool_calling = hasattr(full_chunk, "tool_call_chunks") and len(full_chunk.tool_call_chunks) > 0
            
            # 如果确定不是在调工具，且当前 chunk 有文本内容，就推出去
            if not is_tool_calling and chunk.content:
                # content 有时可能是列表，为了安全统一转成字符串推出去
                yield str(chunk.content)

        # 把这轮积累的完整消息加到上下文里
        if full_chunk:
            messages.append(full_chunk)

        # 取出完整的工具调用列表
        tool_calls = full_chunk.tool_calls if hasattr(full_chunk, "tool_calls") else []
        
        # 如果没有工具调用，说明大模型已经给出了最终结论并流完了文本，任务结束！
        if not tool_calls:
            break
            
        print(f"\n🔧 [Agent] (流式迭代 {iteration}) 决定调用 {len(tool_calls)} 个工具...")
        
        # 依次执行工具
        for tool_call in tool_calls:
            target_tool = next((t for t in tools if t.name == tool_call['name']), None)
            
            if not target_tool:
                messages.append(ToolMessage(
                    content=f"Error: No tool found with name {tool_call['name']}",
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
                continue
                
            try:
                print(f"   -> 正在静默执行工具 [{target_tool.name}]...")
                # 尽量调用 ainvoke 提升并发性
                if hasattr(target_tool, "ainvoke"):
                    tool_result = await target_tool.ainvoke(tool_call['args'])
                else:
                    tool_result = target_tool.invoke(tool_call['args'])

                messages.append(ToolMessage(
                    content=str(tool_result),
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
            except Exception as e:
                print(f"   -> 工具 [{target_tool.name}] 执行出错: {str(e)}")
                messages.append(ToolMessage(
                    content=f"Error executing tool: {str(e)}",
                    tool_call_id=tool_call['id'],
                    name=tool_call['name']
                ))
