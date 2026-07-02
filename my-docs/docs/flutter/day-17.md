# 前端转 Flutter 笔记 (Day 13)：存储抽象层与 Offline First 架构 🧱

> **前言**：
> 在 Day 12 中，我们学会了用 `SharedPreferences` 存简单配置、用 `Isar` 存复杂结构化数据。但如果直接在业务代码里到处写 `isar.users.put()`，那和前端到处写 `localStorage.setItem()` 有什么区别？
>
> 今天我们来解决一个架构级别的问题：**如何让底层存储随意切换，而上层业务代码一行不改？** 这就是存储抽象层的威力。

---

## 1. 🧱 存储抽象层：让底层实现随意切换的秘密

在前端开发中，我们可能用过 `axios` 的拦截器来统一处理请求，或者用 `adapter` 模式封装不同的请求库。在 Flutter 的数据持久化中，同样的思路至关重要——**永远不要让业务代码直接依赖具体的存储库**。

> **🎯 核心思想 (对标前端)**
>
> 前端可能今天用 `localStorage`，明天切到 `IndexedDB`，后天换成 `localForage`。如果你的代码到处都是 `localStorage.setItem()`，迁移成本将是灾难性的。
>
> **解法**：定义一层**抽象接口**（Abstract Class），业务只面向接口编程，具体用什么存储在"注入"时决定。

### 1.1 架构全景图

```
┌─────────────────────────────────────────────┐
│                   UI 层                      │
│           (Widget / Page)                    │
└──────────────────┬──────────────────────────┘
                   │ 调用
                   ▼
┌─────────────────────────────────────────────┐
│              Repository 层                   │
│     (UserRepository / TodoRepository)        │
│     负责协调：网络 + 本地缓存的策略           │
└──────────────────┬──────────────────────────┘
                   │ 依赖注入
                   ▼
┌─────────────────────────────────────────────┐
│           存储抽象层 (Interface)              │
│     abstract class LocalStorage              │
│     (getAll / put / delete / watch)          │
└────┬────────────┬────────────┬───────────────┘
     │            │            │
     ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌──────────────┐
│  Isar   │ │  Hive   │ │ InMemory     │
│  实现    │ │  实现    │ │ (测试用)     │
└─────────┘ └─────────┘ └──────────────┘
```

### 1.2 定义存储抽象接口

这一步最关键——定义一个与任何具体存储都无关的"契约"。

```dart
// file: lib/data/local/local_storage.dart

/// 本地存储的抽象接口
/// 泛型 T 代表存储的数据模型类型
abstract class LocalStorage<T> {
  /// 获取所有数据
  Future<List<T>> getAll();

  /// 根据 ID 获取单条数据
  Future<T?> getById(int id);

  /// 新增或更新 (upsert 语义)
  Future<void> put(T item);

  /// 批量写入
  Future<void> putAll(List<T> items);

  /// 根据 ID 删除
  Future<void> delete(int id);

  /// 清空所有数据
  Future<void> clear();

  /// 监听数据变化 (响应式核心！)
  Stream<List<T>> watchAll();
}
```

> **💡 前端类比**：这就像你在 TypeScript 里定义一个 `interface StorageAdapter`，然后让 `LocalStorageAdapter`、`IndexedDBAdapter` 分别去 `implements` 它。

### 1.3 Isar 实现

```dart
// file: lib/data/local/isar_user_storage.dart
import 'package:isar/isar.dart';
import 'local_storage.dart';
import 'user_model.dart';

class IsarUserStorage implements LocalStorage<User> {
  final Isar isar;

  IsarUserStorage(this.isar);

  @override
  Future<List<User>> getAll() => isar.users.where().findAll();

  @override
  Future<User?> getById(int id) => isar.users.get(id);

  @override
  Future<void> put(User item) async {
    await isar.writeTxn(() => isar.users.put(item));
  }

  @override
  Future<void> putAll(List<User> items) async {
    await isar.writeTxn(() => isar.users.putAll(items));
  }

  @override
  Future<void> delete(int id) async {
    await isar.writeTxn(() => isar.users.delete(id));
  }

  @override
  Future<void> clear() async {
    await isar.writeTxn(() => isar.users.clear());
  }

  @override
  Stream<List<User>> watchAll() {
    // Isar 的杀手锏！数据变化时自动推送
    return isar.users.where().watch(fireImmediately: true);
  }
}
```

