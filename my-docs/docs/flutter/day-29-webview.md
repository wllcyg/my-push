# 前端转 Flutter 笔记 (Day 29)：WebView 深度实战 🌐

> **前言**：
> 在 Web 开发中，WebView 就像是一个内嵌的浏览器窗口。在 Flutter 应用里，虽然我们推崇用原生渲染，但总有一些场景（如第三方活动页、复杂的富文本协议、已有的 H5 业务）离不开 WebView。
>
> 这一章节，我们将攻克 Flutter 与 Web 的“跨界之恋”：不仅能加载页面，还要能通过 JSBridge “眉来眼去”。

---

## 1. 核心武器库：基础选型

在 Flutter 生态中，WebView 主要有两种主流选型：

- **`webview_flutter` (官方版)**：由 Flutter 团队维护，主打稳定、轻量，适合 90% 的普通加载场景。
- **`flutter_inappwebview` (增强版)**：社区维护，功能极其恐怖（支持长按菜单自定义、自签名证书、更强大的 Cookie 管理），适合深度定制场景。

**本课以官方版为核心展开。**

---

## 2. JSBridge：Dart 与 Web 的双向奔赴

前端同学最关心的就是：**JS 如何调原生？原生又如何调 JS？**

### 2.1 JS 开启“通话” (JavaScriptChannel)

在 `WebViewController` 初始化时，通过 `addJavaScriptChannel` 监听消息：

```dart
final controller = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..addJavaScriptChannel(
    'Toaster', // 通道名，JS 端调用：Toaster.postMessage('hello')
    onMessageReceived: (JavaScriptMessage message) {
      print('收到来自 H5 的密报：${message.message}');
      // 可以在这里调用 Flutter 代码，比如：
      // ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message.message)));
    },
  );
```

### 2.2 原生发起“指示” (runJavaScript)

当你需要操控页面内容（比如隐藏某一个 DOM 节点）时：

```dart
await controller.runJavaScript(
  "document.querySelector('.ad-banner').style.display = 'none';"
);
```

> 📌 **避坑指南**：调用 `runJavaScript` 时，请确保页面已经加载完成，否则 JS 引擎还没准备好，脚本会执行失败。

---

## 3. 加载体验：让 WebView 像原生一样丝滑

用户最讨厌看白屏。我们需要给它加上进度监听。

### 3.1 进度监听与加载动画

```dart
WebViewController()
  ..setNavigationDelegate(
    NavigationDelegate(
      onProgress: (int progress) {
        // 更新你的 LinearProgressIndicator 进度值
        print("当前加载进度：$progress%");
      },
      onPageStarted: (String url) => print('开始加载：$url'),
      onPageFinished: (String url) => print('加载完成：$url'),
      onWebResourceError: (WebResourceError error) {
        // 自定义错误页逻辑
      },
    ),
  );
```

---

## 4. 混合开发常见痛点 (Checklist)

### 4.1 Cookie 与登录态同步

H5 如果需要用户登录信息，你需要在 Header 或通过 JS 注入。
对于持久化 Cookie，官方提供了 `WebViewCookieManager`，可以手动设置跨域 Cookie。

### 4.2 滚动冲突 (Scroll Collision)

当你把 WebView 丢进一个 `ListView` 里面：
**现象**：你会发现滑 WebView 没反应，或者外层列表跟着乱动。
**解法**：为 WebView 配置 `gestureRecognizers`，明确告诉引擎哪类手势该给 WebView 拦截。

```dart
WebViewWidget(
  controller: controller,
  gestureRecognizers: {
    Factory<VerticalDragGestureRecognizer>(() => VerticalDragGestureRecognizer()),
  },
)
```

---

## 5. 什么时候该放弃 WebView？

作为大厂架构师，我给你的建议：

1. **强交互场景**：如果你要做一个像按钮点击反馈极其灵敏的小游戏，放弃 WebView，直接用 Flutter 原生 Canvas 或 Rive。
2. **核心业务路径**：如果这是你的 App 首页或核心下单流，尽量用原生，SEO 虽然不重要，但 **冷启动白屏、重内存占用、以及不同系统的渲染坑** 都是 WebView 的原罪。

---

> 📌 **WebView 箴言**：它是混合开发的最后一道防线，而不是偷懒的捷径。用好 JSBridge，让 Web 像原生的一员，才是最高段位的玩法。
