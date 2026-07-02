# Flutter 笔记 (Day 11)：组件进阶 - 搞定指令、生命周期与逻辑复用

> **写在前面**：上一篇我们搞定了 Props 和 Slots，今天咱们来啃硬骨头：那些在 Vue 里用熟了的 `v-if`, `v-for`，还有生命周期钩子，到了 Flutter 里到底该怎么写？

> [⬅️ 回顾：Day 11 基础篇 - Props, Slots 与 Emits](file:///d:/self/my-flutter/my_flutter_app/day11_1_component_basics.md)

---

## 1. 告别指令，拥抱 Dart 语法

Vue 的强大在于**模板指令** (Directives)，而 Flutter 的强大在于**它就是 Dart 代码**。你不需要学新语法，只需要会写 `if` 和 `for`。

### 1.1 条件渲染 (v-if)

在 Vue 里你需要 `<div v-if="...">`，但在 Flutter 的 `build` 方法里，我们可以直接写 `if`。这被称为 **Collection If**。

```dart
Column(
  children: [
    // 方式 1: Collection If (最推荐)
    if (isLoading)
      const CircularProgressIndicator()
    else
      const Text('加载完成'),

    // 方式 2: 三元运算符 (适合简单赋值)
    isVip ? const VipBadge() : const SizedBox(),
  ],
)
```

### 1.2 列表渲染 (v-for)

Vue 的 `v-for` 很方便，但在 Flutter 里，利用 Dart 的 `map` 方法往往更灵活。

- **小列表 (v-for)**:

  ```dart
  // 类似于 list.map(item => <div>...</div>)
  Column(
    children: users.map((user) => Text(user.name)).toList(),
  )
  ```

- **无限长列表 (Virtual Scroll)**:
  对应 Vue 的虚拟滚动插件，Flutter 自带了 `ListView.builder`。
  ```dart
  ListView.builder(
    itemCount: users.length,
    itemBuilder: (context, index) {
      return UserRow(user: users[index]); // 只有滚动到屏幕内才会被创建
    },
  )
  ```

### 1.3 双向绑定 (v-model)

这点要特别注意：**Flutter 坚持单向数据流**，没有 `v-model` 这种语法糖。
你必须显式地：**监听变化** -> **更新状态** -> **重绘界面**。

```dart
TextField(
  // 1. 绑定值 (通过 controller)
  controller: _textController,
  // 2. 监听变化
  onChanged: (value) {
    setState(() {
      currentText = value;
    });
  },
)
```

---

## 2. 进阶特性映射：Vue 概念去哪了？

很多 Vue 的概念在 Flutter 里换了个马甲，但本质是一样的。

### 2.1 Computed & Watch (计算与侦听)

如果你用了 **Riverpod** (强烈推荐)，这事儿就简单了：

- **Computed**:

  ```dart
  // Vue: const doubleCount = computed(() => count.value * 2)
  final doubleCountProvider = Provider((ref) {
    final count = ref.watch(countProvider);
    return count * 2;
  });
  ```

- **Watch**:
  ```dart
  // Vue: watch(count, (newVal) => console.log(...))
  ref.listen(countProvider, (previous, next) {
    print('变化了: $next');
    // 适合做“副作用”，比如弹Toast、跳转路由
  });
  ```

### 2.2 生命周期 (Lifecycle)

Vue 有 `onMounted`, `onUnmounted`。Flutter 的 `StatefulWidget` 也有对应物，但如果你用了 `flutter_hooks`，体验会和 Vue Composition API 惊人的一致：

| Vue 3         | Flutter (StatelessWidget + Hooks)        | 原生 Flutter (StatefulWidget) |
| :------------ | :--------------------------------------- | :---------------------------- |
| `onMounted`   | `useEffect(() { ... }, [])`              | `initState`                   |
| `onUnmounted` | `useEffect(() { return () => ... }, [])` | `dispose`                     |
| `onUpdated`   | `build` 方法本身就是在 Update            | `didUpdateWidget`             |

### 2.3 `nextTick`

Vue 需要 `nextTick` 是因为 DOM 更新是异步的。Flutter 的 Widget 重建通常是同步的，但 Layout 是异步的。
如果你需要在**这一帧渲染完**后做点事（比如获取组件大小）：

```dart
WidgetsBinding.instance.addPostFrameCallback((_) {
  // 这里的代码会在 build 完成、布局计算完成后执行
});
```

---

## 3. 那些“看似没了”的特性

### 3.1 CSS Scoped

**Vue**: `<style scoped>` 防止样式污染。
**Flutter**: 不需要。Flutter 的样式 (TextStyle, BoxDecoration) 都是**内联对象**，天然隔离。你的 `Text` 变红绝对不可能影响到隔壁组件的 `Text`，除非你故意用了全局 Theme。

### 3.2 Slot Scoped (作用域插槽)

**Vue**: `<slot :item="item" />` 把子组件的数据传回给父组件渲染。
**Flutter**: 这就是著名的 **Builder Pattern**。
简单说，就是**父组件传一个函数给子组件**，子组件在渲染时调用这个函数，并把数据塞进去。

> _我们将在下一篇专门讲这个，它是 Flutter 封装高阶组件的核心。_

### 3.3 `<Teleport>`

**Vue**: 把弹窗挂载到 `body` 上。
**Flutter**: 使用 `Overlay` 或 `Portal` (第三方库)。但简单的弹窗通常直接用 `showDialog` (推入一个新的路由栈) 即可。

---

## 4. 给 Vue 开发者的速查小抄 📝

| 场景               | Vue 3 关键词           | Flutter 对应方案                                  |
| :----------------- | :--------------------- | :------------------------------------------------ |
| **页面跳转**       | `router.push('/home')` | `context.push('/home')` (GoRouter)                |
| **子组件调父方法** | `defineExpose`         | `Controller` 模式 (自定义一个 Class 传进去)       |
| **全局状态**       | Pinia                  | Riverpod (推荐) / Provider / Bloc                 |
| **缓存页面**       | `<keep-alive>`         | `AutomaticKeepAliveClientMixin` 或 `IndexedStack` |
| **动效**           | `<Transition>`         | `AnimatedSwitcher` / `AnimatedOpacity`            |
| **环境变量**       | `.env`                 | `--dart-define` / `String.fromEnvironment`        |

---

## 5. 今日练手任务 ✅

光看不练假把式，试试在你的 `MyCard` 基础上加点料：

- [ ] **条件渲染**: 给 `MyCard` 加一个 `v-if` 效果的参数 `bool isVisible`，虽然 Widget 还在树上，但如果是 false 就渲染 `SizedBox.shrink()` (空内容)。
- [ ] **列表循环**: 在 `HomePage` 里造一个 `List<String> logs`，用 `ListView.builder` 渲染一堆 `MyCard`。
- [ ] **生命周期**: 把 `MyCard` 改成 `StatefulWidget` (或者用 HookWidget)，在 `initState` (或 useEffect) 里打印一句 "MyCard Created"。
- [ ] **(挑战)**: 尝试实现一个 input，当输入特定字符时，下方的 `MyCard` 标题自动变色。(提示：使用 `TextEditingController` + `setState`)

---

> **Next**: 接下来是重头戏。Vue 里极其强大的“作用域插槽”，在 Flutter 里是如何通过 **Builder** 模式实现的？这决定了你能否封装出真正通用的列表/表格组件。
>
> [👉 前往：Day 11 Builder 篇 - 玩转作用域插槽](file:///d:/self/my-flutter/my_flutter_app/day11_3_component_builder.md)
