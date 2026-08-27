![image](https://api.cheatppf.xyz/i/mrpq4ce6-xwah9s.png)

# 弃用黑盒：手写 Vercel AI Stream Protocol 实现流式对话与工具调用

在构建现代 AI Agent 聊天应用时，流式输出（Streaming）和工具调用（Tool Calling）是两个最核心的体验基石。我们的项目虽然在 `package.json` 中引入了 `@ai-sdk/vue`，但在真正的核心源码中，我们并没有直接使用官方提供的黑盒 Hook，而是**完全从零手写了一套兼容 Vercel AI SDK Data Stream Protocol 的解析引擎**。

本文将复盘我们为什么这么做，以及在处理底层 `ReadableStream` 时踩过的坑。

## 一、协议揭秘：流里面的数据长什么样？

在深入代码之前，我们需要弄明白后端的 Vercel 协议到底往前端吐了什么数据。它其实是一种基于单字符前缀、按行分隔的 JSON 文本流（Newline-delimited JSON）：

- `0:"你好，我是 AI"`：**文本增量 (Text Delta)**。这就是你在屏幕上看到的打字机效果。
- `9:[{"toolCallId":"call_123","toolName":"get_weather","args":{"city":"北京"}}]`：**工具调用 (Tool Call)**。后端大模型决定调用工具，把参数推过来。
- `a:[{"toolCallId":"call_123","result":"Sunny"}]`：**工具结果 (Tool Result)**。工具执行完毕，把结果塞回流里。
- `3:"Error message"`：**错误信号 (Error)**。
- `d:`：**结束信号 (Done)**。

---

## 二、核心难点：处理流式数据的“半包”问题

写流式解析，最容易翻车的地方就是**想当然地以为 Fetch 返回的每一个 Chunk 都是完整的一行**。实际上，由于网络传输的特性，你收到的块可能是半截 JSON，或者是两行半的数据。

在我们的 `useChat.ts` 中，我们通过一个经典的 `buffer` 缓冲池巧妙地解决了这个问题：

```typescript
// src/hooks/useChat.ts 核心代码截取
const reader = response.body?.getReader()
const decoder = new TextDecoder('utf-8')
let buffer = '' // 用于处理 TCP 粘包/半包的缓冲区

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  // 1. 将新的字节块解码并追加到缓冲区
  buffer += decoder.decode(value, { stream: true })
  
  // 2. 按换行符切分数据
  const lines = buffer.split('\n')
  
  // 3. 极其关键的一步：最后一条大概率是不完整的半行，我们把它弹出来放回 buffer 里等下一个 Chunk
  buffer = lines.pop() ?? ''

  for (const line of lines) {
    if (!line.trim()) continue
    // 4. 将完整的行丢给解析器
    handleParsedLine(line) 
  }
}
```

这个看似简单的 `lines.pop()`，直接避免了 JSON 解析到一半报错退出的致命 Bug。

---

## 三、纯粹的解析器：隔离变化

在拿到完整的 `line` 后，我们将协议的具体解析抽取到了一个绝对独立的模块 `dataStreamParser.ts` 中。
它的职责只有一个：切分冒号前的标识符，通过 `switch-case` 转换为 TypeScript 强类型实体。

```typescript
// src/parser/dataStreamParser.ts
export function parseLine(line: string): StreamChunk {
  const colonIndex = line.indexOf(':')
  const prefix = line.slice(0, colonIndex)
  const body = line.slice(colonIndex + 1)

  switch (prefix) {
    case '0': 
      return { type: 'text', content: JSON.parse(body) }
    case '9': 
      return { type: 'tool_call', payload: JSON.parse(body)[0] }
    case 'a': 
      return { type: 'tool_result', payload: JSON.parse(body)[0] }
    // ... 其他协议
  }
}
```
**这种设计的最大好处是隔离**：即使未来 Vercel 协议升级，改动也只发生在这个文件里，上层的 UI 组件毫不知情，也无需做任何改动。

---

## 四、为什么要重复造轮子？

放弃开箱即用的 `@ai-sdk/vue`，选择自己手搓，其实是为了解决业务深化后必然遇到的痛点：

1. **摆脱黑盒限制，抢占生命周期**
   官方的 Hook 封装得太深。如果你想在"工具开始调用"的一瞬间立刻触发一声系统的提示音，或者自定义重试逻辑，官方包根本不给你插手的机会。手写 Parser 让我们可以在任何一个事件分发点（如 `case '9':`）随意注入自定义逻辑。

2. **完美的自动滚动联动**
   在我们的实现中，当拦截到 `9:` (Tool Call) 时，会立刻向消息实体里 push 一个正在执行的工具对象。我们利用 Vue 的 `watch` 监听了 `toolInvocations.length` 的变化。这不仅触发了界面上加载卡片的渲染，还瞬间联动了 `ChatWindow.vue` 里的滚动控制器，实现了非常丝滑的自动滚屏体验。这是官方高度封装的库很难精准控制的。

3. **UI 与协议的绝对解耦**
   官方包往往强绑定了某些状态结构。自己实现后，后端怎么吐数据是一回事，前端怎么消费数据是另一回事。协议只负责拼装 JSON，UI 只负责接收 JSON，互不干涉。

---

## 五、小结

回头看这段手写协议的代码，其实并不是在做无用功，而是**在底层协议层面建立自己的护城河**。

- 处理 `ReadableStream` 时，边界情况（比如前文提到的流半包截断问题）往往比正常解析更考验代码健壮性，绝不能想当然；
- 状态管理的边界必须清晰，流解析只管更新数据，滚动和 UI 渲染通过 Vue 的 `watch` 响应式去驱动，否则代码迟早耦合得一团糟；
- 官方库的抽象往往是为了"满足 80% 的通用场景"，但那剩下的 20% 定制化交互，才是区分"普通产品"和"极致体验"的关键。

这套"自定义协议层 + 流式缓冲区 + 响应式状态钩子"的架构本身扩展性极强。如果你也在做深度的 AI Agent 交互界面，受够了官方包的黑盒限制，欢迎直接参考这套架构思路；遇到类似的流式分包问题或者滚动冲突，也欢迎在评论区聊聊你踩过的坑。
