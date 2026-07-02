# Flutter 笔记 (Day 11)：组件封装核心 - Builder 模式与作用域插槽

> **写在前面**：在 Vue 里，如果我们要自定义列表的每一行长什么样，通常会用 **作用域插槽 (Scoped Slots)**。在 Flutter 里，这个概念被发扬光大，变成了无处不在的 **Builder Pattern (构建器模式)**。可以说，不懂 Builder，就没法封装真正复杂的通用组件。

> [⬅️ 回顾：Day 11 进阶篇 - 指令与逻辑复用](file:///d:/self/my-flutter/my_flutter_app/day11_2_component_advanced.md)

---

## 1. 什么是 Builder？

别被在这个词吓到了。在 Flutter 里，**Builder 本质上就是回调函数**。

### 通俗理解：外包模式

- **普通子组件 (`child`)**：父组件做好饭，装在盒子里给子组件展示。

  > 比如 `Container(child: Text('Hello'))`。

- **Builder 子组件 (`itemBuilder`)**：父组件给子组件一张**菜谱**（函数），子组件饿的时候（渲染时），自己照着菜谱做饭。
  > 比如 `ListView.builder(itemBuilder: (context, index) => Text('$index'))`。

---

## 2. Vue vs Flutter：实战对照

### Vue 的做法 (Scoped Slots)

Vue 通过 `<slot>` 标签把数据“反向”传给父组件：

```vue
<!-- 子组件 MyList.vue -->
<ul>
  <li v-for="item in items">
    <!-- 把 item 数据暴露出去 -->
    <slot :item="item" />
  </li>
</ul>

<!-- 父组件调用 -->
<MyList>
  <template #default="{ item }">
    <span>{{ item.name }}</span>
  </template>
</MyList>
```

### Flutter 的做法 (Builder Callback)

Flutter 直接把函数当参数传进去，清晰明了。

```dart
// 子组件 MyList 定义
class MyList extends StatelessWidget {
  final List<String> items;
  // 定义一个函数类型的变量，接收 Context 和 String，返回 Widget
  final Widget Function(BuildContext, String) itemBuilder;

  const MyList({
    super.key,
    required this.items,
    required this.itemBuilder,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: items.map((item) {
        // 关键点：子组件在渲染时，调用父组件传进来的函数
        // 这里的 context 是关键，把环境句柄交给了父组件的回调
        return itemBuilder(context, item);
      }).toList(),
    );
  }
}

// 父组件调用
MyList(
  items: ['A', 'B'],
  // 像写 callback 一样写 UI，极其自然
  itemBuilder: (context, item) {
    return Text('User: $item');
  },
)
```

---

## 3. 为什么要这么折腾？

你可能会问：_“直接传 Widget 列表不行吗？非要传个函数？”_

这涉及到 Flutter 的两个核心优势：

### 3.1 懒加载与性能 (Lazy Loading)

如果你传的是 `List<Widget>`，那么在父组件 `build` 的瞬间，这 1000 个 Widget 就都已经创建在内存里了。
而在 `ListView.builder` 中，Flutter 只有当列表项**滚动到屏幕内**时，才会调用你的 `builder` 函数去创建那个 Widget。这对于长列表性能是决定性的。

### 3.2 上下文与尺寸控制

很多时候我们需要根据**父容器当前的尺寸**来决定渲染什么（响应式布局）。
这就需要 `LayoutBuilder`。它先算出当前的宽高限制（`constraints`），然后再调用你的回调函数。这种**“先计算，再渲染”**的能力，是静态传参做不到的。

---

## 4. Flutter 里的 Builder 全家桶

以后你会经常和这几位打交道：

| 组件名               | 它的作用   | 回调里给你的数据         | 典型场景                               |
| :------------------- | :--------- | :----------------------- | :------------------------------------- |
| **ListView.builder** | 列表构建   | `index` (下标)           | 长列表、无限滚动                       |
| **GridView.builder** | 网格构建   | `index` (下标)           | 图片墙、商品列表                       |
| **LayoutBuilder**    | 响应式布局 | `constraints` (尺寸限制) | 根据屏幕宽度决定显示如果不显示侧边栏   |
| **FutureBuilder**    | 异步构建   | `snapshot` (异步结果)    | 对应 Vue 的 `onMounted` 请求接口后渲染 |
| **StreamBuilder**    | 流式构建   | `snapshot` (实时数据)    | 聊天室、倒计时、WebSocket              |

---

## 5. 总结：给 Vue 开发者的口诀

不要把 Builder 想得太复杂。

- **Vue**: 父组件给模板 `<template #default="{ data }">`
- **Flutter**: 父组件给函数 `(context, data) { return Widget; }`

只要记住：**看见 Builder，就是让你填一个返回 Widget 的函数**。

---

## 6. 今日练手任务 ✅

光看不练假把式，可以在 `HomePage` 稍微试一下：

- [ ] **重构 List**: 把之前写的 `Column` + `map` 列表，重构为 `ListView.builder`。
- [ ] **体验 LayoutBuilder**: 在 `HomePage` 最外层包裹一个 `LayoutBuilder`，打印一下 `constraints.maxWidth`，看看旋转屏幕时宽度怎么变。
- [ ] **(挑战) 异步加载**: 试着使用 `FutureBuilder` 来模拟一个延时 2 秒加载数据的效果（显示 Loading -> 显示文字）。

---

> **Next**: 组件封装的三板斧（Props, Emits, Builder）你已经掌握了。接下来我们要聊聊 Flutter 的路由管理，看看它是如何做页面跳转的。
