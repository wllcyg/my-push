import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const dataBase = {
    users: {
        '1': {
            id: '1',
            name: '张三',
            age: 18,
        },
        '2': {
            id: '2',
            name: '李四',
            age: 19,
        },
        '3': {
            id: '3',
            name: '王五',
            age: 20,
        },
    }
}


// 定义 serve

const serve = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0',
})

// 注册一个查询用户信息的工具

serve.registerTool(
    'query_user',
    {
        description: '根据用户ID查询用户信息',
        // 可以直接传入 z.object，或者传入 params raw shape
        inputSchema: z.object({
            userId: z.string().describe('用户 id,例如 1, 2, 3')
        })
    },
    async (args) => {
        // 如果传入的是 z.object，Zod 解析出来的 args 通常包含包裹的一层，或者直接就是 object
        const userId = args.userId as string;
        const user = dataBase.users[userId as keyof typeof dataBase.users];
        if (!user) {
            return {
                content: [{ type: 'text', text: '用户不存在' }]
            };
        }
        return {
            content: [{ type: 'text', text: JSON.stringify(user) }]
        };
    }
);

// 注册一个使用指南资源
serve.registerResource(
    '使用指南',
    'docs://guide',
    {
        description: 'MCP Server 使用文档',
        mimeType: 'text/plain',
    },
    async () => {
        return {
            contents: [
                {
                    uri: 'docs://guide',
                    mimeType: 'text/plain',
                    text: `MCP Server 使用指南

功能：提供用户查询等工具。

使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具。`
                }
            ]
        };
    }
);


const transport = new StdioServerTransport();
await serve.connect(transport);
