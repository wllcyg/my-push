# 前端转 Flutter 笔记 (Day 4)：搭积木——从导航栏到富文本编辑器 🧱

> **摘要**：Day 4，这一天终于不再这是折腾配置和后端了，开始真正地“搬砖”写页面。今天的重点是搭建 App 的主骨架（底部导航）以及攻克一个核心功能——富文本日记编辑器。顺便还要填平 iOS 编译在这个过程中的一些深坑。

## 1. App 的骨架：StatefulShellRoute (保活的 Tab 除了 keep-alive 还能咋整？) 🦴

在 Vue 中，要在 Tab 切换时保持页面状态，我们通常会用 `<keep-alive>` 包裹 `<router-view>`。
在 Flutter + GoRouter 中，这个概念对应的是 **`StatefulShellRoute`**。

### 为什么不用普通的路由跳转？
如果每次点击 Tab 都 `context.go('/mine')`，页面会重建，滚动位置会丢失。
我们需要的是：切换 Tab 时，页面只是“隐藏”了，而不是“销毁”了。

```dart
// app_router.dart 的核心魔法
StatefulShellRoute.indexedStack(
  builder: (context, state, navigationShell) {
    // MainPage 是我们的“壳”，包裹着四个 Tab 页面
    return MainPage(navigationShell: navigationShell);
  },
  branches: [
    StatefulShellBranch(routes: [GoRoute(path: '/home', ...)]),
    StatefulShellBranch(routes: [GoRoute(path: '/timeline', ...)]),
    // ...
  ],
)
```
这就像是在 Vue App.vue 里写好了一个持久化的 Layout。

## 2. 悬浮按钮 (FAB)：原生体验的细节 ✨

以前做 H5，为了做一个不管键盘弹不弹起都固定在右下角的按钮，得监听 `resize` 事件或者使用 `visualViewport` API，处理各种 iOS Safari 的键盘回弹兼容性。

在 Flutter 里，`Scaffold` 组件自带 `floatingActionButton` 属性。
**最神奇的体验是**：当你在编辑器页面（`CalendarAddPage`）点击输入框弹出键盘时，FAB 会**自动、平滑地**骑在键盘上方升起。
你不需要写一行代码来监听键盘高度，`Scaffold` 和 `resizeToAvoidBottomInset: true` 默认帮你处理好了一切。这就是原生渲染的降维打击。

```dart
Scaffold(
  body: ...,
  floatingActionButton: FloatingActionButton(
    onPressed: () => context.push('/post'), // 路由跳转
    shape: CircleBorder(), // 变身正圆
    child: Icon(Icons.add),
  ),
)
```

## 3. Supabase Auth 实战：从 401 到 200 OK 🔐

有了昨天 Supabase 的基建，今天顺手把注册和登录逻辑跑通了。

### A. 这样的代码，前端看着真舒服
以前写 `Axios`，我们要自己封装拦截器、存 Token 到 LocalStorage、处理过期的 Refresh Token... 
Supabase 的 SDK 把这些全包圆了。

```dart
// 注册：就一行代码
await Supabase.instance.client.auth.signUp(
  email: email,
  password: password,
);

// 登录：也就一行
await Supabase.instance.client.auth.signInWithPassword(
  email: email,
  password: password,
);
```
登录成功后，SDK 甚至会自动帮你把 Session 存到 Keychain (iOS) / Keystore (Android) 里（前提是我们昨天配置了 `flutter_secure_storage`）。

### B. 坑点：Token 持久化与冷启动
虽然 SDK 帮我们要做了 persistence，但记得在 `main()` 里初始化时显式传入 `localStorage` 参数，否则 Session 可能只是存在内存里，杀掉 App 这次登录就失效了。

```dart
// main.dart 里的关键配置
Supabase.initialize(
  // ...
  authOptions: FlutterAuthClientOptions(
    authFlowType: AuthFlowType.pkce, // 推荐用 PKCE 流程，更安全
    localStorage: SecureLocalStorage(), // 👈 关键！存到手机的安全区域
  ),
);
```

### C. 交互反馈：Flutter Smart Dialog
在 Vue 里我们习惯用 `ElementUI.Message` 或 `Toast`。
Flutter 里我引入了 `flutter_smart_dialog`。在请求开始前 `SmartDialog.showLoading()`，结束后 `dismiss()`。这种命令式的调用方式，让逻辑写起来非常线性，不用去维护一堆 `isLoading` 的状态变量。

## 4. 富文本编辑器：Flutter Quill 的 V11 踩坑记 📝

日记 App 的核心就是写日记。我选用了 `flutter_quill`，它是 Flutter 生态里最成熟的富文本编辑器（对应前端的 Quill.js）。
但是，这也带来了今天的最大挑战：**版本升级 (v11)**。

### 💥 遇到的坑：API 大改与国际化报错
V10 到 V11 是破坏性更新，很多配置项被移到了 `configurations` 对象里。更坑的是，初始化时直接崩了，报错：
`UnimplementedError: FlutterQuillLocalizations instance is required`

**原因**：Quill V11 强制要求在 App 顶层注入国际化代理（哪怕你不用多语言）。
**解决**：在 `main.dart` 的 `MaterialApp` 里注入 Delegate。

```dart
localizationsDelegates: const [
  GlobalMaterialLocalizations.delegate,
  // ... 其他 Flutter 原生代理
  FlutterQuillLocalizations.delegate, // 👈 必须加上这个！
],
supportedLocales: const [
  Locale('zh', 'CN'), // 支持中文
  Locale('en', 'US'),
],
```
这让我想起了配置 `i18n-vue` 的日子，只能说国际化在哪里都是个细致活。

### 🛠️ 工具栏布局
我实现了一个很经典的移动端布局：
1.  **Editor** 在上，`Expanded` 撑满剩余空间。
2.  **Toolbar** 在下，固定在底部。
这样当键盘弹起时，Toolbar 会贴着键盘顶部，方便操作加粗、插入图片等功能。

```dart
Column(
  children: [
    Expanded(child: QuillEditor.basic(...)), // 编辑区
    QuillSimpleToolbar(...), // 工具栏
  ],
)
```

## 5. iOS 编译之痛：CocoaPods 🍎

在引入 `flutter_quill` 和 `supabase_flutter` 后，iOS 模拟器一度跑不起来。
报错全是底层 C++ 符号丢失或者 Pod 版本不兼容。
**终极技**：
1.  `rm -rf ios/Pods` (删依赖)
2.  `rm ios/Podfile.lock` (删锁文件)
3.  `cd ios && pod install` (重装)
4.  如果是 M1/M2 芯片，可能还需要 `arch -x86_64 pod install` (虽然现在兼容性好多了)。

Flutter 开发，大约 10% 的时间是在和 iOS/Android 的原生构建系统搏斗。这算是跨端开发的“必要之恶”吧。

## Day 4 总结

今天 App 终于“长得像个样”了：
1.  有了底部导航，可以来回切换。
2.  有了漂浮的加号按钮，点击能去发日记。
3.  有了一个能输入、能加粗、能排版的真·编辑器。

虽然中间在 `Podfile` 和 `Quill` 的配置上卡了一会儿，但看到键盘丝滑弹起、组件自动避让的那一刻，觉得这一切换是值得的。

**明日预告**：
把编辑器的内容**真的保存**到 Supabase 数据库里！要设计表结构了 (SQL 搞起！)。
