# 前端转 Flutter 笔记 (Day 30)：高级 UI——CustomPainter 与 Canvas 绘图 🎨

> **前言**：
> 当系统自带的 `Container`、`Stack` 或 `Container(decoration: ...)` 已经无法满足你对视觉的终极追求时，就轮到 **CustomPainter** 登场了。
> 它是 Flutter 的“画笔”，让你直接在显卡这张画布上，像使用 CSS Canvas 或 SVG 路径一样，绘制任何你想要的形状。

---

## 1. 为什么需要 CustomPainter？

在 Web 端，我们有 `<canvas>` 和 SVG。在 Flutter 中：
- **普通组件**：像“积木”，通过组合实现 UI。
- **CustomPainter**：像“油画”，通过指令绘制 UI。

**优点**：
1. **极致性能**：跳过 Widget 组合层，直接下发绘制指令。
2. **像素级控制**：实现精细的图表、复杂的路径过渡、不规则阴影。

---

## 2. 核心架构：两板斧

实现一个自定义绘图需要两个关键部分：

### 2.1 画布 (Canvas) 与 画笔 (Paint)
- **Canvas**：提供了绘制各种形状的方法，如 `drawCircle`, `drawLine`, `drawPath`。
- **Paint**：定义绘制的样式。粗细、颜色、是否空心、抗锯齿、渐变等。

### 2.2 `shouldRepaint`：性能守门员
这是一个核心函数，返回 `true` 代表需要重新绘制。
> 📌 **避坑**：不要无脑返回 `true`。如果你的绘图数据没变（比如只是传进来的背景色没变），返回 `false` 能极大减少 GPU 负担。

---

## 3. 实战：绘制丝滑的波浪背景 (Path)

前端同学熟悉的 `cubicTo`（三次贝塞尔曲线）在 Flutter 中同样适用。

```dart
class MyWavyPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.blue
      ..style = PaintingStyle.fill;

    final path = Path();
    path.lineTo(0, size.height * 0.8); // 移动到左下角附近
    
    // 三次贝塞尔曲线：控制点1, 控制点2, 终点
    path.cubicTo(
      size.width * 0.25, size.height,
      size.width * 0.75, size.height * 0.6,
      size.width, size.height * 0.8,
    );
    
    path.lineTo(size.width, 0); // 画到右上角
    path.close(); // 闭合路径

    canvas.drawPath(path, paint);
  }
  
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
```

---

## 4. 动画结合：赋予画布灵魂

仅仅静态的波浪太无趣了。你可以传入一个 `Animation<double>` 给你的 Painter。

1. 在 `StatefulWidget` 中创建一个 `AnimationController`。
2. 在 `build` 中使用 `ListenableBuilder` 包裹你的 `CustomPaint`。
3. 把动画值传入 `CustomPainter` 的构造函数。
4. 在 `paint` 方法中利用这个值动态改变 Path 的坐标。

这样，你就得到了一个**动态流动的波浪**，这种效果在 App 的启动页或个人中心头部非常“显贵”。

---

## 5. 性能军规

1. **能用 BoxDecoration 解决的不要用 CustomPainter**：简单的圆角、阴影、渐变，系统组件已经高度优化。
2. **善用裁剪 (ClipPath)**：有时候先画一个大图再裁剪出形状，比画复杂路径更省心。
3. **分层绘制**：如果背景是复杂的绘图但前景是动态的，考虑用两个 `CustomPaint`，让背景层 `shouldRepaint` 为 `false`。

---

> 📌 **CustomPainter 箴言**：它是从“搬砖工”进化为“设计师”的必经之路。掌握了它，你就能在 Flutter 的世界里随心所欲地控制每一个像素。
