# 前端转 Flutter 笔记 (Day 19 下)：Sliver 组合布局 + 性能优化清单 🧱

> **前言**：
> 上篇我们学了 ListView 的分页加载方案。但在实际项目中，很多页面不是纯列表——电商首页有 Banner + 分类 + 商品网格，个人资料页有大图头部 + 标签栏 + 动态列表。
>
> 这些"多种滚动区域混合"的布局，在前端可以用 `position: sticky` + 多个 Section 拼接。在 Flutter 中，**Sliver 系列组件**就是专门解决这个问题的。今天我们来拆解 Sliver 的组合技巧，并收录一份性能优化清单。

---

## 1. Sliver 是什么？ 🤔

Sliver（中文"薄片"）是 Flutter 滚动系统的底层协议。我们日常用的 `ListView`、`GridView` 内部都是用 Sliver 实现的。直接使用 Sliver，可以在**同一个滚动视图**中自由组合不同类型的内容。

| Sliver 组件              | 作用            | 前端类比                        |
| ------------------------ | --------------- | ------------------------------- |
| `CustomScrollView`       | Sliver 容器     | 整个滚动页面                    |
| `SliverAppBar`           | 可折叠顶部栏    | `position: sticky` 的 header    |
| `SliverList`             | 列表区域        | `ListView.builder` 的 Sliver 版 |
| `SliverGrid`             | 网格区域        | `GridView.builder` 的 Sliver 版 |
| `SliverToBoxAdapter`     | 包裹普通 Widget | 滚动流中的静态区域              |
| `SliverPersistentHeader` | 悬浮吸顶头      | `position: sticky` 分组头       |

---

## 2. SliverAppBar——可折叠头部 📱

这是 Sliver 最常用的组件，实现向上滑动时头部图片折叠、标题缩小到 AppBar 的效果：

```dart
CustomScrollView(
  slivers: [
    SliverAppBar(
      expandedHeight: 200.0,   // 展开时总高度
      floating: false,          // 向下滑时是否立即出现
      pinned: true,            // ✅ 折叠后固定在顶部
      flexibleSpace: FlexibleSpaceBar(
        title: const Text('我的主页'),
        background: Image.network(
          'https://example.com/cover.jpg',
          fit: BoxFit.cover,
        ),
      ),
    ),
    // ... 后续 Sliver 组件
  ],
)
```

> **三个模式对比**：
> | 属性 | 效果 |
> |------|------|
> | `pinned: true` | 折叠后 AppBar 始终固定在顶部 |
> | `floating: true` | 向下滑一点就立刻展开（不需要滑到顶部） |
> | `snap: true` | 配合 floating，松手自动完成展开/收起动画 |

---

## 3. SliverPersistentHeader——吸顶分组标题 📌

实现字母分组通讯录、分类标签栏等"滚到顶部就吸住"的效果：

```dart
SliverPersistentHeader(
  pinned: true,  // 滚到顶部时吸顶
  delegate: _SectionHeaderDelegate(title: '📋 文章列表'),
)
```

Delegate 实现：

```dart
class _SectionHeaderDelegate extends SliverPersistentHeaderDelegate {
  final String title;
  _SectionHeaderDelegate({required this.title});

  @override
  double get minExtent => 48.0;  // 最小高度
  @override
  double get maxExtent => 48.0;  // 最大高度（可以不同，实现伸缩效果）

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      height: 48,
      color: Colors.grey[100],
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  @override
  bool shouldRebuild(covariant _SectionHeaderDelegate old) => title != old.title;
}
```

---

## 4. 完整组合示例 🎯

一个典型的"个人主页"布局，组合所有 Sliver 组件：

```dart
CustomScrollView(
  slivers: [
    // 1️⃣ 可折叠大图头部
    SliverAppBar(
      expandedHeight: 200.0,
      pinned: true,
      flexibleSpace: FlexibleSpaceBar(
        title: const Text('个人主页'),
        background: Image.network('...', fit: BoxFit.cover),
      ),
    ),

    // 2️⃣ 普通 Widget（简介区域）
    SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text('最新动态', style: TextStyle(fontSize: 18)),
      ),
    ),

    // 3️⃣ 吸顶标题 —— "文章"
    SliverPersistentHeader(
      pinned: true,
      delegate: _SectionHeaderDelegate(title: '文章列表'),
    ),

    // 4️⃣ 文章列表
    SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => ListTile(title: Text('文章 ${index + 1}')),
        childCount: 10,
      ),
    ),

    // 5️⃣ 吸顶标题 —— "相册"
    SliverPersistentHeader(
      pinned: true,
      delegate: _SectionHeaderDelegate(title: '相册'),
    ),

    // 6️⃣ 照片网格
    SliverPadding(
      padding: const EdgeInsets.all(12),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) => Card(child: Center(child: Text('Photo $index'))),
          childCount: 6,
        ),
      ),
    ),
  ],
)
```

