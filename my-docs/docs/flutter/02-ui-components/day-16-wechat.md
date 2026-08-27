# 前端转 Flutter 笔记 (Day 12)：数据持久化与离线缓存 💾

> 🏷️ **系列**：前端转 Flutter 笔记 ｜ **作者**：moliang
>
> 📅 2026-02-24 ｜ 🕐 预计阅读 10 分钟

---

> **前言**
>
> 在前端开发中，我们对 `localStorage`、`sessionStorage` 甚至 `IndexedDB` 已经如数家珍。当应用关闭再打开时，保留用户的设置、登录状态或是缓存的接口数据，是提升用户体验的关键。
>
> 在 Flutter 中，我们也要面对同样的问题，而且移动端对离线体验（**Offline First**）的要求远比 Web 端苛刻。
>
> **👉 今天我们一起来看看，Flutter 是如何解决"数据存到哪里"这个问题的。**

---

## 📌 本文大纲

```
1. 🔑 对标 localStorage — SharedPreferences 入门与进阶
2. 🔥 告别 IndexDB — 认识当红炸子鸡 Isar
3. 📝 总结与选型建议
```

---

## 1. 🔑 对标 localStorage：SharedPreferences (SP)

当我们只需要存储**简单的键值对**（Key-Value），比如：用户名、是否开启深色模式、首次启动引导页标识等，首选官方插件 `shared_preferences`。

### 🌐 跨平台底层实现

| 平台            | 底层技术            |
| :-------------- | :------------------ |
| **iOS / macOS** | `NSUserDefaults`    |
| **Android**     | `SharedPreferences` |
| **Web**         | `localStorage`      |

> 💡 一套 API，三端通吃！

### 安装

```bash
flutter pub add shared_preferences
```

### 📝 基础用法对比

**前端 (JavaScript)：**

```javascript
// 写入
localStorage.setItem("theme", "dark");
localStorage.setItem("age", "18"); // ⚠️ JS 只能存字符串

// 读取
const theme = localStorage.getItem("theme");
```

**Flutter (Dart)：**

```dart
// 📄 SharedPreferences 基础用法
import 'package:shared_preferences/shared_preferences.dart';

Future<void> saveSettings() async {
  // 1️⃣ 获取实例 (异步)
  final prefs = await SharedPreferences.getInstance();

  // 2️⃣ 写入数据 (支持多种类型：String, int, double, bool, List<String>)
  await prefs.setString('theme', 'dark');
  await prefs.setInt('age', 18);        // ✅ 类型安全！
  await prefs.setBool('isFirstLaunch', false);
}

Future<void> loadSettings() async {
  final prefs = await SharedPreferences.getInstance();

  // 3️⃣ 读取数据 (不存在则返回 null)
  final theme = prefs.getString('theme') ?? 'light'; // 提供默认值
  final age = prefs.getInt('age');
}
```

> 🆚 **对比一下**：
>
> - 前端 `localStorage` 只能存字符串，存数字还得手动 `JSON.parse()`
> - Flutter SP 原生支持 `int` / `double` / `bool`，**类型安全**，告别手动转换！

---

### 🚀 高级封装：配合 Riverpod 的全局同步配置

> 🔥 **核心痛点**：在实际项目中，到处写 `SharedPreferences.getInstance()` 是非常痛苦且低效的。
>
> **最佳实践**：在 `main()` 中初始化并**同步**获取，然后注入到 Riverpod 中！

```dart
// 📄 file: lib/providers/theme_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 1️⃣ 定义一个 Provider 专门提供 SP 实例
// 先抛出 UnimplementedError，稍后在 main.dart 中覆盖
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError();
});

// 2️⃣ 基于实例，定义业务 Provider (例如深色模式)
class ThemeNotifier extends StateNotifier<bool> {
  ThemeNotifier(this.prefs)
      : super(prefs.getBool('isDark') ?? false);

  final SharedPreferences prefs;

  void toggle() {
    state = !state;
    // ✨ 状态改变时，同时持久化到本地
    prefs.setBool('isDark', state);
  }
}

final themeProvider =
    StateNotifierProvider<ThemeNotifier, bool>((ref) {
  // 优雅地拿到同步实例 👇
  final prefs = ref.watch(sharedPreferencesProvider);
  return ThemeNotifier(prefs);
});
```

```dart
// 📄 main.dart — 启动时一次性初始化
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 🔑 App 启动前先异步获取 SP 实例
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        // ✨ 把已经就绪的实例塞进去！
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const MyApp(),
    ),
  );
}
```

> 🎉 经过这样封装，你的整个 App 就可以随时随地、**同步**读取本地配置了，且与 UI 状态完美绑定！

---

## 2. 🔥 告别 IndexDB：认识当红炸子鸡 Isar

当需要存储**复杂的结构化数据**（比如：大量日历事件、长列表数据缓存、复杂的关联查询），`shared_preferences` 就捉襟见肘了。

