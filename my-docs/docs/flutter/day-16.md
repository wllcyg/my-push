# 前端转 Flutter 笔记 (Day 12)：数据持久化与离线缓存 (从 localStorage 到 Isar) 💾

> **前言**：
> 在前端开发中，我们对 `localStorage`、`sessionStorage` 甚至 `IndexedDB` 已经如数家珍。当应用关闭再打开时，保留用户的设置、登录状态或是缓存的接口数据，是提升用户体验的关键。
>
> 在 Flutter 中，我们也要面对同样的问题，而且移动端对离线体验（Offline First）的要求远比 Web 端苛刻。今天我们一起来看看，Flutter 是如何解决“数据存到哪里”这个问题的。

---

## 1. 对标 localStorage：SharedPreferences (SP) 🔑

当我们只需要存储简单的键值对（Key-Value），比如：用户名、是否开启深色模式、首次启动引导页标识等，首选官方插件 `shared_preferences`。

它在不同平台的底层实现：

- **iOS/macOS**: `NSUserDefaults`
- **Android**: `SharedPreferences`
- **Web**: `localStorage`

### 安装

```bash
flutter pub add shared_preferences
```

### 基础用法对比

**前端 (JS):**

```javascript
// 写
localStorage.setItem("theme", "dark");
localStorage.setItem("age", "18"); // 注意：JS 只能存字符串

// 读
const theme = localStorage.getItem("theme");
```

**Flutter (Dart):**

```dart
import 'package:shared_preferences/shared_preferences.dart';

Future<void> saveSettings() async {
  // 1. 获取实例 (异步)
  final prefs = await SharedPreferences.getInstance();

  // 2. 写入数据 (支持多种基础类型：String, int, double, bool, List<String>)
  await prefs.setString('theme', 'dark');
  await prefs.setInt('age', 18); // 类型安全！
  await prefs.setBool('isFirstLaunch', false);
}

Future<void> loadSettings() async {
  final prefs = await SharedPreferences.getInstance();

  // 3. 读取数据 (如果没有则返回 null)
  final theme = prefs.getString('theme') ?? 'light'; // 提供默认值
  final age = prefs.getInt('age');
}
```

> **🔥 核心痛点与解法 (结合 Riverpod)**：
> 在实际项目中，到处写 `SharedPreferences.getInstance()` 是非常痛苦且低效的。
> **最佳实践**是在 `main()` 函数中初始化并**同步**获取，然后注入到 Riverpod 中！

#### 高级封装：配合 Riverpod 的全局同步配置

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 1. 定义一个 Provider 专门用来提供 SP 实例
// 先抛出一个 UnimplementedError，稍后在 main.dart 中覆盖它
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError();
});

// 2. 基于实例，定义一个具体的业务 Provider (例如深色模式)
class ThemeNotifier extends StateNotifier<bool> {
  ThemeNotifier(this.prefs) : super(prefs.getBool('isDark') ?? false);

  final SharedPreferences prefs;

  void toggle() {
    state = !state;
    // 状态改变时，同时持久化到本地
    prefs.setBool('isDark', state);
  }
}

final themeProvider = StateNotifierProvider<ThemeNotifier, bool>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider); // 优雅地拿到同步实例
  return ThemeNotifier(prefs);
});

