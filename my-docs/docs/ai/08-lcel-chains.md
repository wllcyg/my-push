# LCEL 核心组件与数据流转实战

在 LangChain 中，LangChain Expression Language (LCEL) 是一种用于构建复杂 AI 工作流的声明式语言。通过实现统一的 `Runnable` 接口，所有的组件（如 Prompt、大模型、解析器、甚至自定义函数）都可以像乐高积木一样无缝拼接。

本文档将基于一系列实战代码，系统总结 LCEL 中最核心的几种数据流转方式。

---

## 1. 核心流水线：RunnableSequence 与 RunnableLambda

这是最基础的链条组装方式。数据就像在管道中流动一样，从第一个步骤一直流向最后一个步骤。

![LCEL Core Pipeline](/images/lcel_01_core.png)

### 原理简析
* **`RunnableSequence`**：相当于 JS 里的 Promise 链或流水线（对应代码中的 `.pipe()` 方法）。它保证了上一个步骤的输出会自动成为下一个步骤的输入。
* **`RunnableLambda`**：用于给“普通的自定义函数”穿上一层马甲，让它能够融入 LangChain 的生态中。

**代码示例** (`runable.ts`, `lambda.ts`)：
```typescript
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

// 使用 RunnableLambda 包装普通函数
const add = RunnableLambda.from((input: number) => input + 1);
const multiply = RunnableLambda.from((input: number) => input * 2);

// 使用 RunnableSequence 将它们串联
const chain = RunnableSequence.from([add, multiply]);
// 或者使用语法糖： const chain = add.pipe(multiply);

const res = await chain.invoke(2); // 输出 6
```

---

## 2. 并行处理与透传：RunnableMap 与 Passthrough

当我们需要同时处理多项任务，或者需要在流水线中保留“上游的原始上下文”时，就需要用到分支与透传。

![Parallel Execution & Passthrough](/images/lcel_02_map_passthrough.png)

### 原理简析
* **`RunnableMap`**：接收相同的输入，分配给内部的多个键值对分支进行**并行执行**，最终将结果聚合成一个对象字典。
* **`RunnablePassthrough`**：什么都不做，直接把接收到的数据“原封不动”地吐出来。
* **`.assign()` 语法糖**：在透传所有原始数据的同时，追加新的字段（极度类似于 `Object.assign()`）。

**代码示例** (`passthrough.ts`)：
```typescript
import { RunnablePassthrough, RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

const expatChain = RunnableSequence.from([
    RunnableLambda.from((input: string) => ({ concept: input })),
    // 自动保留 { concept } 并且追加新的字段
    RunnablePassthrough.assign({
        upper: RunnableLambda.from((obj: any) => obj.concept.toUpperCase()),
        length: RunnableLambda.from((obj: any) => obj.concept.length)
    })
]);
```

---

## 3. 数据过滤：RunnablePick 与 .pick()

如果你在流水线中只需要上一步产生的某个特定字段，可以使用 Pick 操作。

**代码示例** (`pick.ts`)：
```typescript
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
    input => ({ ...input, info: "处理完成" }),
]).pick('info') // 直接打破对象壳子，只提取 "info" 字段的值
```

---

## 4. 循环处理：RunnableEach 与 .map()

用于将流水线逻辑应用到数组中的每一个元素上。

**代码示例** (`for-each.ts`)：
```typescript
const processItem = RunnableSequence.from([ reverText, toUpperCase ]);
// 等价于 new RunnableEach({ bound: processItem })
const chain = processItem.map(); 

await chain.invoke(["hello", "world"]); // 输出: ["OLLEH", "DLROW"]
```

---

## 5. 条件分发与动态路由：RunnableBranch 与 RouterRunnable

应对类似 `if-else` 或 `switch-case` 的复杂业务流向。

![Dynamic Routing](/images/lcel_03_routing.png)

### 5.1 RunnableBranch (if-else)
按照顺序判断条件，直到匹配到第一个 `true`，否则执行最后的兜底分支。

**代码示例** (`branch.ts`)：
```typescript
const branch = RunnableBranch.from([
    [isPositive, handlePositive],
    [isNegative, handleNegative],
    handleOdd // 最后的兜底分支
]);
```

### 5.2 RouterRunnable (switch-case)
根据传入的确切 `key` 字符串，动态选择并触发对应的 Runnable。

**代码示例** (`switch-case.ts`)：
```typescript
const router = new RouterRunnable({
    runnables: { toUpperCase, reverText }
});

await router.invoke({ key: "toUpperCase", input: "hello" });
```

---

## 6. 记忆与状态管理：历史的演进

在多轮对话中，我们必须要管理“聊天历史”。

![State & Memory Management](/images/lcel_04_memory.png)

### 旧时代：RunnableWithMessageHistory
通过拦截输入和输出，向外部数据库存取对话记录。但这在复杂的 Agent 流转中显得极其笨重，因此**已经被官方标记为废弃 (Deprecated)**。

**代码示例** (`memory.ts`)：
```typescript
const chain = new RunnableWithMessageHistory({
    runnable: simpleChain,
    getMessageHistory: (sessionId) => getHistory(sessionId),
    inputMessagesKey: 'question',
    historyMessagesKey: 'history',
});
```

### 新时代：LangGraph State & Checkpointer
现代 LangChain 推荐直接使用 **LangGraph**。在 LangGraph 中，所有的对话历史天然存放在全局的 `State` 状态机里，通过底层的 Checkpointer 实现自动持久化，彻底告别了插拔式的历史管理器。
