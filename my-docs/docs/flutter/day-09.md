# 前端转 Flutter 笔记 (Day 9)：动画系统深度解析——从 CSS Transitions 到 Hero 动画 🎬

> **摘要**：Day 9，我们来搞定 Flutter 的动画系统。
> 作为前端开发者，我们对 CSS 的 `transition`、`@keyframes`、`transform` 烂熟于心。
> 今天就用这套"肌肉记忆"来理解 Flutter 的动画机制，并重点学习 **Hero 动画**（共享元素过渡）。

## 1. 动画体系对比：CSS vs Flutter 🗺️

在 CSS 中，动画主要分两类：

1. **Transitions（过渡）**：状态变化时自动过渡 (`transition: all 0.3s ease`)
2. **Animations（动画）**：通过 `@keyframes` 定义复杂关键帧

Flutter 也有对应的两类：

1. **隐式动画 (Implicit)**：状态变化时自动过渡 → `AnimatedFoo` 系列
2. **显式动画 (Explicit)**：手动控制的精细动画 → `AnimationController` + `Transition` 系列

### 终极映射表

| CSS 属性/概念                         | Flutter 对应                        | 说明             |
| :------------------------------------ | :---------------------------------- | :--------------- |
| `transition: all 0.3s ease`           | `AnimatedContainer`                 | 容器属性自动过渡 |
| `opacity` 变化                        | `AnimatedOpacity`                   | 透明度过渡       |
| `transform: scale()`                  | `ScaleTransition` / `AnimatedScale` | 缩放动画         |
| `transform: rotate()`                 | `RotationTransition`                | 旋转动画         |
| `transform: translateX()`             | `SlideTransition`                   | 位移动画         |
| `@keyframes`                          | `AnimationController`               | 显式动画控制器   |
| `animation-duration`                  | `Duration`                          | 动画时长         |
| `animation-timing-function`           | `Curves`                            | 动画曲线         |
| `animation-delay`                     | `Future.delayed` / `Timer`          | 延迟执行         |
| `animation-iteration-count: infinite` | `controller.repeat()`               | 无限循环         |
| View Transitions API                  | `Hero`                              | 共享元素过渡     |

## 2. 隐式动画：最省心的选择 ✨

**核心理念**：你只需要改变状态值，动画自动发生。

就像 CSS `transition`：

```css
.box {
  width: 100px;
  transition: width 0.3s ease;
}
.box:hover {
  width: 200px; /* 自动过渡 */
}
```

Flutter 版本：

```dart
AnimatedContainer(
  duration: Duration(milliseconds: 300),  // transition-duration
  curve: Curves.easeInOut,                // transition-timing-function
  width: _isExpanded ? 200 : 100,         // 状态变化触发动画
  height: 100,
  color: _isExpanded ? Colors.orange : Colors.blue,
  child: Text('点击展开'),
)
```

### 常用隐式动画组件

| 组件                       | CSS 等价                      | 用途                 |
| :------------------------- | :---------------------------- | :------------------- |
| `AnimatedContainer`        | `transition: all`             | 容器尺寸/颜色/边框等 |
| `AnimatedOpacity`          | `transition: opacity`         | 淡入淡出             |
| `AnimatedPositioned`       | `transition: top/left`        | Stack 内位置变化     |
| `AnimatedDefaultTextStyle` | `transition: font-size/color` | 文字样式变化         |
| `AnimatedPadding`          | `transition: padding`         | 内边距变化           |
| `AnimatedAlign`            | `transition: transform`       | 对齐位置变化         |
| `AnimatedCrossFade`        | 两个元素切换                  | 交叉淡入淡出         |

> 💡 **心法**：简单的状态变化动画，优先用 `AnimatedFoo`，不需要手写 Controller！

## 3. 显式动画：完全掌控 🎮

当你需要：

- 无限循环动画 (loading spinner)
- 精确控制播放/暂停/倒放
- 监听动画进度
- 组合多个动画

就需要显式动画了。

### CSS @keyframes 对比

CSS:

```css
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.spinner {
  animation: rotate 2s linear infinite;
}
```

Flutter:

```dart
class _MyWidgetState extends State<MyWidget>
    with SingleTickerProviderStateMixin {          // 1️⃣ 混入 Ticker

  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(seconds: 2),              // 2️⃣ 动画时长
      vsync: this,                                 // 3️⃣ 防止屏幕外动画消耗资源
    )..repeat();                                   // 4️⃣ infinite 无限循环
  }

  @override
  void dispose() {
    _controller.dispose();                         // 5️⃣ ⚠️ 必须销毁！
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(                     // 6️⃣ 旋转动画
      turns: _controller,
      child: Icon(Icons.refresh),
    );
  }
}
```

### 显式动画核心概念

```
AnimationController (0.0 → 1.0)
       ↓
    Tween<T> (映射值范围)
       ↓
    CurvedAnimation (应用曲线)
       ↓
 FooTransition / AnimatedBuilder (UI 渲染)
```

**示例：自定义颜色动画**

```dart
late Animation<Color?> _colorAnimation;

@override
void initState() {
  super.initState();
  _controller = AnimationController(duration: Duration(seconds: 1), vsync: this);

  _colorAnimation = ColorTween(
    begin: Colors.blue,
    end: Colors.red,
  ).animate(CurvedAnimation(
    parent: _controller,
    curve: Curves.easeInOut,
  ));

  _controller.repeat(reverse: true);  // 往返循环
}

@override
Widget build(BuildContext context) {
  return AnimatedBuilder(
    animation: _colorAnimation,
    builder: (context, child) {
      return Container(
        color: _colorAnimation.value,
        child: child,
      );
    },
    child: Text('颜色渐变'),  // child 可缓存，提升性能
  );
}
```

