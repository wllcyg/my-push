# 前端转 Flutter 笔记 (Day 6)：Vue 视角下的路由重构 (GoRouter) 🚀

> **摘要**：Day 6，今天的主题是 "路由重构"。随着 App 功能越来越复杂，之前的简单路由已经捉襟见肘。今天我们引入了 Flutter 界的 "Vue Router" —— **go_router**，并实现了通过 URL 控制页面、权限拦截、以及丝滑的 iOS 转场动画。

## 1. 为什么选 GoRouter？Vue 玩家狂喜 🎉

作为一名前端老司机，习惯了 Vue Router 的声明式路由，看到 Flutter 原生的 `Navigator.push` 总是有点别扭。直到我遇到了 `go_router`：

| 特性 | Vue Router | GoRouter |
| :--- | :--- | :--- |
| **路由表** | `routes` 数组定义 | `routes` 数组定义 |
| **传参** | `/user/:id` | `/user/:id` |
| **跳转** | `router.push('/path')` | `context.push('/path')` |
| **守卫** | `beforeEach` | `redirect` |

简直是无缝衔接！今天我们把整个 App 的路由系统重写了一遍。

## 2. 路由权限控制：拦截未登录用户 🛡️

就像 Vue 的 `beforeEach`，我们需要在用户访问受保护页面（如首页、详情页）时，判断是否登录。

**GoRouter 的 `redirect` 大法：**

```dart
// app_router.dart

redirect: (context, state) {
  // 1. 获取登录状态 (Riverpod 监听)
  final isLoggedIn = authState.value != null;
  final path = state.uri.path;

  // 2. 定义白名单
  final isPublic = path == '/login' || path == '/splash';

  // ⛔ CASE: 未登录且不在白名单 -> 踢回登录页
  if (!isLoggedIn && !isPublic) {
    print('🚫 Access denied: Redirecting to /login');
    return '/login';
  }

  // ✅ CASE: 已登录但还在登录页 -> 自动进首页
  if (isLoggedIn && (path == '/login' || path == '/register')) {
    return '/home';
  }

  return null; // 通过
},
```

配合 `refreshListenable: authNotifier`，一旦登录状态变化，路由会自动重定向，丝般顺滑！

## 3. 混合路由模式：兼顾体验与灵活性 🚀

这是今天的 **高光时刻**。我们面临一个经典两难问题：
- **方案 A (传对象)**：`extra: entry`。体验好，页面不用 Loading，直接展示数据。但**不支持 URL 分享**（Deep Link 进来没有对象）。
- **方案 B (传 ID)**：`/detail/:id`。支持 Deep Link，但每次进去都要**转圈加载**，体验打折。

**我们的方案：混合模式 (Best of Both Worlds)**

我们改造了 `app_router.dart` 和 `DiaryDetailPage`，让它同时支持这两种情况！

**A. 路由定义 (app_router.dart)**
```dart
GoRoute(
  path: '/detail/:id', // 👈 1. 支持 URL 参数
  pageBuilder: (context, state) {
    final id = state.pathParameters['id']!;
    final entry = state.extra as DiaryEntry?; // 👈 2. 尝试获取内存对象
    
    return _slideTransition(context, state, DiaryDetailPage(id: id, entry: entry));
  },
),
```

**B. 页面逻辑 (diary_detail_page.dart)**
```dart
// 优先用传进来的对象(秒开)，没有再用 ID 去查
final asyncEntry = ref.watch(diaryProvider(id));
final displayedEntry = asyncEntry.valueOrNull ?? entry;

if (displayedEntry == null) {
  return LoadingSpinner(); // 只有 Deep Link 进来才会显示 Loading
}
```

这样，App 内部跳转时从不转圈；而未来做 URL 呼起 App 时，也能正常工作。完美！

## 4. 页面转场动画：要有 "原生感" ✨

默认的 Material 动画是底部向上弹出（Android 风格），在 iOS 上我们更习惯 **右侧滑入**。

我们手写了一个 `_slideTransition`：

```dart
CustomTransitionPage(
  key: state.pageKey,
  child: child,
  transitionsBuilder: (context, animation, secondaryAnimation, child) {
    // 从右向左滑入
    const begin = Offset(1.0, 0.0);
    const end = Offset.zero;
    const curve = Curves.easeInOut;

    var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));

    return SlideTransition(
      position: animation.drive(tween),
      child: child,
    );
    return SlideTransition(
      position: animation.drive(tween),
      child: child,
    );
  },
);
```
用在 `pageBuilder` 里替换默认的 `MaterialPage`，瞬间就有那味儿了。

## 5. Deep Link 原生配置 🔧

为了让 `diary://` 这种 URL 真正生效，我们还动了原生工程的配置文件。

### A. Android 配置
修改 `android/app/src/main/AndroidManifest.xml`，在主 Activity 下添加 `intent-filter`：

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <!-- 定义 App 专属 Scheme: diary -->
    <data android:scheme="diary" />
</intent-filter>
```

### B. iOS 配置
修改 `ios/Runner/Info.plist`，添加 `CFBundleURLTypes`：

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>diary</string>
        </array>
    </dict>
</array>
```

配置好后，不需要写一行原生代码，`go_router` 就能自动接管 `diary://detail/123` 的跳转，妙啊！

---

## 6. Vue vs GoRouter 常用操作速查表 (Cheat Sheet)

为了方便快速查阅，这里整理了 Vue 开发者最常用的路由操作对应的 Flutter 写法。

### 6.1 导航 (Navigation)