### 1.4 内存实现 (用于单元测试)

不装任何数据库依赖，就能跑通全部业务逻辑测试：

```dart
// file: lib/data/local/in_memory_user_storage.dart
import 'dart:async';
import 'local_storage.dart';
import 'user_model.dart';

class InMemoryUserStorage implements LocalStorage<User> {
  final List<User> _store = [];
  final _controller = StreamController<List<User>>.broadcast();

  @override
  Future<List<User>> getAll() async => List.from(_store);

  @override
  Future<User?> getById(int id) async {
    return _store.where((u) => u.id == id).firstOrNull;
  }

  @override
  Future<void> put(User item) async {
    _store.removeWhere((u) => u.id == item.id);
    _store.add(item);
    _controller.add(List.from(_store));
  }

  @override
  Future<void> putAll(List<User> items) async {
    for (final item in items) {
      _store.removeWhere((u) => u.id == item.id);
      _store.add(item);
    }
    _controller.add(List.from(_store));
  }

  @override
  Future<void> delete(int id) async {
    _store.removeWhere((u) => u.id == id);
    _controller.add(List.from(_store));
  }

  @override
  Future<void> clear() async {
    _store.clear();
    _controller.add([]);
  }

  @override
  Stream<List<User>> watchAll() => _controller.stream;
}
```

> **🔥 为什么这个很重要？**
>
> 在前端中你可能用过 `jest.mock()` 去模拟 `localStorage`。但在 Dart/Flutter 中，接口 + 依赖注入的方式更加优雅——你的测试**根本不知道**底层是 Isar 还是内存，完全解耦。

---

## 2. 把它们串起来：Repository + 抽象层 + Riverpod (终极形态) 🏛️

还记得我们在 Day 10 学的 `Repository` 模式吗？现在我们把 **网络层 (Dio)** + **存储抽象层** + **Riverpod** 全部串起来，实现真正的 **Offline First** 架构。

### 2.1 Repository 完整实现

```dart
// file: lib/data/repository/user_repository.dart
import 'package:dio/dio.dart';
import '../local/local_storage.dart';
import '../user_model.dart';

class UserRepository {
  final Dio dio;
  final LocalStorage<User> localStorage; // 只依赖抽象！不关心底层是什么

  UserRepository({required this.dio, required this.localStorage});

  /// Offline First 核心逻辑
  /// 返回一个 Stream，UI 监听它就够了
  Stream<List<User>> watchUsers() {
    // 1. 立即返回本地缓存的 Stream（秒开体验）
    // 2. 同时在后台悄悄请求网络
    _syncFromRemote();

    return localStorage.watchAll();
  }

  /// 后台同步：从网络拉取最新数据 -> 写入本地
  Future<void> _syncFromRemote() async {
    try {
      final response = await dio.get('/api/users');
      final List<dynamic> jsonList = response.data;
      final users = jsonList.map((json) => User.fromJson(json)).toList();

      // 拿到新数据后，更新本地缓存
      // 因为 localStorage.watchAll() 是响应式的，UI 会自动刷新！
      await localStorage.putAll(users);
    } catch (e) {
      // 网络失败？没关系！用户看到的依然是本地缓存数据
      // 这就是 Offline First 的精髓
      print('网络同步失败，使用本地缓存: $e');
    }
  }

  /// 单独获取（先本地，后网络）
  Future<User?> getUserById(int id) async {
    // 先尝试本地
    final local = await localStorage.getById(id);
    if (local != null) return local;

    // 本地没有，再请求网络
    try {
      final response = await dio.get('/api/users/$id');
      final user = User.fromJson(response.data);
      await localStorage.put(user); // 缓存到本地
      return user;
    } catch (e) {
      return null;
    }
  }
}
```

### 2.2 用 Riverpod 连接一切