> **💡 使用场景**：
>
> - 个人资料页（头部大图 + 标签栏 + 动态列表）
> - 电商首页（Banner + 分类导航 + 商品网格）
> - 通讯录（字母分组吸顶）
> - 探索页（搜索栏 + 推荐 + 话题网格 + 热门列表）

---

## 5. 性能优化清单 ⚡

### 5.1 `const` 构造

```dart
// ❌ 每次 build 都创建新实例
child: Text('Hello')

// ✅ 编译期常量，跳过重建
child: const Text('Hello')
```

> **前端对标**：`React.memo` / Vue 的 `v-once`。

### 5.2 `itemExtent` 固定高度

```dart
ListView.builder(
  itemExtent: 72.0,  // ✅ 无需逐个测量，滚动性能 O(1)
  itemBuilder: (context, index) => /* ... */,
)
```

> **前端对标**：`react-window` 的 `itemSize` 参数。

### 5.3 `AutomaticKeepAliveClientMixin`

Tab 切换时默认会销毁不可见的页面。用 `KeepAlive` 保持状态：

```dart
class _MyTabState extends State<MyTab> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;  // 切走时别销毁我

  @override
  Widget build(BuildContext context) {
    super.build(context);  // 必须调用
    return ListView.builder(/* ... */);
  }
}
```

> **前端对标**：Vue 的 `<keep-alive>` 组件。

### 5.4 `RepaintBoundary`

```dart
// 隔离重绘区域，某项变化时只重绘它自己
RepaintBoundary(child: ExpensiveWidget())
```

### 5.5 汇总表

| 优化手段             | 效果                 | 前端类比                     |
| -------------------- | -------------------- | ---------------------------- |
| `const` 构造         | 跳过不变 Widget 重建 | `React.memo`                 |
| `itemExtent`         | 免测量高度           | `react-window` 的 `itemSize` |
| `ListView.builder`   | 只构建可见项         | 虚拟列表                     |
| `AutomaticKeepAlive` | Tab 切换缓存页面     | `<keep-alive>`               |
| `RepaintBoundary`    | 隔离重绘             | CSS `will-change`            |
| `Riverpod select`    | 精细化监听           | `useMemo` / `computed`       |

---

## 6. 避坑指南 ⚠️

### ❌ 在非 CustomScrollView 中用 Sliver

```dart
// ❌ 报错！Sliver 组件只能放在 CustomScrollView 的 slivers 中
Column(children: [SliverList(/* ... */)])

// ✅ 必须用 CustomScrollView 作为容器
CustomScrollView(slivers: [SliverList(/* ... */)])
```

### ❌ SliverAppBar 中出现意外返回按钮

```dart
// ❌ 在 Tab 子页面中出现多余的返回按钮
SliverAppBar(expandedHeight: 200)

// ✅ 明确关闭
SliverAppBar(automaticallyImplyLeading: false, expandedHeight: 200)
```

### ❌ 混用 Sliver 和普通 Widget

```dart
// ❌ Text 不是 Sliver，直接放会报错
CustomScrollView(slivers: [Text('Hello')])

// ✅ 用 SliverToBoxAdapter 包一层
CustomScrollView(slivers: [SliverToBoxAdapter(child: Text('Hello'))])
```

---

## Day 19 下篇总结 📝

- **Sliver** 是 Flutter 最灵活的滚动布局系统，用 `CustomScrollView` 组合多种 Sliver 组件。
- **SliverAppBar** 实现可折叠头部，`pinned` / `floating` / `snap` 控制行为模式。
- **SliverPersistentHeader** 实现分组吸顶效果，需要自定义 `Delegate`。
- **SliverList + SliverGrid** 可以在同一个滚动视图中混合列表和网格。
- **性能三板斧**：`const` 减少重建、`itemExtent` 免测量、`AutomaticKeepAlive` 保持 Tab 状态。
- 所有 Sliver 只能放在 `CustomScrollView` 中，普通 Widget 需要用 `SliverToBoxAdapter` 包裹。

> 完整 Demo 代码在项目中：**我的 → 开发者工具 → 列表优化**（Tab 3 Sliver 布局）📦
