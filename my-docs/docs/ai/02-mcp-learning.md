# MCP (Model Context Protocol) 开发最佳实践与实战总结

![首图](https://api.cheatppf.xyz/i/mqzan5ec-zxt8vs.png)

本文档总结了基于 `@modelcontextprotocol/sdk` 和 `@langchain/mcp-adapters` 构建本地/远程 MCP 服务，并将其接入大模型 Agent 的核心技术点和实战经验。

---

## 一、核心概念：Tool 与 Resource (MCP 的两大支柱)

在 MCP 的 Client-Server 架构中，Server 能够向大模型暴露的能力主要分为两类，必须严格区分使用场景：

- **Tool（工具）**：赋予 AI **主动执行**的能力（如：写文件、查数据库、发送 HTTP 请求）。AI 会通过工具的 `inputSchema` 自行决定何时调用、传什么参数。
- **Resource（资源）**：向 AI 暴露的**被动读取**上下文数据（如：系统全局配置、使用文档、业务背景知识）。当 AI 需要了解全貌时，可读取此类资源。

---

## 二、本地 MCP Server 的搭建与注册

在 `src/mcp/my-mcp-serve.ts` 中，我们使用官方 SDK 创建了基于标准输入输出 (Stdio) 的本地 Server。

### 1. 工具与资源的正确注册
开发规范：
- 工具（Tool）必须使用 `zod` 严格定义 `inputSchema` 并带有 `describe` 注释，帮助大模型理解参数含义。
- 新版 SDK 已废弃直接传描述字符串的方式，必须统一使用配置对象。

```typescript
// ✅ 正确：使用配置对象，并用 Zod 提供强类型的 Schema 与描述
serve.registerTool(
    'query_user',
    {
        description: '根据用户ID查询用户信息',
        inputSchema: z.object({
            userId: z.string().describe('用户 id,例如 1, 2, 3')
        })
    },
    async (args) => {
        // ... 执行业务逻辑
    }
);
```

### 2. 建立通信管道 (Transport) ★★★ 核心重点
像 Cursor 或 LangChain 这样的 Client，并非通过 HTTP 访问本地代码，而是通过拉起子进程（例如 `npx tsx serve.ts`），利用**标准输入输出**进行 JSON-RPC 交互。
因此，必须在末尾建立 `StdioServerTransport` 并连接：
```typescript
const transport = new StdioServerTransport();
await serve.connect(transport); // 这行代码让 Node 进程挂起，像保安一样监听命令行管道
```

---

## 三、作为 Client 调用 MCP Server (Adapter)

借助 `@langchain/mcp-adapters` 的 `MultiServerMCPClient`，我们可以将各种形态的 MCP Server 统一抹平，并将它们无缝转化为 LangChain 可用的 Tools。

### 1. 挂载本地子进程 (Stdio)
在 `src/mcp/regist-tool.ts` 中：
```typescript
const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        'my-local-server': {
            command: 'npx',
            // ✅ 正确：执行 TypeScript 脚本必须指定 tsx
            args: ['tsx', '/Users/moliang/Desktop/coder/two/tool-test/src/mcp/my-mcp-serve.ts'] 
        }
    }
});
```

### 2. 挂载远程接口 (HTTP/SSE)
在 `src/mcp/http-mcp-serve.ts` 中，展示了 MCP 强大的去中心化能力。无论工具是用什么语言写的，只要提供 HTTP 协议的 MCP 接口，即可瞬间借用。
```typescript
const mcpClient = new MultiServerMCPClient({
    mcpServers: {
        "amap-maps-streamableHTTP": {
            // 直接传入远程高德地图的 MCP 服务 URL
            "url": \`https://mcp.amap.com/mcp?key=\${GAODE_MCP_KEY}\`
        }
    }
});
```

---

## 四、Agent 执行循环防崩溃机制 (Safety & Robustness)

当 Agent 拥有了调用 MCP 工具的能力后，大模型可能会因为工具执行报错或参数错误而陷入**“疯狂调用工具重试”的死循环**中。

在 `src/agentRunner.ts` 的 `runAgentLoop` 中，我们引入了 `maxIterations` 强制熔断机制：

```typescript
export async function runAgentLoop(
    modelWithTools: Runnable<any, any>,
    tools: StructuredTool[],
    messages: BaseMessage[],
    maxIterations: number = 30 // 默认限制 30 次循环
) {
    let iteration = 0;
    while (response.tool_calls && response.tool_calls.length > 0) {
        // ❌ 防止 AI 死循环耗尽 Token
        if (iteration >= maxIterations) {
            console.log(chalk.red(\`\\n❌ [Agent] 达到最大循环次数 (\${maxIterations})，强制退出以防死循环！\`));
            break;
        }
        iteration++;
        // ... 执行工具逻辑
    }
}
```
**意义**：这一兜底策略是构建生产可用 Agent 的必备防线，有效避免因幻觉导致的无限 API 请求灾难。
