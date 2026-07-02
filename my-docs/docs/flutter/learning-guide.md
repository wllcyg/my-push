# Flutter Deer 仿写学习实战指南 (2026 现代化重构版)

这份文档旨在指导你如何从零开始，参考 `flutter_deer` 的优秀业务逻辑，但使用 **2026年主流的现代化技术栈** 来重构和搭建一个企业级 Flutter 应用。

我们将摒弃过时的 MVP 模式，全面拥抱 **MVVM + Riverpod + GoRouter**。

---

## 🚀 第一阶段：工程初始化与现代化架构

### 1. 核心技术栈选型 (New & Trendy)

我们不再使用 `flutter_deer` 原版的老旧依赖，改为目前社区最推荐的黄金组合：

| 模块 | 原版技术 (Old) | **新版技术 (New)** | 理由 |
| :--- | :--- | :--- | :--- |
| **状态管理** | Provider | **Riverpod (hooks_riverpod)** | 编译时安全，无 Context 依赖，更强大的状态组合能力。 |
| **路由管理** | Fluro | **GoRouter** | 官方推荐，声明式路由，完美支持 Deep Link 和 路由守卫。 |
| **架构模式** | MVP | **MVVM (Model-View-ViewModel)** | 更符合 Flutter 声明式 UI 的特点，代码更少更解耦。 |
| **资源管理** | 手写字符串 | **FlutterGen** | 自动生成资源索引，避免拼写错误，带类型提示。(需在 dev_dependencies 添加 flutter_gen_runner) |
| **网络请求** | Dio | **Dio + Retrofit** | 通过注解自动生成请求代码，极大减少模板代码。 |

### 2. 规范目录结构 (MVVM 版)
请在 `lib/` 目录下创建最新的 MVVM 结构。相比 MVP，MVVM 少了 Presenter 层，多了 ViewModels 和 Providers。

```text
lib/
├── common/          # 通用配置 (常量、全局变量)
├── net/             # 网络层 (Dio 封装)
├── res/             # 资源 (颜色、主题、字体，图片索引由 FlutterGen 生成)
├── routers/         # 路由配置 (GoRouter)
├── models/          # 数据模型 (JsonToDart)
├── view_models/     # 状态管理层 (Riverpod Providers)
├── pages/           # 页面层 (UI)
│   ├── login/       # 登录模块
│   ├── home/        # 首页模块
│   └── ...
├── widgets/         # 通用组件
└── main.dart        # 入口
```

### 3. 管理依赖 (Dependencies)
打开 `pubspec.yaml`，添加这些现代化库：

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # 1. 状态管理 (Riverpod 全家桶)
  flutter_riverpod: ^2.6.1
  flutter_hooks: ^0.20.5
  hooks_riverpod: ^2.6.1
  
  # 2. 路由管理 (官方推荐)
  go_router: ^14.6.0
  
  # 3. 屏幕适配
  flutter_screenutil: ^5.9.3
  
  # 4. 网络请求
  dio: ^5.7.0
  # 简化的本地存储 (替代 SharedPreference)
  shared_preferences: ^2.4.0 

dev_dependencies:
  flutter_test:
    sdk: flutter
  # 代码生成工具 (用于 Riverpod 和 Retrofit)
  build_runner: ^2.4.14
  riverpod_generator: ^2.6.3
  # 5. 资源生成器 (FlutterGen)
  flutter_gen_runner: ^5.8.0

# ⚠️ 注意：FlutterGen 还需要在 pubspec.yaml 的底部添加配置：
# flutter_gen:
#   output: lib/gen/ # 指定生成文件的位置
#   line_length: 80

```

**✅ 任务 1：** 更新你的 `pubspec.yaml` 并运行 `flutter pub get`。

---

## 🎨 第二阶段：基础设施建设 (GoRouter & Theme)

### 1. 现代化路由配置 (`routers/app_router.dart`)
在 `lib/routers/` 下创建 `app_router.dart`。使用 GoRouter 配置路由表。

```dart
// 伪代码示例，之后我们会详细写
final goRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(path: '/splash', builder: (context, state) => const SplashPage()),
    GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
    GoRoute(path: '/home', builder: (context, state) => const HomePage()),
  ],
);
```

### 2. ProviderScope 入口改造 (`main.dart`)
使用 Riverpod 必须在 App 顶层包裹 `ProviderScope`。

```dart
void main() {
  runApp(
    // Riverpod 的状态容器
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
     // 这里使用 flutter_screenutil 初始化
    return ScreenUtilInit(
      designSize: const Size(375, 812),
      builder: (context, child) {
        // 使用 GoRouter
        return MaterialApp.router(
          title: 'Modern Flutter Deer',
          routerConfig: goRouter, // 关联上面定义的 router
          theme: ThemeData(useMaterial3: true), // 开启 Material 3
        );
      },
    );
  }
}
```

---

## ⚡️ 第三阶段：MVVM 实战 (登录模块)

我们将通过“登录”功能来体验 MVVM + Riverpod 的强大。

### 1. View (UI 层)
不再需要 `StatefulWidget`。使用 `HookConsumerWidget`，我们可以直接在 `build` 方法里使用 `useTextEditingController` (Hooks) 和 `ref.watch` (Riverpod)。

**文件：** `lib/pages/login/login_page.dart`

```dart
class LoginPage extends HookConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 自动管理 Controller 生命周期，无需 dispose
    final phoneController = useTextEditingController();
    
    // 监听登录状态 (loading/success/error)
    final loginState = ref.watch(loginViewModelProvider);

    return Scaffold(
      body: Column(
        children: [
          TextField(controller: phoneController),
          if (loginState.isLoading)
            CircularProgressIndicator()
          else
            ElevatedButton(
              onPressed: () {
                // 调用 ViewModel 的方法
                ref.read(loginViewModelProvider.notifier).login(
                  phoneController.text, "password"
                );
              },
              child: Text("登录"),
            ),
        ],
      ),
    );
  }
}
```

### 2. ViewModel (业务逻辑层)
使用 Riverpod 的 `NotifierProvider` 或新的 `Code Generation` 语法来定义 ViewModel。它负责处理逻辑，并通知 View 更新。

**文件：** `lib/view_models/login_view_model.dart`

```dart
// 使用 riverpod_generator 自动生成 Provider
@riverpod
class LoginViewModel extends _$LoginViewModel {
  @override
  AppStatus build() {
    return AppStatus.initial; // 初始状态
  }

  Future<void> login(String phone, String pwd) async {
    state = AppStatus.loading; // 变更为加载中... UI 会自动转圈
    try {
      // 模拟网络请求
      await Future.delayed(const Duration(seconds: 2));
      state = AppStatus.success;
      // 登录成功，使用 ref.read(routerProvider).go('/home');
    } catch (e) {
      state = AppStatus.error;
    }
  }
}
```

---

## 🗺 学习计划

1.  **Environment**: 更新 `pubspec.yaml`，引入 Riverpod 和 GoRouter。
2.  **Structure**: 建立上述 MVVM 目录结构。
3.  **Entry**: 改造 `main.dart`，配置 `ProviderScope` 和 `MaterialApp.router`。
4.  **First Page**: 编写一个极简的路由文件，跑通 App 到一个空白首页。

**准备好开始了吗？请完成 Step 1 和 Step 2，然后我们可以开始写代码了！**
