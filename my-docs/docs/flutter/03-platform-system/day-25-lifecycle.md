# 前端转 Flutter 笔记 (Day 25)：App 生命周期与后台任务 ♻️

> **前言**：
> 在 Web 前端开发中，我们常用 `document.addEventListener('visibilitychange')` 来判断用户是不是切到了别的标签页，从而决定要不要暂停视频播放或者停止轮询。
> 移动端 App 的前后台切换比 Web 复杂得多。比如突然来个电话、用户下拉通知中心、把 App 切到后台，系统可能会随时把你的 App 杀掉。
> 今天我们就来看看 Flutter 是如何管理应用生命周期的，以及如何用 `Isolate` 处理耗时的后台计算。

---

## 1. 监测生命周期的神器：WidgetsBindingObserver

要监听整个 App 的生命周期状态（注意：不是单个页面的 `initState` 和 `dispose`），我们需要让组件混入 (mixin) 系统的 `WidgetsBindingObserver`。

### 核心的四种状态：

在 Flutter 中，App 的状态 (`AppLifecycleState`) 主要有以下四种：

1. **`resumed` (处于前台并可见)**：这是最常见的状态，用户正在和你的 App 愉快的交互。相当于前端的 `visibilityState === 'visible'`。
2. **`inactive` (处于非活动状态)**：App 还可见，但无法接收用户输入。典型场景：打来了系统电话、拉下了 iOS 的控制中心/通知中心、或者在这个应用之上弹出了另一个不可取消的系统级弹窗。
3. **`paused` (停留在后台)**：App 完全不可见，用户切到了主屏幕或其他 App。此时你的代码虽然还能跑一会儿，但随时可能被系统杀死回收内存（相当于被挂起）。相当于前端的 `visibilityState === 'hidden'`。
4. **`detached` (已脱离视图树)**：App 的宿主视图已经被销毁，但 Flutter 引擎还在运行（比如某些特殊的后台 service 场景，或者即将被彻底杀掉前的一瞬间），这个状态我们平时很少去处理。

### 怎么监听？

只要你的 `State` 加上 `with WidgetsBindingObserver`：

```dart
class _MyPageState extends State<MyPage> with WidgetsBindingObserver {

  @override
  void initState() {
    super.initState();
    // 1. 注册观察者
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    // 2. 记得注销观察者，防止内存泄漏！
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // 3. 核心回调：每次状态改变都会经过这里
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    switch (state) {
      case AppLifecycleState.resumed:
        print("💡 App 回到前台啦！(可以恢复播放、重连 WebSocket、刷新 Token)");
        break;
      case AppLifecycleState.inactive:
        print("⚠️ App 失去了焦点 (比如拉下了通知栏 / 接到来电)");
        break;
      case AppLifecycleState.paused:
        print("⏸️ App 切到后台了 (记得保存草稿、暂停视频任务、断开长连接)");
        break;
      case AppLifecycleState.detached:
        print("💀 视图被销毁");
        break;
      case AppLifecycleState.hidden:
        // Flutter 3.13 之后新增的状态，介于 inactive 和 paused 之间，桌面端常用
        print("🙈 App 完全被遮挡");
        break;
    }
  }
}
```

### 经典实战场景：切后台时的“隐私遮罩” 🛡️

金融类的 App（比如银行或支付宝）在切到系统多任务卡片视图时，为了防偷窥，会将卡片内容模糊或者盖上一张白图。

用刚才学的生命周期，怎么做？

非常简单：
当 `state == AppLifecycleState.inactive` 或者 `paused` 的时候，在所有的界面的上方用 `Stack` 盖一个 `Container` 高斯模糊层就行了，切回 `resumed` 再去掉即可，在我们的 Demo 里有一份完整演示。

---

## 2. Isolate：Dart 的多线程模型 (对标 Web Worker)

大家都知道，无论是 JS 还是 Dart，它们默认都是**单线程**的模型。这意味着如果你在主线程写了一个极其耗时的 `for` 循环（比如解析一个巨大的 100MB 的 JSON 字符串，或者进行复杂的图片像素处理），整个 UI 就会完全卡死，所有动画都会掉帧。

在前端，遇到这种 CPU 密集型任务，我们会起一个 `Web Worker`。
在 Dart 中，对标的概念叫做 **Isolate**（隔离区）。

### Isolate 的特点

为什么叫"隔离区"而不叫"线程 (Thread)"？
因为它与传统 Java/C++ 多线程最大的区别在于：**多个 Isolate 之间是完全不共享内存的！** 它们有各自独立的堆栈。互相通信只能像两台不同的机器一样，通过互相传消息（传值序列化）来交互。

这就避免了极其头疼的"死锁"问题（前端小伙伴直呼内行，这不就是 Web Worker/postMessage 嘛！）。

