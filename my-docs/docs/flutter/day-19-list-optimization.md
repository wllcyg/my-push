# 前端转 Flutter 笔记 (Day 19 上)：列表性能优化——下拉刷新 + 上拉加载 + 分页 📜

> **前言**：
> 在前端中，我们对"虚拟列表"（`react-window`、`vue-virtual-scroller`）并不陌生。当列表数据量大时，如果一次性渲染所有 DOM 节点，页面会严重卡顿。所以我们用虚拟滚动只渲染可视区域内的元素。
>
> Flutter 中同样面临这个问题，但好消息是——**Flutter 的 `ListView.builder` 原生就是"虚拟列表"**，按需构建可见区域的 Widget。今天我们来系统学习列表分页加载的完整方案。

---

## 1. ListView 三兄弟：何时用哪个？ 🤺

| 类型                 | 前端类比                   | 构建策略               | 适用场景           |
| -------------------- | -------------------------- | ---------------------- | ------------------ |
| `ListView(children)` | `Array.map()` 直接渲染     | 一次性构建**所有**子项 | 短列表（< 20 项）  |
| `ListView.builder`   | `react-window` 虚拟列表    | **按需**构建可见区域   | 长列表（推荐）     |
| `ListView.separated` | `Array.flatMap()` + 分隔符 | 按需构建 + 自动分隔符  | 需要分隔线的长列表 |

### 1.1 `ListView(children)` — 适合短列表

```dart
ListView(
  // ⚠️ 所有 Widget 在初次渲染时全部创建
  children: items.map((item) => ListTile(title: Text(item.name))).toList(),
)
```

> **💡 何时用**：子项 ≤ 15 个，比如设置页面的选项列表。

### 1.2 `ListView.builder` — 长列表首选 🚀

```dart
ListView.builder(
  // ✅ 只构建屏幕可见范围内的 Widget，滑出屏幕的自动回收
  itemCount: 10000,          // 即使有 1 万条也不卡
  itemExtent: 72.0,          // 🔥 固定高度优化
  itemBuilder: (context, index) {
    return ListTile(
      leading: CircleAvatar(child: Text('${index + 1}')),
      title: Text('Item #${index + 1}'),
    );
  },
)
```

### 1.3 `ListView.separated` — 自带分隔线

```dart
ListView.separated(
  itemCount: items.length,
  itemBuilder: (context, index) => ListTile(title: Text(items[index])),
  // 在每两个 item 之间自动调用
  separatorBuilder: (context, index) => const Divider(height: 1),
)
```

---

## 2. 下拉刷新——RefreshIndicator 📥

前端用 `pull-to-refresh` 组件，Flutter 原生提供 `RefreshIndicator`：

```dart
RefreshIndicator(
  // 🔄 返回 Future，完成后自动收起动画
  onRefresh: () async {
    await ref.read(pagedPostsProvider.notifier).refresh();
  },
  color: Colors.blue,

  child: ListView.builder(
    // ✅ 关键：确保列表始终可滚动，否则下拉手势无法触发
    physics: const AlwaysScrollableScrollPhysics(),
    itemCount: items.length,
    itemBuilder: (context, index) => ItemCard(item: items[index]),
  ),
)
```

> **⚠️ 避坑**：列表不满屏时，默认 `physics` 不允许过度滚动，下拉刷新无法触发。务必加 `AlwaysScrollableScrollPhysics()`。

---

## 3. 上拉加载更多——ScrollController 📤

前端用 `IntersectionObserver` 监听是否滚到底。Flutter 用 `ScrollController`：

```dart
class PaginatedList extends HookConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scrollController = useScrollController();

    // 🪝 useEffect 注册/注销监听器（对标 React useEffect）
    useEffect(() {
      void onScroll() {
        // 距离底部 200px 时触发加载
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          ref.read(pagedPostsProvider.notifier).loadMore();
        }
      }
      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [scrollController]);

    return ListView.builder(
      controller: scrollController,
      // ...
    );
  }
}
```

---

## 4. 分页数据模型——PagedState\<T\> 📊

和前端 React Query 的 `useInfiniteQuery` 类似，我们封装一个通用分页状态：