```dart
// file: lib/providers/storage_providers.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../data/local/local_storage.dart';
import '../data/local/isar_user_storage.dart';
import '../data/repository/user_repository.dart';
import '../data/user_model.dart';

// 1. 存储层 Provider（在 main.dart 中覆盖为具体实现）
final userStorageProvider = Provider<LocalStorage<User>>((ref) {
  throw UnimplementedError('必须在 ProviderScope 中覆盖');
});

// 2. Repository Provider（自动组装 Dio + Storage）
final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(
    dio: Dio(BaseOptions(baseUrl: 'https://your-api.com')),
    localStorage: ref.watch(userStorageProvider), // 注入抽象！
  );
});

// 3. UI 直接用的 StreamProvider
final usersStreamProvider = StreamProvider<List<User>>((ref) {
  final repo = ref.watch(userRepositoryProvider);
  return repo.watchUsers();
});

// --- main.dart ---
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 初始化 Isar
  final dir = await getApplicationDocumentsDirectory();
  final isar = await Isar.open([UserSchema], directory: dir.path);

  runApp(
    ProviderScope(
      overrides: [
        // ✨ 魔法在这里：想换存储？只改这一行！
        userStorageProvider.overrideWithValue(IsarUserStorage(isar)),
        // 想用 Hive？ → userStorageProvider.overrideWithValue(HiveUserStorage())
        // 跑测试？  → userStorageProvider.overrideWithValue(InMemoryUserStorage())
      ],
      child: const MyApp(),
    ),
  );
}
```

### 2.3 UI 层：优雅消费数据

```dart
// 在任何页面中
class UserListPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(usersStreamProvider);

    return usersAsync.when(
      loading: () => const CircularProgressIndicator(),
      error: (err, stack) => Text('出错了: $err'),
      data: (users) => ListView.builder(
        itemCount: users.length,
        itemBuilder: (context, index) => ListTile(
          title: Text(users[index].name),
          subtitle: Text('年龄: ${users[index].age}'),
        ),
      ),
    );
  }
}
```

> **🎉 整个数据流是这样的**：
>
> `UI 订阅 Stream` → `Repository 立刻推送本地缓存` → `UI 秒开显示` → `Repository 后台请求 API` → `API 数据写入 LocalStorage` → `Stream 自动推送新数据` → `UI 无感刷新`
>
> 用户感知：**打开 App 的瞬间就看到了数据，而且过一会儿自动变成了最新的**。这就是微信、抖音的体验秘密🥷。

---

## 3. 方案速查对比表 📊

| 特性                | SharedPreferences |     Isar      |   sqflite    |   Hive    |
| ------------------- | :---------------: | :-----------: | :----------: | :-------: |
| **数据类型**        |      简单 KV      |  强类型对象   |    SQL 表    | KV / 对象 |
| **查询能力**        |        无         | 强 (代码生成) |   SQL 语句   |    弱     |
| **性能**            |       一般        |    ⚡ 极快    |      快      |    快     |
| **类型安全**        |        ❌         |      ✅       |      ❌      |   部分    |
| **响应式 (Stream)** |        ❌         |      ✅       |      ❌      |    ✅     |
| **加密支持**        |        ❌         |      ✅       |      ❌      |    ✅     |
| **Web 支持**        |        ✅         |      ✅       |      ❌      |    ✅     |
| **适用场景**        |   用户设置/开关   |  主业务数据   | 遗留项目迁移 | 轻量缓存  |

> **💡 选型建议**：不管最终选什么，都套上我们第 1 节的**抽象层**。这样即使 Isar 哪天停止维护了，你也能在一天之内平滑迁移到 `drift`（SQLite 的强类型封装）或其他方案，业务代码一行不改！

---

## Day 13 总结 📝

- **存储抽象层是护城河**：定义 `abstract class LocalStorage<T>`，所有业务代码只面向接口。想换底层存储？改一行依赖注入的代码就行。
- **Repository 是协调员**：它不关心数据是从哪来的（网络还是本地），它只负责制定策略——先本地、后网络、自动同步。
- **Riverpod 是粘合剂**：通过 `overrideWithValue`，你可以在 `main.dart` 的一行代码里决定整个 App 用什么存储引擎。
- **Offline First 四字真言：先本地、后网络**。本地存储不仅仅是为了记住用户的选择，更是网络请求的一层防弹衣。
- **永远为测试留后路**：`InMemoryStorage` 实现让你的单元测试脱离真实数据库，跑得飞快。

这就是 Day 13 的内容！有了存储抽象层 + Repository + Riverpod 三件套，你的 Flutter 数据层架构已经和大厂没什么区别了。前端在涉及 IndexDB 时往往需要写复杂的游标回调，而我们用 Dart 的抽象层设计，做起复杂查询来如同用后端 ORM 一样酣畅淋漓——而且随时可以换引擎🏎️。
