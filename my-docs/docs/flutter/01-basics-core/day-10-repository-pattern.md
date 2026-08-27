# 前端转 Flutter 笔记 (Day 10)：架构升级 - Repository 模式与依赖注入 🏗️

> **摘要**：Day 10，今天不写界面，来一次重要的**架构重构**。
> 引入 **Repository Pattern (仓库模式)** 和 **Dependency Injection (依赖注入)**，把代码从"能跑就行"升级到"企业级架构"。
> 用你熟悉的 TypeScript 概念做对比，看看 Dart 是怎么实现的。

## 1. 为什么要改？🤔

### 现状 (Anti-Pattern)

目前的 `DiaryList` Provider 直接在内部调用 `Supabase`：

```dart
// lib/providers/diary_provider.dart
@riverpod
class DiaryList extends _$DiaryList {
  Future<List> build() async {
    // ❌ 直接依赖：代码被"锁死"在 Supabase 上了
    return Supabase.instance.client.from('diary').select();
  }
}
```

**[TS 对比]** 这就像在 Pinia Store 或组件里直接写 `axios.get('http://api.com/list')`。

- **坏处 1**: 后端换了接口，要改所有 Store。
- **坏处 2**: 没法写单元测试，没法 Mock 网络请求。

### 目标 (Repository Pattern)

中间加一层"代理"，ViewModel 只管要数据，不管数据从哪来。

**[TS 对比]** 就像在项目中建立 `src/api/diary.ts` 或 `src/services/DiaryService.ts`。

---

## 2. 核心概念对比 🗂️

| 概念                     | Flutter (Riverpod)                               | TypeScript (Vue/React)                          | 作用                                        |
| :----------------------- | :----------------------------------------------- | :---------------------------------------------- | :------------------------------------------ |
| **Interface**            | `abstract class DiaryRepository`                 | `interface DiaryRepository`                     | 定义标准：规定有哪些方法 (增删改查)         |
| **Implementation**       | `class SupabaseDiaryRepository`                  | `class DiaryService implements DiaryRepository` | 具体实现：真正干活的代码 (Axios / Supabase) |
| **Dependency Injection** | `@riverpod DiaryRepository diaryRepository(...)` | `provide('diaryRepo', new DiaryService())`      | 注入：决定给组件用哪个实现                  |
| **Usage**                | `ref.watch(diaryRepositoryProvider)`             | `inject('diaryRepo')`                           | 使用：组件/Store 拿到实例调用方法           |

---

## 3. 代码实战 💻

### 第一步：定义接口 (Interface)

**文件**: `lib/repositories/diary_repository.dart`

这是我们的"合同"。

```dart
import 'package:my_flutter_app/models/diary_entry.dart';

abstract class DiaryRepository {
  Future<List<DiaryEntry>> getDiaries();
  Future<void> addDiary(DiaryEntry entry);
  Future<void> deleteDiary(String id);
}
```

**[TS 对比]**：

```typescript
// src/types/repository.d.ts
export interface DiaryRepository {
  getDiaries(): Promise<DiaryEntry[]>;
  addDiary(entry: DiaryEntry): Promise<void>;
  deleteDiary(id: string): Promise<void>;
}
```

> 💡 Dart 没有 `interface` 关键字，用 `abstract class` 代替。效果一样，都是定义方法签名。

---

### 第二步：具体实现 (Implementation)

**文件**: `lib/repositories/impl/supabase_diary_repository.dart`

这是"打工仔"，负责脏活累活。

```dart
class SupabaseDiaryRepository implements DiaryRepository {
  final SupabaseClient _client;
  SupabaseDiaryRepository(this._client);

  @override
  Future<List<DiaryEntry>> getDiaries() async {
    final data = await _client.from('diary_entries').select();
    return (data as List).map((e) => DiaryEntry.fromJson(e)).toList();
  }
  // ... 其他方法实现
}
```

**[TS 对比]**：

```typescript
// src/services/SupabaseDiaryRepo.ts
class SupabaseDiaryRepo implements DiaryRepository {
  async getDiaries() {
    const { data } = await supabase.from("diary_entries").select();
    return data;
  }
}
```

---

### 第三步：依赖注入 (Dependency Injection)

**文件**: `lib/providers/repository_providers.dart`

**这是最关键的一步！** 在这里把"实现"注入进系统。

```dart
@riverpod
DiaryRepository diaryRepository(DiaryRepositoryRef ref) {
  // 🏭 工厂模式：这里决定了返回哪个实现类
  // 如果以后要换成 Rest API，只需要改这一行！
  return SupabaseDiaryRepository(Supabase.instance.client);
}
```

**[TS 对比]**：

前端项目中通常更简单，直接 `export` 一个实例：

```typescript
// src/services/index.ts
export const diaryRepository = new SupabaseDiaryRepo();

// 如果以后要换实现，改这一行就行
// export const diaryRepository = new RestApiDiaryRepo();
```

> 💡 Vue 的 `provide/inject` 也能实现类似效果，但实际项目中直接 import 更常见。Riverpod 的 Provider 本质上就是帮你管理这个"全局实例"。

---

### 第四步：在 ViewModel 中使用

**文件**: `lib/providers/diary_provider.dart`

现在，`DiaryList` 变得非常干净。

```dart
@riverpod
class DiaryList extends _$DiaryList {
  @override
  Future<List<DiaryEntry>> build() async {
    // 🪄 找容器要一个 Repository
    // 注意：拿到的是接口类型，根本不知道它是 Supabase 做的
    final repository = ref.watch(diaryRepositoryProvider);

    return repository.getDiaries();
  }
}
```

**[TS 对比]**：

在 Pinia Store 中直接 import 使用：

```typescript
// src/stores/diary.ts
import { diaryRepository } from "@/services";

export const useDiaryStore = defineStore("diary", () => {
  async function fetchDiaries() {
    return await diaryRepository.getDiaries();
  }
  return { fetchDiaries };
});
```

---

## 4. 关于 `@riverpod` 注解 📝

你可能注意到 `diaryRepository` 的定义方式很特别：

```dart
@riverpod
DiaryRepository diaryRepository(DiaryRepositoryRef ref) { ... }
```

这在 Dart 中叫 **Annotation (注解)**，配合 `riverpod_generator` 使用。

**它的作用**：

- 是**编译时**代码生成，不像 Python/Java 装饰器是运行时
- 自动生成一个 `diaryRepositoryProvider` 对象

**[TS 对比]**：

有点像 Vue 3 的 `<script setup>` 宏（Macro）：

```vue
<script setup>
defineProps({ ... })
</script>
```

编译器把它转换成标准的 `export default { props: ... }`。
Riverpod Generator 也是做同样的事：把简单函数编译成复杂的 Provider 类，减少样板代码。

---

## Day 10 总结 ✅

今天做的事情：

1. **定义 Interface**：`abstract class` 作为接口约束
2. **具体实现**：`SupabaseDiaryRepository` 负责实际的网络请求
3. **依赖注入**：通过 Riverpod Provider 把实现注入系统
4. **解耦使用**：ViewModel 只依赖接口，不依赖具体实现

这样做的好处：

- 换后端服务只需改一行代码
- 可以轻松 Mock 测试
- 代码职责清晰，维护方便

**明日预告**：
后续会继续深入网络层架构，把 Repository 模式应用到整个项目中！
