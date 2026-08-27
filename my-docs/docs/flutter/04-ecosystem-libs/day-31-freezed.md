# 前端转 Flutter 笔记 (Day 31)：Freezed 代码生成 — 告别手写样板代码 🧊

> **前言**：
> 前端开发中，我们经常手写 Model 类：接口返回的 JSON 手动映射到 TS 类型，`lodash.cloneDeep` 做深拷贝，自己写 `isEqual()` 做对象比较……
> 在 Dart/Flutter 里，同样的痛点存在且更严重 —— 因为 Dart 的类默认是**引用比较**，手写一个完整的 Model 需要覆盖 `==`、`hashCode`、`toString`、`copyWith`、JSON 序列化反序列化等一堆模板代码。
> 今天介绍的 `freezed` + `json_serializable`，是 Flutter 社区公认的「终极 Model 代码生成」方案。

---

## 1. 为什么需要代码生成？

先看一个纯手写的 Model 到底有多累：

```dart
// ❌ 纯手写的 PostItem 类 — 40+ 行模板代码
class PostItem {
  final int id;
  final String title;
  final String body;
  final int userId;

  PostItem({required this.id, required this.title, required this.body, required this.userId});

  // 要支持 JSON 序列化？手写 fromJson / toJson
  factory PostItem.fromJson(Map<String, dynamic> json) => PostItem(
    id: json['id'], title: json['title'], body: json['body'], userId: json['user_id'],
  );
  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'body': body, 'user_id': userId};

  // 要做值比较？手写 == 和 hashCode
  @override
  bool operator ==(Object other) =>
    identical(this, other) || other is PostItem && id == other.id && title == other.title;
  @override
  int get hashCode => id.hashCode ^ title.hashCode;

  // 还要 copyWith? 再来一个……
  PostItem copyWith({int? id, String? title, String? body, int? userId}) =>
    PostItem(id: id ?? this.id, title: title ?? this.title, body: body ?? this.body, userId: userId ?? this.userId);

  // toString? 再来……
  @override
  String toString() => 'PostItem(id: $id, title: $title)';
}
```

**仅仅是一个 4 字段的 Model，就写了 30 多行模板代码。** 而实际业务中一个项目动辄几十个 Model。

### 用 Freezed 改造后？

```dart
// ✅ Freezed 版 — 总共只需要写这些！
@freezed
class PostItemFreezed with _$PostItemFreezed {
  const factory PostItemFreezed({
    required int id,
    required String title,
    required String body,
    @JsonKey(name: 'user_id') required int userId,
  }) = _PostItemFreezed;

  factory PostItemFreezed.fromJson(Map<String, dynamic> json) =>
      _$PostItemFreezedFromJson(json);
}
```

10 行搞定，`copyWith`、`==`、`hashCode`、`toString`、`toJson`、`fromJson` 全部自动生成！

| 对比项 | 手写 | Freezed |
|---|---|---|
| 代码量 | 30+ 行 | ~10 行 |
| copyWith | 手写 | ✅ 自动生成 |
| == / hashCode | 手写 | ✅ 自动生成 |
| toJson / fromJson | 手写 | ✅ 自动生成 |
| 字段级不可变 | 需约定 | ✅ 编译时保证 |
| Union Types | 不支持 | ✅ 原生支持 |

> 前端类比：这就像是用了 TypeScript 的 `type` + `zod` 自动推导验证，而不是手写 `interface` + 手写验证逻辑。

---

## 2. 安装与配置

### 依赖安装

```yaml
# pubspec.yaml
dependencies:
  freezed_annotation: ^3.0.0   # 运行时注解 (体积极小)
  json_annotation: ^4.9.0      # JSON 序列化注解

dev_dependencies:
  build_runner: ^2.4.13         # 代码生成引擎
  freezed: ^3.0.6               # Freezed 代码生成器
  json_serializable: ^6.9.4     # JSON 代码生成器
```

### 使用步骤

1. 写好带 `@freezed` 注解的 Model 类
2. 运行代码生成命令：

```bash
dart run build_runner build --delete-conflicting-outputs
```

3. 自动生成 `.freezed.dart` 和 `.g.dart` 文件 —— 这些文件不需要手动编辑，也应该纳入版本控制。

---

## 3. 常用注解速查

### @freezed — 核心注解

标记在 class 上，声明这是一个 Freezed 数据类：