### 最简用法：`Isolate.run()`

在 Flutter 高版本中，官方为我们提供了一个极其简单的语法糖：`Isolate.run()`。

我们先看如果不用 Isolate 强行做耗时计算的后果：

```dart
int heavyTask(int value) {
  int sum = 0;
  for (int i = 0; i < 1000000000; i++) { sum += i; } // UI 此时直接卡死 2 秒钟
  return sum;
}
final result = heavyTask(10);
```

**改造后（丝滑无感）：**

```dart
import 'dart:isolate';

// 耗时函数，必须是一个能够被独立调用的全局函数或 static 方法
int heavyTask(int value) {
  int sum = 0;
  for (int i = 0; i < 1000000000; i++) { sum += i; }
  return sum;
}

// 在点击按钮时，用 await 把任务丢到另一个 isolate 去跑
final result = await Isolate.run(() => heavyTask(10));
// UI 继续流畅运转，完全不卡
```

> **注意**：传给 `Isolate.run()` 的计算函数内部不能涉及任何 UI 操作（不能用到 `BuildContext`，也不能调用 `setState`），它就是一个纯正的、在另一个世界跑的黑盒计算环境，只能接受参数运算并把结果通过 `return` 扔回来。

---

## 3. 真正的后台任务 (App 关掉了还要定期跑)

前面讲的 `Isolate` 其实大多用于 App 还是打开存活着的期间，为了防止主线程卡顿而开辟的。
但需求往往更贪婪：“**就算用户把 App 杀掉了，我也想每天早上 8 点钟在后台默默预加载好今日的数据。**”

这个领域，对前端转过来的同学可能非常陌生（PWA 的 Service Worker 勉强算，但支持极其有限）。

在这个领域中，系统的限制越来越严格（防止耗电）：在 iOS 上属于 Background Fetch，在 Android 上叫 WorkManager。

在 Flutter 这边，主流的方案是使用插件：[`workmanager`](https://pub.dev/packages/workmanager)

```dart
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    // 假设这行代码是在每天早上 8 点系统悄悄唤醒的后台去执行的
    print("我在后台悄悄地跑了一次数据同步：$task");

    // 你可以在这里发起一次 Http 请求预读数据存入 Sqlite
    // 或者发送一个本地通知给用户

    return Future.value(true);
  });
}

// 注册
Workmanager().initialize(callbackDispatcher);
// 设定：每搁 15 分钟最少跑一次 (实际上 Android 会根据省电策略推迟)
Workmanager().registerPeriodicTask(
  "uniqueName",
  "simpleTask",
  frequency: Duration(minutes: 15),
);
```

由于真正的存活级常驻后台任务坑极多（由于国内安卓各大魔改厂商的杀后台策略极其奔放，比如 MIUI 的神隐模式，或者 iOS 直接限制执行时间只有 30 秒无法唤醒等），因此非即时通讯强需求，能不用尽量不用，**业务层更建议在 App 回到前台(`resumed`)时进行数据重新对比。**

所以本篇 Day 25 我们仅实战 App 存活期间的"生命周期处理（隐私保护）"与"防卡顿（Isolate 计算）"。

---

## 4. Demo 在哪看

已经写好了一个演示页面：`lib/pages/lifecycle_demo/lifecycle_demo_page.dart`

入口在：**我的 → 开发者工具 → 周期与性能**

在这个页面里你可以体会两件事：

1. **感受高斯模糊遮罩**：当由于操作回到主屏、在概览（多任务）卡中切走该应用时，你会看到应用界面的内容变模糊，从而防止被人偷窥内容进度。
2. **体验 Isolate 威力**：对比在主线程运行耗时循环与在 Isolate 隔离室运行的巨大防卡顿差异，有个一直在旋转的指示器，主线程耗时计算时会立刻卡死停止，Isolate 不会。

---

## Day 25 小结 📝

- 坚记四种状态：`resumed` (活跃)、`inactive` (被弹窗/通知等覆盖)、`paused` (进入后台)、`detached`。其中前后台切换、WebSocket 重连等极度依赖该事件。
- 切后台时实现一个堆叠(`Stack`)的高斯模糊能够有效拦截卡片预览隐私！
- **Dart is Single Thread**：如果有大数据集处理或者 JSON 解析或者图形计算，牢记 `Isolate.run()` 防阻塞。
- 如需实现即使被杀后台也能定期醒来干活（如下载与邮件同步）的功能，可以借助 `workmanager` 包来做（实际效果取决于厂家的“杀后台”魔改策略紧度）。

> 📖 下篇预告：**Day 26: 视频播放器与流媒体 (Video Player)**——不再局限于图文，打造沉浸式动态应用不可或缺的信息表达形式。
