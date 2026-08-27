# 前端转 Flutter 笔记 (Day 32)：Retrofit 声明式 API 请求 — 像写接口文档一样写网络请求 🌐

> **前言**：
> 做前端的时候，我们常用 `axios` 封装一套请求方法：`api.getUser(id)`、`api.createPost(data)` ……
> 但落地发现还是要手写 URL 拼接、手写请求参数结构、手写响应数据转换，一旦后端改了接口字段，改到崩溃。
> Dart 社区的 `retrofit` 借鉴了 Java/Android 的同名框架思想：**用注解声明接口，代码自动生成**。
> 你只需要像写 TypeScript 的 `interface` 一样定义好"请求长什么样"，剩下的所有 HTTP 细节全部由代码生成器搞定。

---

## 1. Retrofit 是什么？

Retrofit = **一个基于 `dio` 的声明式 HTTP 客户端代码生成器**。

核心理念：「写接口声明 → 自动生成实现」

### 与手写 dio 对比

```dart
// ❌ 传统手写 dio
Future<List<Post>> getPosts() async {
  final response = await dio.get('/posts', queryParameters: {'_page': 1, '_limit': 10});
  return (response.data as List).map((e) => Post.fromJson(e)).toList();
}

Future<Post> getPostById(int id) async {
  final response = await dio.get('/posts/$id');
  return Post.fromJson(response.data);
}

Future<Post> createPost(Map<String, dynamic> data) async {
  final response = await dio.post('/posts', data: data);
  return Post.fromJson(response.data);
}
```

```dart
// ✅ Retrofit 声明式 — 只写"长什么样"
@RestApi(baseUrl: 'https://jsonplaceholder.typicode.com')
abstract class ApiService {
  factory ApiService(Dio dio) = _ApiService;

  @GET('/posts')
  Future<List<PostItemFreezed>> getPosts();

  @GET('/posts/{id}')
  Future<PostItemFreezed> getPostById(@Path('id') int id);

  @POST('/posts')
  Future<PostItemFreezed> createPost(@Body() Map<String, dynamic> body);
}
```

看到区别了吗？ Retrofit 版本**没有任何实现代码**，所有 HTTP 请求逻辑由 `build_runner` 自动读取注解后生成到 `.g.dart` 文件中。

| 对比 | 手写 dio | Retrofit |
|---|---|---|
| 代码量 | 每个接口 5~10 行 | 每个接口 2~3 行（纯声明） |
| URL 管理 | 散落在各处 | 集中在注解上 |
| 类型安全 | 手动 cast | 自动类型推导 |
| 维护成本 | 改一个字段改 N 处 | 改注解，重新 build |

> 前端类比：如果说 `dio` 是 `axios`，那 Retrofit 就像是 `tRPC` 或者 `OpenAPI codegen` —— 从接口定义自动生成类型安全的请求函数。

---

## 2. 安装与配置

### 依赖

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.7.0          # HTTP 客户端
  retrofit: ^4.1.0     # Retrofit 运行时注解

dev_dependencies:
  build_runner: ^2.4.13
  retrofit_generator: ^8.2.2   # Retrofit 代码生成器 (注意与项目其他 generator 版本兼容)
```

### 使用步骤

1. 定义 API Service 类（用 `@RestApi` 和各种 HTTP 方法注解）
2. 运行代码生成：

```bash
dart run build_runner build --delete-conflicting-outputs
```

3. 在业务代码中创建实例并调用：

```dart
final dio = Dio();
final apiService = ApiService(dio);
final posts = await apiService.getPosts();
```

---

## 3. 核心注解速查

### 类级别注解

| 注解 | 说明 | 示例 |
|---|---|---|
| `@RestApi(baseUrl: '...')` | 定义 API 基础 URL | `@RestApi(baseUrl: 'https://api.example.com')` |

### 方法级别注解 — HTTP 方法

| 注解 | HTTP 方法 | 示例 |
|---|---|---|
| `@GET('/path')` | GET 请求 | `@GET('/users')` |
| `@POST('/path')` | POST 请求 | `@POST('/users')` |
| `@PUT('/path')` | PUT 请求 | `@PUT('/users/{id}')` |
| `@DELETE('/path')` | DELETE 请求 | `@DELETE('/users/{id}')` |
| `@PATCH('/path')` | PATCH 请求 | `@PATCH('/users/{id}')` |

### 参数级别注解

| 注解 | 说明 | 前端类比 |
|---|---|---|
| `@Path('id')` | URL 路径参数 | Express 路由 `:id` |
| `@Query('key')` | URL 查询参数 | `?key=value` |
| `@Body()` | 请求体 JSON | `axios.post(url, body)` 的 body |
| `@Header('key')` | 请求头 | `axios.defaults.headers` |
| `@Field('key')` | 表单字段 | `FormData` 字段 |

---

## 4. 实战：完整 CRUD 接口定义

```dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

