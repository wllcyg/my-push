# Flutter 笔记 (Day 11)：组件封装之基础篇 - Props, Slots 与 Emits

> **写在前面**：作为前端开发，我们习惯了把 UI 拆分成组件。今天咱们聊聊在 Flutter 中，如何实现 Vue/React 里大家最熟悉的 **Props (属性)**、**Slots (插槽)** 和 **Emits (事件回调)**。

---

## 1. 概念对照表

先来个快速映射，方便大家从 Vue 思维切换过来：

| 概念            | Vue (SFC)                          | Flutter (Widget)                         | 核心区别                                   |
| :-------------- | :--------------------------------- | :--------------------------------------- | :----------------------------------------- |
| **组件定义**    | `<script setup>` + `<template>`    | `class MyWidget extends StatelessWidget` | Flutter 组件本质就是个 **Class**           |
| **Props**       | `defineProps<{ title: string }>()` | `final String title;` (构造函数传参)     | 이용 Dart 强类型构造函数，天然支持类型检查 |
| **Slot (默认)** | `<slot />`                         | `final Widget child;`                    | 直接传一个 Widget 对象进来                 |
| **Slot (具名)** | `<slot name="header" />`           | `final Widget? header;`                  | 想传几个插槽，就定义几个 Widget 类型的字段 |
| **Emits**       | `defineEmits(['click'])`           | `final VoidCallback? onTap;`             | 所谓的事件，其实就是**函数回调**           |

---

## 2. 实战：封装一个通用 Card 组件

口说无凭，咱们直接上手封装一个 `MyCard` 组件。这个组件需要：

1. 一个标题 (Props)
2. 一个确认按钮点击事件 (Emits)
3. 核心内容区域 (Default Slot)
4. 可选的右上角额外信息 (Named Slot)

### Vue 版本 (仅作参考)

熟悉 Vue 的同学脑子里大概是这样的：

```vue
<!-- MyCard.vue -->
<template>
  <div class="card">
    <div class="header">
      <h3>{{ title }}</h3>
      <slot name="extra" />
      <!-- 具名插槽 -->
    </div>
    <div class="body">
      <slot />
      <!-- 默认插槽 -->
    </div>
    <button @click="$emit('confirm')">确认</button>
  </div>
</template>

<script setup>
defineProps(["title"]);
defineEmits(["confirm"]);
</script>
```

### Flutter 版本实现

在 Flutter 中，我们不需要什么 `<slot>` 标签，**所有东西都是变量**。

**文件**: `lib/widgets/my_card.dart`

```dart
import 'package:flutter/material.dart';

class MyCard extends StatelessWidget {
  // 1. Props: 普通的成员变量
  final String title;

  // 2. Default Slot: 也没什么黑魔法，就是接收一个 Widget
  // 习惯上主体内容我们叫 child 或 body
  final Widget child;

  // 3. Named Slot: 也是 Widget，只是可以是 nullable 的
  final Widget? extra;

  // 4. Emits: 在 Flutter 里就是 Callback
  // VoidCallback 等同于 void Function()
  final VoidCallback? onConfirm;

  // 构造函数：Dart 语法糖，直接初始化成员变量
  // 这里的 {} 表示具名参数，调用时更清晰
  const MyCard({
    super.key,
    required this.title,
    required this.child,
    this.extra,
    this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        // 稍微加点阴影，更有质感
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min, // 高度自适应
        children: [
          // Header 部分
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)
              ),
              // 如果传了 extra 插槽就渲染，没传就拉倒
              if (extra != null) extra!,
            ],
          ),
          const Divider(height: 24),

          // Body 部分 (Default Slot)
          // 这里的 child 就是外面传进来的任意 Widget
          child,

          const SizedBox(height: 16),

          // Footer / Action 部分
          if (onConfirm != null)
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton( // 推荐用新版 Material 3 按钮
                onPressed: onConfirm,
                child: const Text('确认'),
              ),
            ),
        ],
      ),
    );
  }
}
```

---

## 3. 调用方式对比

封装好了，怎么用呢？

### Vue 写法

```vue
<MyCard title="日记详情" @confirm="handleOk">
  <p>今天天气不错...</p>
  <template #extra>
    <span>2024-02-10</span>
  </template>
</MyCard>
```

### Flutter 写法 (Dart)

你看，其实更像是在写配置对象，结构非常清晰：

```dart
MyCard(
  title: '日记详情',
  // 处理事件
  onConfirm: () {
    print('点击了确认');
  },
  // Named Slot: 想传什么传什么
  extra: const Text(
    '2024-02-10',
    style: TextStyle(color: Colors.grey, fontSize: 12)
  ),
  // Default Slot: 这里放主体内容
  child: const Text('今天天气不错...'),
)
```

---

## 4. 深度解析：为什么这么设计？

作为过来人，这里有几个思维转换的点值得注意：

1.  **"插槽"即"变量"**
    在 Vue 里 Slot 是一套特殊的模板语法。但在 Flutter 里，**万物皆 Widget**。你想给子组件传一段 UI，本质上和传一个 String 字符串没有任何区别，都是传参。这带来的好处是极其灵活——你可以传一个简单的 `Text`，也可以传一个包含了这一整页逻辑的复杂 Widget 树。

2.  **StatelessWidget 够用了吗？**
    新手常问：MyCard 里如果有按钮交互，不需要用 `StatefulWidget` 吗？
    **不需要。** 组件应该尽量保持纯粹（UI 展示）。状态（比如"是否已点击"、"卡片是否展开"）应该由**父组件**管理，或者通过状态管理工具（Riverpod/Bloc）抽离。这和 React 的 "Presentational Components" 理念是一致的。

3.  **Default Slot 的命名**
    Flutter 官方组件习惯把核心内容叫 `child`（如果是单个）或 `children`（如果是列表）。保持这个命名习惯会让你的代码更符合 Dart 社区规范，虽然你完全可以叫它 `body` 或者 `content`。

---

## 5. 进阶：如何让外部控制样式？

Vue 里我们习惯直接给组件加 `class` 或者 `style`。Flutter 不支持这种“样式透传”（Attribute Fallthrough）。

解决方案通常有三种：

1.  **显式参数（推荐）**
    最简单的办法，就是把样式变成Props。

    ```dart
    const MyCard({super.key, this.backgroundColor = Colors.white, ...});
    ```

2.  **Wrap 模式**
    如果调用者想要改 padding 或者 margin，让他自己在外面包一层 `Padding` 即可。**Composition over Inheritance**（组合优于继承）在 Flutter 体现得淋漓尽致。

    ```dart
    Padding(
      padding: EdgeInsets.all(20),
      child: MyCard(...),
    )
    ```

3.  **Theme (上下文)**
    对于全局通用的样式（比如字体大小、主色调），组件内部通过 `Theme.of(context)` 去读取上下文中的配置。这样外部只需要在顶层套一个 `Theme` Widget，整个应用的卡片样式都能一键切换。

---

> **Next**: 搞定了组件结构，下一篇我们来看看 Vue 里的 `v-if`, `v-for` 在 Flutter 里到底长什么样。
>
> [传送门：Day 11 进阶篇 - 指令与逻辑复用](file:///d:/self/my-flutter/my_flutter_app/day11_2_component_advanced.md)