// --- main.dart ---
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // App 启动前先异步获取 SP 实例
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [
        // 覆盖 Provider，把已经就绪的实例塞进去！
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const MyApp(),
    ),
  );
}
```

经过这样封装，你的整个 App 就可以随时随地、**同步**读取本地配置了，且与 UI 状态完美绑定！

---

## 2. 告别 IndexDB：认识当红炸子鸡 Isar 🔥

当需要存储**复杂的结构化数据**（比如：大量日历事件、长列表数据缓存、复杂的关联查询），`shared_preferences` 就捉襟见肘了。

你可能听说过 `sqflite`（SQLite 封装）或者 `Hive`。但目前 Flutter 社区最受好评、性能最快、支持强类型的现代 NoSQL 本地数据库是 **Isar**（由 Hive 作者编写的下一代产品）。

> **为什么选 Isar？**
>
> 1.  **快**：号称最快的多平台离线数据库。
> 2.  **强类型**：得益于代码生成，写查询语句时会有完整的代码提示，告别手写 SQL 字符串带来的拼写错误。
> 3.  **支持跨平台**：iOS、Android、MacOS、Windows、Linux、Web 全支持。

### 安装 Isar

Isar 因为大量使用了代码生成技术，所以安装比较特别：

```bash
flutter pub add isar isar_flutter_libs
flutter pub add -d isar_generator build_runner
```

### 第一步：定义你的 Schema (对应后端的 Table / 前端的 Model)

使用 `@collection` 注解标记一个类。

```dart
// file: user_model.dart
import 'package:isar/isar.dart';

// 这行是必须的，之后用于生成自动生成的代码
part 'user_model.g.dart';

@collection
class User {
  // 每个对象必须有一个 Id，使用 Isar.autoIncrement 自动分配
  Id id = Isar.autoIncrement;

  late String name;

  @Index() // 加上索引，加速查询
  late int age;

  String? email; // 可选字段
}
```

### 第二步：运行代码生成器 (Magic! 🪄)

在终端运行：

```bash
flutter pub run build_runner build
# 或者 watch 模式持续监听修改
flutter pub run build_runner watch
```

它会在同级目录下生成一个 `user_model.g.dart`，里面包含了 Isar 需要的底层序列化和查询扩展。

### 第三步：CRUD (增删改查) 实战

```dart
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart'; // 需要先安装获取路径的包
import 'user_model.dart';

Future<void> isarDemo() async {
  // 1. 初始化数据库 (打开连接)
  final dir = await getApplicationDocumentsDirectory();
  final isar = await Isar.open(
    [UserSchema], // 把生成的 Schema 放进来
    directory: dir.path,
  );

  // 2. 增 (Create) / 改 (Update)
  // Isar 所有的写操作写入操作默认在显式事务中执行，必须放在 writeTxn 里
  final newUser = User()
    ..name = 'Jack'
    ..age = 25;

  // put 操作：如果 id 为 autoIncrement 或 null 就是新增
  // 如果包含了已存在的 id 就是更新！
  await isar.writeTxn(() async {
    await isar.users.put(newUser);
  });

  // 3. 查 (Read) - 最强魔法在这里，全部都是强类型！

  // a. 查所有
  final allUsers = await isar.users.where().findAll();

  // b. 条件查询 (注意：这些 filter() 和 equalTo() 都是生成器为你专属打造的)
  final targetUsers = await isar.users.filter()
      .ageEqualTo(25)
      .nameStartsWith('J')
      .findAll();

  // 4. 删 (Delete)
  await isar.writeTxn(() async {
    await isar.users.delete(newUser.id);
  });
}
```

---

## Day 12 总结 📝

- **小数据、简单配置**：`shared_preferences`，配合 Riverpod 全局初始化覆盖是神仙操作。
- **主数据、复杂查询**：拥抱 `Isar`，代码生成带来的强类型查询是前端做梦都想要的体验。
- 时刻谨记：移动端永远要考虑"没网的时候怎么办"。本地存储不仅仅是为了记住用户的选择，更是网络请求的一层防弹衣（Cache）。

这就是 Day 12 的内容！我们学会了用 `SharedPreferences` 存简单配置、用 `Isar` 存复杂结构化数据。但你可能已经发现一个问题——如果有一天 Isar 不维护了，或者我们想换成 Hive / SQLite，岂不是要改遍所有用到 Isar 的代码？

> **🔜 Day 13 预告**：我们将引入**存储抽象层**，让底层存储可以随意切换，并把 Repository + Riverpod + Offline First 全部串起来，打造真正的生产级架构！
