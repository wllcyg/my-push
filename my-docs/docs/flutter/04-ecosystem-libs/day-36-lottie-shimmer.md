# Flutter 实战：Lottie 动画与骨架屏加载过渡

> 在现代高颜值的 App 开发中，纯靠代码写复杂的过渡动画不仅费时费力，而且很难还原设计师细腻的动效。与其死磕代码，不如让设计师导出 Lottie 动画，我们直接一套。同时，在数据未完全加载的时候，为了避免用户看到干巴巴的 Loading 圈或者白屏，使用**骨架屏（Shimmer）**是提升应用质感的不二法则。

## 🎯 今天要做什么？

在这篇实战中，我们将掌握：
1. **Lottie 动画加载原理与实战** — 读取设计师导出的 JSON 并在 App 中播放。
2. **控制器深度定制** — 播放、暂停、循环次数、以及根据动画长度监听完成状态。
3. **结合空页面的应用** — 用 Lottie 替代枯燥的静态占位图标，提升体验。
4. **Shimmer 骨架屏** — 列表请求时的闪光占位动效方案。

---

## 🚀 开始动手！

### 第一步：添加核心包依赖

我们在 `pubspec.yaml` 中增加需要用到的两个优秀生态包：

```yaml
dependencies:
  flutter:
    sdk: flutter
  lottie: ^3.1.2   # AirBnb 开源的动画格式支持包
  shimmer: ^3.0.0  # Facebook 风格的骨架屏闪烁动画组件
```

---

## 🦄 Lottie 动画：让设计师的高级动效轻松落地

Lottie 是一种能够将 After Effects 动画转换成微小 JSON 文件的方案。对标前端的 `lottie-web`，Flutter 官方社区提供了非常强大的支持。

### 基本加载姿势

```dart
import 'package:lottie/lottie.dart';

// 方式一：加载网络 Lottie (最快速的验证方式)
Lottie.network(
  'https://assets5.lottiefiles.com/packages/lf20_U1ouM9.json',
  width: 200,
  height: 200,
  fit: BoxFit.fill,
)

// 方式二：加载本地资源 (推荐：把json文件放在assets下并声明)
Lottie.asset('assets/animations/loading.json')
```

### 进阶：精准控制 Lottie 播放进度

绝大多数情况，我们需要：播放到特定帧就停、需要知道什么时候播放完、点击按钮重播。这时候必须祭出 `AnimationController`：

```dart
class _LottieDemoState extends State<LottieDemo> with TickerProviderStateMixin {
  late final AnimationController _lottieController;

  @override
  void initState() {
    super.initState();
    _lottieController = AnimationController(vsync: this);
  }

  @override
  void dispose() {
    _lottieController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Lottie.asset(
          'assets/animations/rocket.json',
          controller: _lottieController,
          // 极其关键：等 Lottie 加载好、知道自身的持续时长后，再同步给 Controller
          onLoaded: (composition) {
            _lottieController
              ..duration = composition.duration
              ..forward(); // 自动开始正向播放
          },
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(onPressed: () => _lottieController.stop(), child: Text('暂停')),
            ElevatedButton(onPressed: () {
               _lottieController.reset();
               _lottieController.forward();
            }, child: Text('重新播放')),
          ],
        )
      ],
    );
  }
}
```

---

## 🦴 Shimmer：告别转圈圈，拥抱骨架屏

**什么是骨架屏？**
骨架屏是在真实内容加载前，先用浅色块（或者带微光动画的色块）占出页面的大致轮廓。这在社交、信息流产品中几乎是标配功能。

`shimmer` 包使用非常简单，我们只需要将它包裹在一个我们画好的“假 UI”外部，它就会自动渲染出扫光效果：

```dart
import 'package:shimmer/shimmer.dart';

Widget buildSkeletonLoader() {
  return ListView.builder(
    itemCount: 8,
    itemBuilder: (context, index) {
      return Padding(
        padding: const EdgeInsets.all(8.0),
        // 用 Shimmer.fromColors 包裹
        child: Shimmer.fromColors(
          baseColor: Colors.grey[300]!,    // 骨架底色
          highlightColor: Colors.grey[100]!, // 扫过时的亮光色
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 模拟头像
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: Colors.white, // 这里必须要有颜色，Shimmer 才能找到位置染色
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 16),
              // 模拟文本行
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(width: double.infinity, height: 12, color: Colors.white),
                    const SizedBox(height: 8),
                    Container(width: 150, height: 12, color: Colors.white),
                    const SizedBox(height: 8),
                    Container(width: 80, height: 12, color: Colors.white),
                  ],
                ),
              )
            ],
          ),
        ),
      );
    },
  );
}
```

**⚠️ 避坑指南：**
嵌套在 `Shimmer.fromColors` 里的组件对象，背景色（或者任何像素）**不能为透明 (`Colors.transparent`)**，否则光效就扫不出形状。一般直接用纯白 (`Colors.white`) 即可，颜色会被覆盖。

---

## 🎨 实战结合：空状态 + Lottie

传统的 App 如果数据为空（比如网络断开、搜索无结果），我们经常放一张冷冰冰的 `.png`。结合今天所学的内容，在没有数据时，用一个萌萌的 Lottie 代替，质感瞬间翻倍。

在真实项目中，你可以封装成这样的小组件：

```dart
class EmptyStateWidget extends StatelessWidget {
  final String message;

  const EmptyStateWidget({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Lottie.network(
            'https://assets-that-you-host/empty_box.json',
            width: 250,
          ),
          const SizedBox(height: 16),
          Text(message, style: const TextStyle(color: Colors.grey, fontSize: 16)),
        ],
      ),
    );
  }
}
```

## 🎉 总结

今天我们探索了 UI 层面的高级进阶手段：
- 依靠 `lottie` 把复杂原生动效开发变成了轻松的组件组装。
- 借助 `AnimationController` 实现对动画进度的全方位控制。
- 用 `shimmer` 实现与各大厂看齐的高级加载骨架页面反馈效果。

这不仅让我们的 Flutter 页面“活”了起来，也极大程度提升了用户的感知加载速度与耐心。赶紧把这套绝学塞进你的业务组件库吧！