```dart
class PagedState<T> {
  final List<T> items;        // 已加载的所有数据
  final int page;             // 当前页码
  final bool hasMore;         // 是否还有更多
  final bool isLoadingMore;   // 是否正在加载下一页

  const PagedState({
    required this.items,
    required this.page,
    required this.hasMore,
    this.isLoadingMore = false,
  });

  /// 不可变更新（对标前端展开运算符 { ...state, page: newPage }）
  PagedState<T> copyWith({ ... }) => PagedState(...);
}
```

> **前端对标**：`items` = `data.pages.flat()`、`hasMore` = `hasNextPage`、`isLoadingMore` = `isFetchingNextPage`。

---

## 5. Riverpod + 分页整合 🏗️

核心：用 `AsyncNotifier` 管理分页数据的完整生命周期。

```dart
@riverpod
class PagedPosts extends _$PagedPosts {
  static const _pageSize = 20;

  @override
  Future<PagedState<PostItem>> build() async {
    // 初始化加载第一页
    final items = await _repo.fetchPosts(page: 1, pageSize: _pageSize);
    return PagedState(items: items, page: 1, hasMore: items.length >= _pageSize);
  }

  /// 下拉刷新：重置到第一页
  Future<void> refresh() async {
    final items = await _repo.fetchPosts(page: 1, pageSize: _pageSize);
    state = AsyncData(PagedState(
      items: items, page: 1, hasMore: items.length >= _pageSize,
    ));
  }

  /// 上拉加载：追加下一页
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || current.isLoadingMore || !current.hasMore) return;

    // 先标记加载中（UI 显示底部 loading）
    state = AsyncData(current.copyWith(isLoadingMore: true));

    try {
      final nextPage = current.page + 1;
      final newItems = await _repo.fetchPosts(page: nextPage, pageSize: _pageSize);
      state = AsyncData(current.copyWith(
        items: [...current.items, ...newItems],
        page: nextPage,
        hasMore: newItems.length >= _pageSize,
        isLoadingMore: false,
      ));
    } catch (e) {
      state = AsyncData(current.copyWith(isLoadingMore: false));
    }
  }
}
```

### 数据流

```
用户下拉 ──→ refresh() ──→ 重置 page=1，替换 items
滚到底部 ──→ loadMore() ──→ page+1，追加 items
初次进入 ──→ build()    ──→ 加载第一页
```

> **💡 关键设计**：`isLoadingMore` + `hasMore` 双重防抖，避免快速滚动时重复请求。

---

## 6. 避坑指南 ⚠️

### ❌ 长列表用 `ListView(children)`

```dart
// ❌ 1000 个 Widget 一次性全部创建，内存爆炸
ListView(children: List.generate(1000, (i) => HeavyCard(index: i)))

// ✅ 用 builder，只创建可见的那几个
ListView.builder(itemCount: 1000, itemBuilder: (_, i) => HeavyCard(index: i))
```

### ❌ 忘记 `AlwaysScrollableScrollPhysics`

列表不满屏时下拉刷新无响应，加上 `physics: const AlwaysScrollableScrollPhysics()` 即可。

### ❌ 上拉加载不做防抖

```dart
// ❌ 快速滚动触发多次并发请求
// ✅ 在 Provider 中用 isLoadingMore 标志防抖
if (currentState.isLoadingMore || !currentState.hasMore) return;
```

---

## Day 19 上篇总结 📝

- **`ListView.builder` 是默认选择**，除非列表极短（< 15 个）。
- **下拉刷新**用 `RefreshIndicator`，记得加 `AlwaysScrollableScrollPhysics()`。
- **上拉加载**用 `ScrollController` + `useEffect` 监听滚动位置。
- **`PagedState<T>`** 封装 `items / page / hasMore / isLoadingMore` 四字段，所有分页场景复用。
- **Riverpod `AsyncNotifier`** 三个方法搞定分页：`build()` 初始化、`refresh()` 重置、`loadMore()` 追加。

> 📖 下篇预告：**Sliver 组合布局 + 性能优化清单**——学习 SliverAppBar、SliverList、SliverGrid 的组合技巧，以及 const / itemExtent / AutomaticKeepAlive 等优化手段。
