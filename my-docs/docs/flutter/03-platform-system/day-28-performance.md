# 前端转 Flutter 笔记 (Day 28)：性能调优 (DevTools) 🏎️

> **前言**：
> "为什么我的 Flutter App 跑起来这么卡？掉帧严重？甚至手机发烫？"
> 很多初学者甚至进阶开发者都会遇到性能瓶颈。相比于 Web 前端的 `Chrome DevTools` (Lighthouse, Performance tab)，Flutter 官方其实也提供了一套极其强大的武器库：**Flutter DevTools**。
>
> 这一章节，我们将深入诊断与优化，从帧率断崖下跌的元凶入手，让你的应用丝滑如德芙。

---

## 1. 终极武器：Flutter DevTools

Flutter DevTools 是一套独立于 IDE 运行在浏览器中的性能分析工具。只要你的应用在 Debug 或 Profile 模式下运行，你就可以启动它。

**启动方式**：

- VS Code: 命令面板 (Cmd+Shift+P) 输入 `Flutter: Open DevTools`
- 终端: `flutter pub global activate devtools`，然后 `devtools`

### 1.1 Performance (性能面板)

这是你最常去的图表页。关注图表中的条形图（帧渲染时间）。

- **绿色**：低于 16ms (如果你是 60Hz 屏幕)，恭喜，如丝般顺滑。
- **红色**：超过 16ms (Jank)，这就是卡顿的根源。

**注意点**：永远不要在 Debug 模式下测试性能！Debug 模式带有大量的热重载钩子和未优化的断言。**一定要使用 Profile 模式 (`flutter run --profile`) 来进行性能调优分析。**

### 1.2 Memory (内存面板)

用于排查内存泄漏。就像前端 SPA 的闭包泄漏一样，在 Flutter 中，未被 `dispose` 的 `StreamSubscription`、`ScrollController`、以及过大的图片加载都会导致 OOM (Out Of Memory)。

通过点击 `Snapshot` 抓取不同时刻的内存快照，找出一直在增长却没被回收的实例。

---

## 2. 常见卡顿原因及处方药 💊

### 2.1 频繁与树结构庞大的 `setState`

**病理**：
在巨大的 Widget Tree 顶层调用 `setState`，会导致整个树及其所有子节点被标记为 dirty，引发地毯式的 `build` 重建。

**处方**：

- **下放状态 (Push State Down)**：只把 `setState` 写在那个确实需要更新的叶子节点 Widget 里面。
- **拆分组件**：如果你发现一个 `.dart` 文件有 1000 行，把其中的模块抽离成独立的 `StatelessWidget` / `StatefulWidget`。

### 2.2 不必要的重绘 (`RepaintBoundary`)

**病理**：
Flutter 渲染引擎会将一块区域作为 Layer 绘制。如果你在一个列表中有一个一直转圈的 `CircularProgressIndicator`（不断重绘），它有可能会导致周围的静态文本和图片（甚至整个列表！）陪着它一帧一帧地重绘。这吃光了 GPU。

**处方**：
使用 `RepaintBoundary` 将高频重绘的区域"圈"起来。

```dart
RepaintBoundary(
  child: CircularProgressIndicator(),
)
```

这样引擎会自动分配一块独立的显存图层给它，不波及周边的静态大哥们。

### 2.3 `const` 的终极威力

**病理**：
每次运行 `build` 时，普通的 Widget 都会在内存中重新实例化，给 GC（垃圾回收器）带来极大压力，导致偶发性卡顿。

**处方**：
只要你的 Widget 完全不依赖任何外部变量（如硬编码的 padding，文字颜色等），**前置加上 `const`**。
在编译期间，Dart 会将 `const` 组件提取为编译时常量，后续任意次 `build` 连实例化的过程都省了，直接复用内存对象的引用。

> 你一定要开启 `flutter_lints` 里的 `prefer_const_constructors` 规则，然后让 IDE 帮你自动加上蓝色的修饰线。

---

## 3. Riverpod 的极客性能利器：`select`

前面对付的是原生的 `setState`，如果你用了 Riverpod，状态树通常是在全局维护的。

假设你有一个极其巨大的用户对象存储在 State 中：

```dart
class User {
  final String name;
  final int age;
  // 还有 100 个字段...
}
```

如果你只想显示名字，传统做法：

```dart
final user = ref.watch(userProvider);
return Text(user.name);
```

**致命缺陷**：如果这个 `user` 的 `age` 改变了，这个只显示名字的 `Text` 所在层级**也会被强制触发重建（rebuild）**，造成性能极大的浪费！

**终极解法：使用 `.select`**

```dart
final userName = ref.watch(userProvider.select((user) => user.name));
return Text(userName);
```

**此时，只有当 `user.name` 发生真实字符串哈希变化时，这个 Widget 才会重绘！完美！**

---

## 4. Tree Shaking + 包体积分析 (App Size)

性能不仅仅是流畅度，还包含：占多大内存、你的包有多少 MB、下载要多久。

对于 Web 前端，你会看 Webpack Bundle Analyzer。
在 Flutter，由于自带 AOT (Ahead Of Time) 提前编译模式，本身自带强大的摇树优化 (Tree Shaking)（没用到的类和函数在构建时直接删掉）。

如果你觉得打出来的包大，运行下面命令：

```bash
flutter build apk --analyze-size
```

或对于 iOS：

```bash
flutter build ipa --analyze-size
```

它会在当前目录生成一个 JSON 报告，然后在终端告诉你：

```
✓ Built build/app/outputs/flutter-apk/app-release.apk (16.2MB).
├── libapp.so (7.4MB)
├── assets (2.1MB)
└── res (1.5MB)
```

你可以清楚地看到是你的图片（`assets`）放得太多，还是你用的某个地图 SDK（常常几 MB）导致了体积膨胀。

---

## 5. 动手体验：性能测试 Demo

我们利用 Day28 产出的 `performance_demo_page.dart` 带你体会一下。

里面写了一个对比：

- 左边/或者某个选项是用未经优化的组件，它在列表滚动的时候会引发整页重绘。
- 右边/或者开启优化后加上了 `RepaintBoundary` 定位了重绘范围，你可以打开 Android Studio 或 VS Code 左边的 `Flutter Performance` 面板，勾选 **"Highlight Repaints" (高亮重绘区域)**。
- 这时候你能非常直观地看见：未优化的组件周边疯狂闪烁变色，而优化的组件安静如常，只有需要更新的地方才有闪烁色块！

> 📌 **性能优化箴言**：不要过早优化（Premature optimization is the root of all evil），先保证功能正确；然后在感觉到卡顿时，**一定要用 DevTools 找到量化数据而不是瞎猜**，再对症下药！
