# LangChain Agent 开发最佳实践与技术总结

![首图](https://api.cheatppf.xyz/i/mqz8ql1j-fbqicj.png)
本文档总结了基于 LangChain JS/TS 构建具备“工具调用（Tool Calling）”能力的高级 Agent 的核心技术点、采坑经验和架构最佳实践。

---

## 一、核心架构：模型实例的管理 (Model Singleton & Factory)

在 `src/model.ts` 中，我们采用了 **“默认单例 + 工厂函数”** 的设计模式：
- **单例模式 (`model`)**: 方便全局无缝调用，避免重复初始化。
- **工厂模式 (`createModel`)**: 支持在特殊场景下（如需要极高的创造性 `temperature: 1` 时）动态覆盖默认配置。

```typescript
// 单例
export const model = new ChatOpenAI({ ... });

// 工厂函数
export const createModel = (options?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>) => {
  return new ChatOpenAI({ ...默认配置, ...options });
};
```

---

## 二、工具定义与封装 (Tools)

在 `src/tools/tools.ts` 中，我们定义了 Agent 赖以与外界交互的“手脚”：
1. `read_file`
2. `write_file`
3. `list_dir`
4. `exec_command` (最强大的工具，支持 `workingDirectory`)

**开发规范：**
- 必须使用 `zod` 严格定义入参 Schema。
- 对于 `exec_command` 这类可能失败或持续输出的工具，需要监听 `child_process.spawn` 的 `close` 和 `error` 事件，并把**退出码**和**错误信息**精确返回给大模型。

---

## 三、Agent 执行循环 (Tool Calls Loop) ★★★ 核心重点

在没有高层框架（如 LangGraph）包办一切的情况下，我们手动在 `src/agentRunner.ts` 中实现了底层的 Agent 驱动循环 (`runAgentLoop`)。这也是最容易出错的地方。

### 1. `tool.invoke()` 的正确传参
在 Agent 循环中，**绝不能只传 `args`**！必须传入完整的 `toolCall` 对象：
```typescript
// ❌ 错误：返回的是普通对象或字符串，无法并入对话上下文
const result = await tool.invoke(toolCall.args); 

// ✅ 正确：LangChain 会自动将其包装为符合协议的 ToolMessage
const result = await tool.invoke(toolCall); 
```

### 2. 防御性编程与“自我纠错 (Self-Correction)”
当工具执行报错（如文件不存在、命令报错）时，绝对**不能让异常抛出中断主程序**。
必须用 `try-catch` 捕获，并**伪装成一次成功的工具回调（只是内容为报错信息）**发给大模型：
```typescript
try {
    return await tool.invoke(toolCall);
} catch (error) {
    // 必须手动构造 ToolMessage，将报错喂给 AI
    return new ToolMessage({
        content: \`Error executing tool: \${error.message}\`,
        tool_call_id: toolCall.id!,
        name: toolCall.name
    });
}
```
**意义**：这赋予了 AI 得知错误原因并**自主修改参数、重新调用**的能力（即自愈/自适应能力）。

---

## 四、高级 System Prompt 工程学 (防幻觉机制)

在 `src/02-create.ts` 中，我们使用了堪称教科书级别的 Agent 系统提示词：

### 1. 动态锚定上下文
大模型没有本地环境的概念，必须在提示词开头直接注入绝对路径：
```text
当前工作目录: ${process.cwd()}
```

### 2. 防踩坑与负面提示词 (Negative Prompting)
大模型在执行终端命令时极度喜欢用 `cd xxx && do_something`，这与工具的 `workingDirectory` 参数冲突会导致致命错误。
通过 **Few-Shot（少量样本）+ 反例** 的技巧，精准封杀这种幻觉：
```text
重要规则 - exec_command:
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
  这是错误的！因为...
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
  这样就对了！...
```

### 3. 强制约束输出格式
```text
回复要简洁，只说做了什么。
```
避免大模型在每次调用工具前后输出长篇大论的废话，节省 Token 并保持终端清爽。

---

## 五、开发者体验提升 (DX)

引入 `chalk` 库为 Agent 的思考链上色：
- 🟢 绿色：任务成功
- 🔵 青色：AI 思考中
- 🟡 黄色/洋红：决定调用工具
- 🔴 红色：工具执行报错

这让全自动多步 Agent 的运行日志在终端中变得极具观赏性和可读性。