你可能听说过 `sqflite`（SQLite 封装）或者 `Hive`。但目前 Flutter 社区最受好评、性能最快、支持强类型的现代 NoSQL 本地数据库是——

### 🏆 为什么选 Isar？

| 优势          | 说明                                            |
| :------------ | :---------------------------------------------- |
| **⚡ 极快**   | 号称最快的多平台离线数据库                      |
| **🔒 强类型** | 代码生成带来完整代码提示，告别手写 SQL 拼写错误 |
| **🌍 全平台** | iOS、Android、macOS、Windows、Linux、Web 全支持 |

> 💡 **前端类比**：如果说 SP 是 `localStorage`，那 Isar 就是一个**自带 TypeScript 类型推导的 IndexedDB**，而且性能更快、API 更优雅。

### 安装 Isar

Isar 大量使用代码生成技术，所以安装比较特别：

```bash
# 运行时依赖
flutter pub add isar isar_flutter_libs

# 开发时依赖 (代码生成器)
flutter pub add -d isar_generator build_runner
```

---

### 📋 第一步：定义 Schema

使用 `@collection` 注解标记一个类（对应后端的 Table / 前端的 Model）：

```dart
// 📄 file: lib/models/user_model.dart
import 'package:isar/isar.dart';

// 👇 必须的，用于自动生成代码
part 'user_model.g.dart';

@collection
class User {
  // 每个对象必须有一个 Id
  // 使用 Isar.autoIncrement 自动分配
  Id id = Isar.autoIncrement;

  late String name;

  @Index()  // 👈 加上索引，加速查询
  late int age;

  String? email;  // 可选字段
}
```

---

### 🪄 第二步：运行代码生成器

```bash
flutter pub run build_runner build

# 或者 watch 模式持续监听修改 👇
flutter pub run build_runner watch
```

> 它会在同级目录下生成 `user_model.g.dart`，包含 Isar 需要的底层序列化和**查询扩展**。

---

### ⚡ 第三步：CRUD 增删改查实战

```dart
// 📄 Isar CRUD 完整示例
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'user_model.dart';

Future<void> isarDemo() async {

  // 1️⃣ 初始化数据库 (打开连接)
  final dir = await getApplicationDocumentsDirectory();
  final isar = await Isar.open(
    [UserSchema],  // 把生成的 Schema 放进来
    directory: dir.path,
  );

  // 2️⃣ 增 (Create) / 改 (Update)
  // ⚠️ Isar 所有写操作必须放在 writeTxn 中
  final newUser = User()
    ..name = 'Jack'
    ..age = 25;

  await isar.writeTxn(() async {
    // put：id 为 autoIncrement → 新增
    //       id 已存在 → 更新！
    await isar.users.put(newUser);
  });

  // 3️⃣ 查 (Read) — 最强魔法在这里！
  //    全部都是强类型，有完整代码提示 ✨

  // a. 查所有
  final allUsers = await isar.users
      .where()
      .findAll();

  // b. 条件查询
  // 💡 这些 filter() 和 equalTo() 都是生成器
  //    为你专属打造的！
  final targetUsers = await isar.users
      .filter()
      .ageEqualTo(25)
      .nameStartsWith('J')
      .findAll();

  // 4️⃣ 删 (Delete)
  await isar.writeTxn(() async {
    await isar.users.delete(newUser.id);
  });
}
```

> 🆚 **对比 IndexedDB**：
>
> ```
> IndexedDB          →  游标、事务、回调地狱 😵
> Isar               →  链式调用、强类型、代码提示 🎉
> ```
>
> 写过 IndexedDB 的前端同学一定会感动哭的。

---

## 📝 Day 12 总结

| 场景             | 推荐方案            | 关键词                                   |
| :--------------- | :------------------ | :--------------------------------------- |
| 小数据、简单配置 | `SharedPreferences` | 配合 Riverpod 全局初始化覆盖是神仙操作   |
| 主数据、复杂查询 | `Isar`              | 代码生成带来的强类型查询，前端做梦都想要 |
| 离线体验         | 两者结合            | 本地存储是网络请求的一层**防弹衣**       |

> ⚠️ **时刻谨记**：移动端永远要考虑"没网的时候怎么办"。本地存储不仅仅是为了记住用户的选择，更是网络请求的一层缓存防线。

---

> 🤔 **你可能已经发现一个问题**——
>
> 如果有一天 Isar 不维护了，或者我们想换成 Hive / SQLite，岂不是要改遍所有用到 Isar 的代码？
>
> 🔜 **Day 13 预告**：我们将引入**存储抽象层**，让底层存储可以随意切换，并把 Repository + Riverpod + Offline First 全部串起来，打造真正的**生产级架构**！

---

> 📚 **系列导航**
>
> ⬅️ 上一篇：Day 11 — 网络请求与状态管理
>
> ➡️ 下一篇：Day 13 — 存储抽象层与 Offline First 架构
>
> 🌟 觉得有帮助？**点赞 + 收藏 + 在看**，三连是最大的鼓励！