## 4. 动画曲线：Curves 作弊条 📈

| CSS timing-function | Flutter Curve                     | 效果         |
| :------------------ | :-------------------------------- | :----------- |
| `linear`            | `Curves.linear`                   | 匀速         |
| `ease`              | `Curves.ease`                     | 先快后慢再快 |
| `ease-in`           | `Curves.easeIn`                   | 慢入         |
| `ease-out`          | `Curves.easeOut`                  | 慢出         |
| `ease-in-out`       | `Curves.easeInOut`                | 慢入慢出     |
| `cubic-bezier(...)` | `Cubic(...)` / `Curves.bounceOut` | 自定义贝塞尔 |

**特殊曲线（CSS 难以实现）**：

- `Curves.bounceOut` —— 弹跳效果
- `Curves.elasticOut` —— 弹性/橡皮筋效果
- `Curves.fastOutSlowIn` —— Material Design 标准曲线

## 5. Hero 动画：共享元素过渡 🦸

这是 Flutter 最优雅的动画特性之一！

### 什么是 Hero 动画？

当你从一个页面导航到另一个页面时，某个元素可以"飞"到新位置，创造视觉连续性。
就像电影中的英雄从一个场景"飞"到另一个场景。

**CSS 对比：View Transitions API**

```css
/* Chrome 111+ 的新特性 */
.hero-image {
  view-transition-name: hero-image;
}

::view-transition-old(hero-image),
::view-transition-new(hero-image) {
  animation-duration: 300ms;
}
```

### Flutter 实现

**1️⃣ 源页面**（列表项）：

```dart
GestureDetector(
  onTap: () => Navigator.push(context, MaterialPageRoute(
    builder: (_) => DetailPage(item: item),
  )),
  child: Hero(
    tag: 'hero_${item.id}',  // 唯一标识！
    child: Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: item.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(item.icon),
    ),
  ),
)
```

**2️⃣ 目标页面**（详情页）：

```dart
Hero(
  tag: 'hero_${item.id}',  // 必须和源页面相同！
  child: Container(
    width: 200,            // 尺寸可以不同
    height: 200,
    decoration: BoxDecoration(
      color: item.color,
      borderRadius: BorderRadius.circular(32),  // 形状也会过渡！
    ),
    child: Icon(item.icon, size: 64),
  ),
)
```

### Hero 动画工作原理

```
导航开始
    ↓
Flutter 扫描两个页面的 Hero，匹配相同 tag
    ↓
创建 Overlay 层，将 Hero 从源位置"托起"
    ↓
动画期间，Overlay 中的 Hero 平滑过渡到目标位置
    ↓
动画完成，Overlay 消失，Hero 回归正常 Widget Tree
```

### 高级技巧

**自定义飞行动画**：

```dart
Hero(
  tag: 'avatar',
  flightShuttleBuilder: (flightContext, animation, direction, fromContext, toContext) {
    return ScaleTransition(
      scale: animation.drive(Tween(begin: 0.0, end: 1.0)),
      child: fromContext.widget,
    );
  },
  child: CircleAvatar(...),
)
```

**占位符**（防止布局抖动）：

```dart
Hero(
  tag: 'avatar',
  placeholderBuilder: (context, size, child) {
    return Container(
      width: size.width,
      height: size.height,
      color: Colors.grey.shade200,
    );
  },
  child: Image.network(...),
)
```

## 6. 实战：今日代码示例 💻

今天我们在项目中创建了 **动画学习演示页面**：

### 文件结构

```
lib/pages/animation_demo/
├── animation_demo_page.dart    # 主演示页面
└── animation_detail_page.dart  # Hero 动画目标页面
```

### 访问方式

**我的 → 开发者工具 → 动画学习**

### 包含内容

1. **隐式动画区**：`AnimatedContainer`、`AnimatedOpacity`、`AnimatedDefaultTextStyle`
2. **显式动画区**：`RotationTransition`（无限旋转）、`ScaleTransition`（脉冲效果）
3. **Hero 动画区**：点击卡片进入详情页，观察共享元素过渡
4. **曲线对比**：实时展示各种 `Curve` 的效果差异

## 7. 避坑指南 ⚠️

### ❌ AnimationController 未销毁

```dart
// 错误：忘记 dispose
@override
void dispose() {
  // _controller.dispose();  ← 内存泄漏！
  super.dispose();
}
```

### ❌ Hero tag 不唯一

```dart
// 错误：列表项用相同 tag
Hero(tag: 'card', ...)  // 所有卡片都是这个 tag
Hero(tag: 'card', ...)  // 冲突！

// 正确：用唯一 ID
Hero(tag: 'card_${item.id}', ...)
```

### ❌ 在非 Route 页面使用 Hero

Hero 动画只在 `Navigator` 页面过渡时生效。
如果只是在同页面切换 Widget，用 `AnimatedSwitcher` 代替。

## Day 9 总结 ✅

| 场景              | 方案                           |
| :---------------- | :----------------------------- |
| 简单状态过渡      | `AnimatedFoo` 隐式动画         |
| 无限循环/精细控制 | `AnimationController` 显式动画 |
| 页面间元素过渡    | `Hero` 动画                    |
| 同页面组件切换    | `AnimatedSwitcher`             |
| 列表项动画        | `AnimatedList`                 |

**核心心法**：

1. 能用隐式就用隐式，简单省心
2. 需要控制时才用显式，记得 dispose
3. Hero 是页面过渡神器，tag 要唯一

**明日预告**：
继续深入 Flutter 高级特性，可能会学习 **Sliver 系列**（自定义滚动效果）或 **CustomPaint**（自定义绑制）！
