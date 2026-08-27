# 前端转 Flutter 笔记 (Day 40 上)：为什么 GridView 做不了小红书？

> 最开始学 Flutter 布局的时候，我以为做一个图片瀑布流很简单——不就是 Grid 加几个参数的事吗？结果用 `GridView` 一试，发现所有卡片高度都被强制拉齐，图片要么被截断要么留一大块空白，完全做不出小红书那种参差不齐的感觉。这篇聊聊原因，以及怎么找到正确的方向。

---

## GridView 为什么做不了瀑布流

`GridView` 的底层逻辑跟 CSS 的 `display: grid` + `grid-auto-rows: 1fr` 很像——它把每一行当成一个固定高度的 slot，同一行里的所有卡片共享这个高度，内容超出就截断，不足就留白。

```dart
// 写这个，两个卡片会被强制等高
GridView.count(
  crossAxisCount: 2,
  children: [
    Container(height: 200, color: Colors.red),
    Container(height: 400, color: Colors.blue),  // 实际只显示 200 的高度
  ],
)
```

对于图标宫格、商品列表这类规整内容来说没问题，但碰到图片高度各不相同的场景，就完全帮倒忙了。

前端做瀑布流通常有三条路：CSS Grid 的 `dense` 模式（能填空隙但不是真正的瀑布流）、Masonry.js 这类库（JS 运行时计算，数据多了会卡）、或者手写 JS 维护列高数组自己排。Flutter 这边有一个现成的包 `flutter_staggered_grid_view`，把这些逻辑都封装好了。

---

## 三种布局，各有用途

先装依赖：

```yaml
dependencies:
  flutter_staggered_grid_view: ^0.7.0
  cached_network_image: ^3.4.1
```

```bash
flutter pub get
```

这个包提供了三种布局模式，用途不太一样，分别来看。

---

### MasonryGridView — 真正的瀑布流

最接近小红书、Pinterest 效果的方案，每个卡片高度由内容自己决定，自动填到当前最短的列：

```dart
MasonryGridView.count(
  crossAxisCount: 2,         // 2 列
  mainAxisSpacing: 8,        // 上下间距
  crossAxisSpacing: 8,       // 左右间距
  itemCount: items.length,
  itemBuilder: (context, index) {
    return MyCard(item: items[index]);  // 卡片高度完全自适应
  },
)
```

内置虚拟列表，只渲染可见区域，数据量大也不怕。大部分瀑布流场景选这个就够了。

---

### StaggeredGrid — 轻量版

API 更简洁，适合数据量不大、不需要虚拟列表的场景：

```dart
StaggeredGrid.count(
  crossAxisCount: 2,
  mainAxisSpacing: 8,
  crossAxisSpacing: 8,
  children: items.map((item) => MyCard(item: item)).toList(),
)
```

视觉效果和 MasonryGridView 差不多，区别在于它不支持懒加载，数据全部一次性渲染。数据量超过几十条就建议换 MasonryGridView。

---

### StaggeredGrid + Tile — 杂志式混排

想做大图小图混搭的那种布局（类似 App Store 专题推荐），用这个：

```dart
StaggeredGrid.count(
  crossAxisCount: 4,
  children: List.generate(items.length, (index) {
    // 按规律循环使用不同的尺寸模板
    final patterns = [
      (crossAxis: 2, mainAxis: 2),  // 2x2 大图
      (crossAxis: 1, mainAxis: 1),  // 1x1 小图
      (crossAxis: 1, mainAxis: 1),  // 1x1 小图
      (crossAxis: 2, mainAxis: 1),  // 2x1 横图
    ];
    final pattern = patterns[index % patterns.length];

    return StaggeredGridTile.count(
      crossAxisCellCount: pattern.crossAxis,  // 占几列
      mainAxisCellCount: pattern.mainAxis,    // 占几行
      child: MyCard(item: items[index]),
    );
  }),
)
```

`crossAxisCellCount` 和 `mainAxisCellCount` 这两个参数可以理解成 CSS Grid 里的 `grid-column: span 2` 和 `grid-row: span 2`，控制每个卡片占多少格子。

---

## 和前端方案比一比

前端做瀑布流的几种方案都有不同程度的问题：

```javascript
// CSS Grid dense：填充空隙，但不是按"最短列"排，顺序会乱
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-flow: dense;
}

// Masonry.js：每次 DOM 变化都要重新计算位置
new Masonry('.grid', {
  itemSelector: '.grid-item',
  columnWidth: 200,
  gutter: 10
});

// 手写方案：维护列高数组，逻辑不难但边界情况多
const columnHeights = [0, 0];
items.forEach(item => {
  const col = columnHeights.indexOf(Math.min(...columnHeights));
  columnHeights[col] += item.height;
});
```

Flutter 的 `MasonryGridView` 把"找最短列 → 插入 → 更新列高"这套逻辑封装好了，对外只暴露 `itemBuilder`，用起来比前端任何一种方案都省事。性能上也有优势，绕过了 JS → DOM → 浏览器渲染这条链路，原生渲染的滚动更流畅。

| 对比项 | 前端方案 | Flutter MasonryGridView |
|--------|----------|-------------------------|
| 实现方式 | JS 库或手写逻辑 | 直接用组件 |
| 滚动性能 | 依赖浏览器优化 | 原生渲染，60fps |
| 虚拟列表 | 需要额外配置 | 内置支持 |
| 图片懒加载 | 需要 Intersection Observer | 自动处理 |

---

概念和工具聊完了，下篇直接写代码，手撸一个带下拉刷新、上拉加载的完整小红书图片墙，顺便解决图片加载时卡片抖动这个经典问题。