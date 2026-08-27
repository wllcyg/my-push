# 前端转 Flutter 笔记 (Day 3)：弃暗投明？从 CloudBase 到 Supabase 的大迁移 🦢

> **摘要**：Day 3 原本计划攻克腾讯云 CloudBase 的 V3 签名，但在硬着头皮写了半天 HMAC-SHA256 后，我突然意识到：“我只是想写个 App，为什么要研究加密算法？”
>于是，我做了一个违背祖宗的决定——**删代码，换 Supabase**。

## 1. 劝退：CloudBase 的“签名之痛” �

前一天还在研究 HTTP Trigger 和 V3 签名。
过程大概是这样的：
1.  对着文档拼凑 Signature 字符串。
2.  调试报错 `403 SignatureFailure`。
3.  怀疑人生：是不是 timestamp 格式不对？是不是 Header 顺序不对？
4.  好不容易通了，发现还要自己封装 Token 管理、登录状态维持...

**反思**：作为前端/移动端开发者，**Auth (鉴权)** 和 **Database (数据库)** 应该是基础设施，像 Firebase 那样开箱即用，而不是让我去写底层的 HTTP 签名。

## 2. 新方案：Supabase (The Open Source Firebase) �

在 GitHub 上转了一圈，发现了 **Supabase**。
*   **Postgres**：底层是正经的关系型数据库（SQL!），但也支持 JSON。
*   **Auth**：一行代码集成手机号、邮箱、Google 登录。
*   **Flutter SDK**：官方支持且活跃 `supabase_flutter`。

这不就是我在找的“现代化后端”吗？

## 3. 极速迁移实录 ⚡️

### Step 1: 删代码
我不带一丝留恋地删掉了写了一半的 `CloudBaseClient` 和那一堆签名逻辑。
*   🗑️ `lib/http/cloudbase_client.dart` (Deleted)
*   🗑️ `lib/utils/signature.dart` (Deleted)

### Step 2: 引入 Supabase
在 `pubspec.yaml` 里一键从零开始：

```yaml
dependencies:
  supabase_flutter: ^2.8.3 # 真香
```

### Step 3: 初始化 (main.dart)

对比之前的几十行签名代码，现在的初始化简直感动哭：

```dart
// main.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 环境变量加载 (依然重要)
  await dotenv.load(fileName: ".env");

  // Supabase 启动！
  await Supabase.initialize(
    url: dotenv.env['SUPABASE_URL']!,
    anonKey: dotenv.env['SUPABASE_ANON_KEY']!,
  );

  runApp(const ProviderScope(child: MyApp()));
}
```

### Step 4: 环境变量配置 (.env)
去 Supabase 后台复制 URL 和 Anon Key，扔进 `.env`：

```properties
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
```

## 4. 为什么这是正确的选择？ ✅

1.  **开发效率**：从“造轮子”变成了“搭积木”。
2.  **类型安全**：Supabase 的 Flutter SDK 配合 `build_runner`甚至能生成代码（虽然我现在还没用上）。
3.  **未来可期**：自带 Realtime（实时功能的 WebSocket），以后做聊天功能不用愁了。

## Day 3 总结

今天最爽的时刻不是写出了代码，而是**删掉了复杂的代码**。
Less code, less bugs.

虽然今天都在折腾基建，但把后端从“困难模式”切换到了“简单模式”，这时间的投入绝对超值。

**明日预告**：基于 Supabase 实现真正的**手机号/密码登录**，这次是真的要写业务逻辑了，不再处理 403 报错了！
