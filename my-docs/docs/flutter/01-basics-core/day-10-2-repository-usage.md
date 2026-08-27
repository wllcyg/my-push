# 前端转 Flutter 笔记 (Day 10.2)：实战 - 用 Repository + HttpClient 写一个完整功能 🚀

> **摘要**：前面讲了 Repository 模式和 HttpClient 封装，但都是分开讲的。
> 这篇短文把它们串起来，从头到尾写一个完整的"获取用户列表"功能。

## 目标 🎯

实现一个用户列表页面，数据从 REST API 获取。

---

## Step 1: 定义 Model

```dart
// lib/models/user.dart
class User {
  final String id;
  final String name;
  final String email;

  User({required this.id, required this.name, required this.email});

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
    );
  }
}
```

---

## Step 2: 定义 Repository 接口

```dart
// lib/repositories/user_repository.dart
abstract class UserRepository {
  Future<List<User>> getUsers();
}
```

---

## Step 3: 实现 Repository (调用 HttpClient)

```dart
// lib/repositories/impl/rest_user_repository.dart
import 'package:my_flutter_app/net/http_client.dart';
import 'package:my_flutter_app/net/api_response.dart';

class RestUserRepository implements UserRepository {
  final _dio = HttpClient().dio;

  @override
  Future<List<User>> getUsers() async {
    final response = await _dio.get('/users');

    final result = ApiResponse.fromJson(
      response.data,
      (data) => (data as List).map((e) => User.fromJson(e)).toList(),
    );

    if (result.isSuccess) {
      return result.data ?? [];
    }
    throw Exception(result.message);
  }
}
```

---

## Step 4: 注册 Provider

```dart
// lib/providers/repository_providers.dart
@riverpod
UserRepository userRepository(UserRepositoryRef ref) {
  return RestUserRepository();
}

@riverpod
Future<List<User>> userList(UserListRef ref) async {
  final repo = ref.watch(userRepositoryProvider);
  return repo.getUsers();
}
```

---

## Step 5: UI 使用

```dart
// lib/pages/user_list_page.dart
class UserListPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usersAsync = ref.watch(userListProvider);

    return Scaffold(
      appBar: AppBar(title: Text('用户列表')),
      body: usersAsync.when(
        loading: () => Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('加载失败: $err')),
        data: (users) => ListView.builder(
          itemCount: users.length,
          itemBuilder: (_, index) {
            final user = users[index];
            return ListTile(
              title: Text(user.name),
              subtitle: Text(user.email),
            );
          },
        ),
      ),
    );
  }
}
```

---

## 完整调用链 🔗

```
UserListPage (UI)
      │
      │ ref.watch(userListProvider)
      ▼
userListProvider (ViewModel)
      │
      │ ref.watch(userRepositoryProvider)
      ▼
RestUserRepository (Repository)
      │
      │ HttpClient().dio.get('/users')
      ▼
Dio + Interceptors (Network)
      │
      │ HTTP Request
      ▼
Backend API → JSON Response
```

---

## 关键点 ✅

1. **Model**: 只管数据结构和 JSON 解析
2. **Repository 接口**: 只定义"能做什么"，不关心怎么做
3. **Repository 实现**: 调用 HttpClient，处理响应格式
4. **Provider**: 把 Repository 注入系统，管理状态
5. **UI**: 只管渲染，用 `.when()` 处理加载/错误/成功三种状态

---

## 为什么这么写？🤔

以后如果要：

- **换成 GraphQL**：只需新建 `GraphQLUserRepository`，改一行注入代码
- **加本地缓存**：在 Repository 实现里加，UI 和 Provider 不用动
- **写单元测试**：Mock 一个 `FakeUserRepository`，不需要真网络请求

**一句话总结**：越往上层，知道的越少越好。UI 不知道数据从哪来，Repository 不知道数据怎么展示。