part 'api_service.g.dart';

@RestApi(baseUrl: 'https://jsonplaceholder.typicode.com')
abstract class ApiService {
  factory ApiService(Dio dio, {String? baseUrl}) = _ApiService;

  /// 获取文章列表 (支持分页)
  @GET('/posts')
  Future<List<PostItemFreezed>> getPosts({
    @Query('_page') int page = 1,
    @Query('_limit') int limit = 10,
  });

  /// 根据 ID 获取单篇文章
  @GET('/posts/{id}')
  Future<PostItemFreezed> getPostById(@Path('id') int id);

  /// 创建文章
  @POST('/posts')
  Future<PostItemFreezed> createPost(@Body() Map<String, dynamic> body);

  /// 更新文章
  @PUT('/posts/{id}')
  Future<PostItemFreezed> updatePost(
    @Path('id') int id,
    @Body() Map<String, dynamic> body,
  );

  /// 删除文章
  @DELETE('/posts/{id}')
  Future<void> deletePost(@Path('id') int id);
}
```

上面的代码会自动生成完整的 HTTP 客户端实现，包括：
- URL 拼接与路径参数替换
- 查询参数附加
- 请求体序列化
- 响应体反序列化（配合 `freezed` / `json_serializable`）

---

## 5. 与 Dio 拦截器结合

Retrofit 底层用的就是 `dio`，所以项目中已有的拦截器（日志、Token 注入、错误处理）可以直接复用：

```dart
// 创建一个带有完整拦截器的 Dio 实例
final dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 10),
  receiveTimeout: const Duration(seconds: 10),
));

// 添加日志拦截器
dio.interceptors.add(LogInterceptor(responseBody: true));

// 添加 Token 拦截器
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) {
    options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  },
));

// 用这个 dio 实例创建 Retrofit Service — 拦截器自动生效！
final apiService = ApiService(dio);
```

> 前端类比：就像在 axios 上做了 `axios.interceptors.request.use(...)` 后，所有 API 请求方法自动带上了 Token。

---

## 6. Retrofit + Freezed：完美组合

这两者搭配使用堪称 Flutter 网络层最佳实践：

```
API 接口定义    →  Retrofit (声明式注解)    →  自动生成请求代码
       ↕
数据 Model      →  Freezed (不可变注解)     →  自动生成序列化代码
```

**一次 `build_runner build`，两套代码同时生成！**

```dart
// Retrofit 返回的就是 Freezed 生成的不可变 Model
final posts = await apiService.getPosts(page: 1, limit: 20);
// posts 的类型是 List<PostItemFreezed>
// 每个元素都有 copyWith、toJson、== 等能力
```

---

## 7. Demo 在哪看

已经写好了一个带日志面板的演示页面：`lib/pages/retrofit_demo/retrofit_demo_page.dart`

入口在：**我的 → 开发者工具 → Retrofit API**

在这个页面里你可以体验：

1. **GET 列表请求** — 调用 JSONPlaceholder API 获取文章列表
2. **GET 单条请求** — 根据 ID 获取指定文章详情
3. **POST 创建请求** — 发送 POST 请求创建新文章
4. **日志面板** — 实时查看请求和响应的完整日志

---

## Day 32 小结 📝

- **Retrofit = 声明式 HTTP 客户端**：用注解定义接口 → `build_runner` 自动生成请求实现代码。
- 核心注解：`@RestApi`（类级别）、`@GET/@POST/@PUT/@DELETE`（方法级别）、`@Path/@Query/@Body`（参数级别）。
- **底层还是 dio**：已有的拦截器（日志、Token、错误处理）完全复用，零迁移成本。
- **与 Freezed 搭配**：请求返回的 Model 直接用 Freezed 生成 → 完整的类型安全链路从接口定义延伸到 UI。
- 不建议每个页面直接 `new ApiService()`，推荐用 `Riverpod` 注册为 Provider 全局复用。

> 📖 下篇预告：**Day 33: 推送通知 (Push Notifications)**——本地推送模拟 + 远程推送架构解析，让你的 App 主动跟用户打招呼。
