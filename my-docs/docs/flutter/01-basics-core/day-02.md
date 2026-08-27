# 前端转 Flutter 笔记 (Day 2)：布局思维转换与 Hooks 革命

> **摘要**：第二天，我开始真正上手写 UI。这里遇到了两个最大的挑战：一是 CSS 到 Widget 的思维转换，二是如何在 Flutter 里找回写 Vue Composition API 的快感。

## 1. 布局大对决：CSS vs Flutter Widget 📐

前端开发者最痛苦的莫过于：**“我的 CSS 哪去了？”**
Flutter 没有 CSS，样式即组件。以下是常用概念的映射表：

### A. 盒子模型 (Box Model)
*   **Vue (CSS)**: `margin`, `padding`, `border` 都是在一个 `div` 的 `style` 里写的。
*   **Flutter**: 想要 Padding？你得在组件外面包一层 `Padding` Widget。
    ```dart
    // Flutter 写法：俄罗斯套娃
    Padding(
      padding: EdgeInsets.all(16),
      child: Container(color: Colors.blue),
    )
    ```

### B. Flex 布局 (最重要！)
Flutter 的布局核心就是 Flexbox，但拆分成了行和列：

| CSS 属性 | Flutter Widget | 说明 |
| :--- | :--- | :--- |
| `display: flex; flex-direction: row` | **Row** | 水平排列 |
| `display: flex; flex-direction: column` | **Column** | 垂直排列 |
| `justify-content` | `mainAxisAlignment` | 主轴对齐 |
| `align-items` | `crossAxisAlignment` | 交叉轴对齐 |
| `flex: 1` | **Expanded** 或 **Flexible** | 占据剩余空间 |

**避坑指南**：
前端里 `div` 默认是块级元素（宽占满）。
但在 Flutter `Row` 里，子元素默认是 `wrap-content`（内容多宽就多宽）。如果想让它占满剩余空间，**必须**包裹 `Expanded`。

### C. 绝对定位
*   **Vue**: `position: absolute; top: 10px;`
*   **Flutter**: 使用 **Stack** + **Positioned**。`Stack` 就像是 `position: relative` 的父容器。

---

## 2. 状态管理革命：抛弃 StatefulWidget，拥抱 Hooks ⚡️

Flutter 原生的 `StatefulWidget` 写起来太啰嗦（定义类、初始化、销毁...）。
幸运的是，Flutter 也有 **Hooks**！

### 场景：写一个输入框
我们需要创建一个控制器，并在组件销毁时释放它。

**🔴 原生写法 (StatefulWidget)**
你需要写 20 行代码：继承类、重写 `initState`、重写 `dispose`... 很容易忘记 dispose 导致内存泄漏。

**🟢 Hooks 写法 (Vue 既视感)**
引入 `flutter_hooks` 后，代码变成了这样：

```dart
class LoginPage extends HookWidget {
  @override
  Widget build(BuildContext context) {
    // 这不就是 Vue 的 composition api 吗？！
    // 自动负责创建和销毁，一行代码搞定
    final controller = useTextEditingController(); 
    
    // 定义一个响应式变量
    final isCodeLogin = useState(false);

    return TextField(controller: controller);
  }
}
```

这对于由 `setup()` 喂大的 Vue 3 开发者来说，简直太亲切了！🚀

---

## 3. 移动端适配：rem 的转世 (ScreenUtil) 📱

做 H5 的都知道 `rem` 或 `vw` 适配方案。
Flutter 里也有几乎一样的方案：`flutter_screenutil`。

*   **原理**：在 `main.dart` 初始化设计稿尺寸（如 375x812）。
*   **使用**：
    *   **Vue**: `width: 100px` (在 PostCSS 插件下转为 rem)
    *   **Flutter**: `width: 100.w`

它会根据当前屏幕宽度自动缩放。iPhone 17 Pro Max 上 `100.w` 实际渲染出来可能就是 `118dp`，完美还原设计稿比例。

## 4. 样式抽离：Design Tokens

为了避免样式代码“硬编码”在页面里，我建立了类似 SCSS 变量的文件结构：
*   `AppColors`：管理品牌色。
*   `AppStyles`：管理字体样式 (H1, H2, Body)。
*   `AppDimens`：管理间距。`SizedBox(height: AppDimens.gap16)` 比写死 `16` 要利于维护得多。

## Day 2 总结

今天完成了**通用输入框 (MyTextField)** 和 **按钮 (MyButton)** 的封装，并用 Hooks 重构了登录页。
Flutter 的组件化开发体验（特别是在配合 Hooks 后）其实非常接近 React/Vue。只要跨过了“布局套娃”和“Dart 语法”的一开始的不适应，后面的开发效率极高。

**明日预告**：接入 MVVM 架构，实现真正的登录逻辑与验证码倒计时！