```dart
@freezed
class UserProfile with _$UserProfile {
  const factory UserProfile({
    required String id,
    @JsonKey(name: 'nick_name') required String nickname,
    @Default('') String bio,                    // 默认值
    @Default(0) int followersCount,
    @Default(0) int followingCount,
    @Default(false) bool isVerified,
    DateTime? createdAt,                        // 可选字段
  }) = _UserProfile;

  factory UserProfile.fromJson(Map<String, dynamic> json) =>
      _$UserProfileFromJson(json);
}
```

### 注解说明

| 注解 | 说明 | 前端类比 |
|---|---|---|
| `@freezed` | 标记为 Freezed 数据类 | `type` 声明 |
| `@JsonKey(name: 'xxx')` | JSON 字段名映射 | TS 配合 class-transformer 的 `@Expose()` |
| `@Default(value)` | 字段默认值 | TS `interface` 中的 `field?: type` |
| `required` | 必填字段 | TS 中无 `?` 的字段 |
| `DateTime?` | 可空字段 | TS 中 `field?: Date` |

---

## 4. 杀手锏：Union Types（联合类型）

这是 Freezed 最吸引人的功能之一 —— 用单个 class 定义多种"变体"，类似于 TypeScript 的 **受控联合类型 (Discriminated Union)**。

### 典型场景：异步请求状态

```dart
// 定义：一个 DataResult 可以是 loading / success / error 三种状态之一
@freezed
sealed class DataResult<T> with _$DataResult<T> {
  const factory DataResult.loading() = DataLoading<T>;
  const factory DataResult.success(T data) = DataSuccess<T>;
  const factory DataResult.error(String message, {int? code}) = DataError<T>;
}
```

### 使用：用 when 进行模式匹配

```dart
Widget buildContent(DataResult<List<Post>> result) {
  return result.when(
    loading: () => const CircularProgressIndicator(),
    success: (data) => ListView.builder(
      itemCount: data.length,
      itemBuilder: (_, i) => ListTile(title: Text(data[i].title)),
    ),
    error: (message, code) => Text('出错了: $message ($code)'),
  );
}
```

> **前端类比**：这等价于 TypeScript 的 discriminated union：
> ```typescript
> type DataResult<T> =
>   | { type: 'loading' }
>   | { type: 'success'; data: T }
>   | { type: 'error'; message: string; code?: number };
> ```
> 不同的是 Freezed 带编译期穷尽检查，漏写一种分支直接报错！

---

## 5. copyWith 深度体验

`copyWith` 是 Freezed 生成的一个极其好用的不可变更新方法：

```dart
final original = UserProfile(id: '001', nickname: '小明', bio: '前端工程师');

// 只修改 nickname，其他字段保持不变
final updated = original.copyWith(nickname: '大明');

print(original.nickname); // 小明 — 原始对象不受影响！
print(updated.nickname);  // 大明

// 值相等性
print(original == updated); // false — 因为 nickname 不同
final copy = original.copyWith(); // 完全拷贝
print(original == copy); // true — 所有字段一致
```

> 前端类比：`{ ...original, nickname: '大明' }` — 展开运算符的功能，但更安全（有类型检查）。

---

## 6. Demo 在哪看

已经写好了一个交互式演示页面：`lib/pages/freezed_demo/freezed_demo_page.dart`

入口在：**我的 → 开发者工具 → Freezed 代码生成**

在这个页面中你可以体验：

1. **copyWith 不可变更新** — 修改用户资料，直观看到原始对象不受影响
2. **值相等性比较 (==)** — 两个不同引用但字段相同的对象进行比较
3. **toJson / fromJson** — 看到 Freezed 自动序列化出的完整 JSON
4. **Union Types 模式匹配** — 切换 loading / success / error 三种状态查看 UI 响应

---

## Day 31 小结 📝

- `freezed` + `json_serializable` 是 Flutter Model 层的「必选基建」，彻底消灭手写样板代码。
- **核心价值**：不可变性保证 → `copyWith` 安全更新 → `==` 值比较 → 自动 JSON 序列化 → Union Types 状态管理。
- 使用后记得运行 `dart run build_runner build --delete-conflicting-outputs` 生成代码。
- Union Types + `when` 模式匹配是构建健壮异步 UI 的利器，编译期穷尽检查杜绝遗漏分支。

> 📖 下篇预告：**Day 32: Retrofit 声明式 API 请求**——手写 `dio.get()` 的日子到头了！像写接口定义一样写网络请求。
