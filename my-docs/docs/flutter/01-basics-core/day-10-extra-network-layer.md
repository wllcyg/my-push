# 前端转 Flutter 笔记 (Day 10 番外)：网络层封装 - Dio 实战 🌐

> **摘要**：Day 10 番外，分析项目中 Dio 的封装实现。
> 作为前端开发者，我们习惯了 Axios 的拦截器、统一错误处理。
> 今天看看 Flutter 中怎么用 Dio 实现同样的效果。

## 1. Dio vs Axios 对比 🗺️

| Axios (前端)                     | Dio (Flutter)                 | 说明       |
| :------------------------------- | :---------------------------- | :--------- |
| `axios.create({ baseURL })`      | `Dio(BaseOptions(baseUrl: ))` | 创建实例   |
| `instance.interceptors.request`  | `dio.interceptors.add()`      | 请求拦截器 |
| `instance.interceptors.response` | `Interceptor.onResponse`      | 响应拦截器 |
| `timeout: 5000`                  | `connectTimeout: Duration()`  | 超时配置   |
| `axios.get()` / `axios.post()`   | `dio.get()` / `dio.post()`    | 请求方法   |

---

## 2. 项目中的封装分析 📦

### 2.1 单例模式 HttpClient

```dart
// lib/net/http_client.dart
class HttpClient {
  // 单例模式
  static final HttpClient _instance = HttpClient._internal();
  factory HttpClient() => _instance;

  late final Dio dio;

  HttpClient._internal() {
    dio = Dio(BaseOptions(
      baseUrl: 'https://your-api.com/api/v1',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));
    // ... 添加拦截器
  }
}
```

**[TS 对比]**：

```typescript
// src/utils/request.ts
const instance = axios.create({
  baseURL: "https://your-api.com/api/v1",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

export default instance;
```

> 💡 Dart 用 `factory` 构造函数 + 私有 `_internal` 实现单例，效果和 TS 的模块单例一样。

---

### 2.2 Token 拦截器

```dart
class _AuthInterceptor extends Interceptor {
  final _storage = const FlutterSecureStorage();

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // 从安全存储读取 Token
    final token = await _storage.read(key: 'access_token');
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);  // 继续请求
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token 过期处理
      debugPrint('Token expired, should redirect to login');
    }
    handler.next(err);  // 继续错误处理
  }
}
```

**[TS 对比]**：

```typescript
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期处理
      router.push("/login");
    }
    return Promise.reject(error);
  },
);
```

**关键区别**：

- Dio 用 `handler.next()` 继续流程，Axios 用 `return` 或 `Promise.reject()`
- Flutter 用 `FlutterSecureStorage` 安全存储，前端用 `localStorage`

---

### 2.3 统一响应格式

```dart
// lib/net/api_response.dart
class ApiResponse<T> {
  final int code;
  final String message;
  final T? data;

  bool get isSuccess => code == 0;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) fromJsonT,
  ) {
    return ApiResponse(
      code: json['code'] as int? ?? -1,
      message: json['msg'] as String? ?? 'Unknown error',
      data: json['data'] != null ? fromJsonT(json['data']) : null,
    );
  }
}
```

**[TS 对比]**：

```typescript
// src/types/api.d.ts
interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T | null;
}

// src/utils/request.ts
instance.interceptors.response.use((response) => {
  const { code, msg, data } = response.data;
  if (code !== 0) {
    ElMessage.error(msg);
    return Promise.reject(new Error(msg));
  }
  return data; // 直接返回 data
});
```

---

## 3. 完整使用示例 💻

### Repository 中调用

```dart
class RestApiDiaryRepository implements DiaryRepository {
  final Dio _dio = HttpClient().dio;

  @override
  Future<List<DiaryEntry>> getDiaries() async {
    final response = await _dio.get('/diaries');

    final apiResponse = ApiResponse.fromJson(
      response.data,
      (data) => (data as List).map((e) => DiaryEntry.fromJson(e)).toList(),
    );

    if (apiResponse.isSuccess) {
      return apiResponse.data ?? [];
    } else {
      throw Exception(apiResponse.message);
    }
  }
}
```

**[TS 对比]**：

```typescript
// src/api/diary.ts
export async function getDiaries(): Promise<DiaryEntry[]> {
  const data = await request.get<DiaryEntry[]>("/diaries");
  return data;
}
```

---

## 4. 常见扩展 🛠️

### 4.1 添加 Loading 拦截器

```dart
class LoadingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // 显示 Loading
    EasyLoading.show();
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    EasyLoading.dismiss();
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    EasyLoading.dismiss();
    handler.next(err);
  }
}
```

### 4.2 重试拦截器

```dart
class RetryInterceptor extends Interceptor {
  final int maxRetries;
  RetryInterceptor({this.maxRetries = 3});

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final retryCount = err.requestOptions.extra['retryCount'] ?? 0;

    if (retryCount < maxRetries && _shouldRetry(err)) {
      err.requestOptions.extra['retryCount'] = retryCount + 1;
      await Future.delayed(Duration(seconds: retryCount + 1));

      try {
        final response = await HttpClient().dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } catch (e) {
        // 继续重试流程
      }
    }
    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
           err.type == DioExceptionType.receiveTimeout;
  }
}
```

---

## 5. 架构总览 📐

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer                         │
│                  (Widget / Page)                    │
└────────────────────────┬────────────────────────────┘
                         │ ref.watch()
┌────────────────────────▼────────────────────────────┐
│                ViewModel Layer                       │
│              (Riverpod Provider)                     │
└────────────────────────┬────────────────────────────┘
                         │ repository.getDiaries()
┌────────────────────────▼────────────────────────────┐
│              Repository Layer                        │
│    ┌─────────────────────────────────────────┐      │
│    │       DiaryRepository (Interface)       │      │
│    └─────────────────────────────────────────┘      │
│                    ▲                                 │
│        ┌───────────┼───────────┐                    │
│        │           │           │                    │
│   Supabase      RestApi      Mock                   │
│   Impl          Impl         Impl                   │
└────────────────────────┬────────────────────────────┘
                         │ HttpClient().dio.get()
┌────────────────────────▼────────────────────────────┐
│                Network Layer                         │
│  ┌────────────────────────────────────────────────┐ │
│  │  HttpClient (Dio 单例)                         │ │
│  │  ├── BaseOptions (baseUrl, timeout, headers)   │ │
│  │  ├── LogInterceptor (Debug 日志)               │ │
│  │  ├── AuthInterceptor (Token 注入)              │ │
│  │  └── ApiResponse (统一响应解析)                │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Day 10 番外总结 ✅

| 职责       | 前端 (Axios)         | Flutter (Dio)            |
| :--------- | :------------------- | :----------------------- |
| 创建实例   | `axios.create()`     | `Dio(BaseOptions())`     |
| 拦截器     | `interceptors.use()` | `interceptors.add()`     |
| Token 注入 | request 拦截器       | `Interceptor.onRequest`  |
| 错误处理   | response 拦截器      | `Interceptor.onError`    |
| 统一响应   | 拦截器中解包         | `ApiResponse.fromJson()` |

**核心心法**：

1. Dio 的拦截器机制和 Axios 几乎一样，上手成本很低
2. 用 `handler.next()` 代替 `return`，用 `handler.reject()` 代替 `throw`
3. 配合 Repository 模式，网络层代码可以完全和业务解耦