| 操作 | Vue Router (Composition API) | Flutter GoRouter | 备注 |
| :--- | :--- | :--- | :--- |
| **跳转** | `router.push('/users')` | `context.push('/users')` | 保留历史栈，自带返回按钮 |
| **替换** | `router.replace('/login')` | `context.go('/login')` | 替换当前栈（或重建），常用于登录/Splash |
| **命名跳转** | `router.push({ name: 'user' })` | `context.pushNamed('user')` | 推荐使用命名路由，解耦路径字符串 |
| **返回** | `router.back()` | `context.pop()` | 关闭当前页面/对话框 |
| **带参数跳转** | `router.push({ params: { id: 1 } })` | `context.pushNamed('detail', pathParameters: {'id': '1'})` | 注意 Flutter 的 params 只能是 String Map |
| **带查询参** | `router.push({ path: '/s', query: { q: 'a' } })` | `context.pushNamed('search', queryParameters: {'q': 'a'})` | `/s?q=a` |

### 6.2 获取路由信息 (Route Info)

在 Vue 中我们用 `useRoute()`，在 Flutter 中主要通过 `state` 对象。

| 信息 | Vue Router (`useRoute()`) | Flutter GoRouter (`state`) |
| :--- | :--- | :--- |
| **URL Path** | `route.path` | `state.uri.path` |
| **Path 参数** | `route.params.id` | `state.pathParameters['id']` |
| **Query 参数** | `route.query.q` | `state.uri.queryParameters['q']` |
| **完整 URL** | `route.fullPath` | `state.uri.toString()` |
| **路由名称** | `route.name` | `state.name` |

### 6.3 嵌套路由 (Nested Routes)

*   **Vue**: 使用 `children` 数组 + `<router-view>` 组件。
*   **Flutter**: 使用 `routes` (子路由) + `ShellRoute` (布局容器)。

### 6.4 路由元信息 (Meta)

*   **Vue**: `if (to.meta.auth)`
*   **Flutter**: 在 `redirect` 中直接判断 `state.uri.path` 是否以 `/admin` 开头。

---

## 7. Vue vs Flutter 全局概念对比 (General Concepts)

除了路由，这里顺便总结一下组件开发的核心差异，助你快速上手。

### 7.1 生命周期 (Lifecycle)

| Vue (Options/Composition) | Flutter (StatefulWidget) | 说明 |
| :--- | :--- | :--- |
| `created` / `setup()` | `Widget` 构造函数 | 组件实例化。注意 Flutter 构造函数不应做耗时操作。 |
| `mounted` / `onMounted` | `initState()` | **最重要**。DOM/Widget 插入树中。发请求、初始化监听器在这里做。 |
| `updated` | `didUpdateWidget()` | 父组件重绘导致当前组件参数变化时触发。类似 `watch(props)`。 |
| `unmounted` / `onUnmounted` | `dispose()` | **必须掌握**。组件销毁。务必在这里释放控制器、定时器、Stream 订阅。 |
| `nextTick` | `WidgetsBinding.instance.addPostFrameCallback` | 等待下一帧渲染完成。常用于获取组件尺寸。 |

### 7.2 状态管理 (State)

| Vue | Flutter | 备注 |
| :--- | :--- | :--- |
| `data()` / `ref()` | `State` 类中的变量 | 调用 `setState(() {})` 触发更新（类似 React）。 |
| `provide` / `inject` | `InheritedWidget` / `Provider` | 跨层级传递数据。 |
| `Vuex` / `Pinia` | `Riverpod` / `Bloc` | 全局状态管理。Riverpod 是目前的最佳实践。 |
| `computed` | `late final` / `getter` | Dart 的 getter (`get count => ...`) 是天然的计算属性。 |
| `watch` | `addListener` / `ref.listen` | 监听状态变化执行副作用。 |

### 7.3 模板与渲染 (Template)

Vue 是 HTML 模板，Flutter 是 Widget 树（类似 Render Function）。

| Vue 模板语法 | Flutter Widget | 代码示例 |
| :--- | :--- | :--- |
| `v-if="show"` | Dart `if` | `if (show) Text('Hi')` (在数组中直接写) |
| `v-show="show"` | `Visibility` / `Offstage` | `Visibility(visible: show, child: ...)` |
| `v-for="item in list"` | Dart `for` / `ListView` | `[for (var i in list) Text(i)]` 或 `ListView.builder` |
| `@click="do"` | `GestureDetector` / `InkWell` | `onTap: () => {}` |
| `:class="{ active: ok }"` | 逻辑判断颜色/样式 | `color: ok ? Colors.blue : Colors.grey` |
| `<slot>` | `child` / `children` 属性 | 传递 Widget 作为参数。 |

### 7.4 组件通信 (Props & Emit)

*   **Props (父传子)**: Flutter 通过**构造函数**传参。
*   **Emit (子传父)**: Flutter 通过**回调函数 (Callback)**。

## Day 6 总结

今天的代码量主要集中在架构层面：
1. ✅ **引入 GoRouter**：废弃原生路由，拥抱声明式路由。
2. ✅ **权限守卫**：实现全局登录拦截，安全感满满。
3. ✅ **混合路由设计**：同时搞定了 "性能" 和 "灵活性" 的矛盾。
4. ✅ **自定义动画**：实现了 iOS 风格的右滑切换。

**技术栈回顾：**
- **路由**：`go_router` (Redirect, PathParams, Extra, ShellRoute)
- **状态**：`flutter_riverpod` (监听 Auth 状态)
- **动画**：`CustomTransitionPage`, `SlideTransition`

**明日预告：**
这几天把 UI、交互、路由都搞定了。明天打算研究一下 **性能优化** 和 **打包发布** 相关的流程，毕竟 App 总是要上架见人的嘛。
