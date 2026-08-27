# 前端转 Flutter 笔记 (Day 37)：常用工具包 (一) —— 矢量图、网络与设备信息 🧰

> **摘要**：在日常业务开发中，我们常常需要处理各种边角料需求：有些图标放大后失真，怎么引入 SVG？用户断网了，怎么优雅地给个提示？测试提 Bug 说某个机型闪退，怎么获取设备信息协助定位？今天我们来看看 Flutter 中处理这些基础需求的“三剑客”：`flutter_svg`、`connectivity_plus` 和 `device_info_plus`。

---

## 1. 矢量图的神器：`flutter_svg` 🎨

在前端开发中，如果是纯色的线条图标，我们更喜欢直接复用 SVG，这样不管怎么缩放都不会模糊。
在 Flutter 里，自带的 `Image` Widget 是不支持渲染 `.svg` 文件的。这时候 `flutter_svg` 就成了不可或缺的存在。

### 前端映射思维

- **Web / CSS**: `<img src="icon.svg">` 或者 SVG 行内代码 `<svg>...</svg>`
- **Flutter**: `SvgPicture.asset('assets/svgs/icon.svg')`

### 核心用法

```dart
// 基础加载
SvgPicture.asset(
  'assets/svgs/sample_icon.svg',
  width: 64,
  height: 64,
)

// SVG 变色魔法 (类似 CSS 的 fill: currentColor)
SvgPicture.asset(
  'assets/svgs/sample_icon.svg',
  colorFilter: const ColorFilter.mode(Colors.blue, BlendMode.srcIn), // 动态染色
)
```

> 💡 **进阶：配合 `flutter_gen` 自动生成**
> 每次手写资源字符串容易拼错？在 `pubspec.yaml` 配置好 `flutter_gen`：
> ```yaml
> flutter_gen:
>   integrations:
>     flutter_svg: true
> ```
> 生成完毕后，就可以这样丝滑地调用（彻底告别拼写错误）：
> `Assets.svgs.sampleIcon.svg(width: 24, colorFilter: ...)`

---

## 2. 弱网探测雷达：`connectivity_plus` 📡

前端开发时，通常会监听 `window.addEventListener('online', ...)` 或者通过 `navigator.onLine` 来判断网络状态。
在 Flutter 中应用类似逻辑时，需要使用官方推荐的进阶插件：`connectivity_plus`。它能精确告诉你现在连的是 Wi-Fi 还是移动流量。

### 常用场景：

1. **进入页面检测** (例如播放视频前检查，发现没联网提醒用户)。
2. **全局状态监听** (结合 `Riverpod` 或 `Stream`，当网络切换为 None 时弹全屏提示卡片)。

### 核心用法

**一次性检查：**
```dart
final List<ConnectivityResult> connectivityResult = await (Connectivity().checkConnectivity());
if (connectivityResult.contains(ConnectivityResult.mobile)) {
  print('正在使用 4G/5G 移动网络');
} else if (connectivityResult.contains(ConnectivityResult.wifi)) {
  print('连接到 Wi-Fi');
}
```

**持续流监听：**
```dart
StreamSubscription<List<ConnectivityResult>> subscription = 
  Connectivity().onConnectivityChanged.listen((List<ConnectivityResult> result) {
    if (result.contains(ConnectivityResult.none)) {
        // 断网了...
    }
});
```

> ⚠️ **坑点预警**： 
> `connectivity_plus` **只能检查当前终端和路由器/基站之间的连接通道是否建立**。
> 换句话说，如果用户的 Wi-Fi 是“已连接，但无法访问互联网”（比如星巴克的校园网需要跳验证页，或者路由器欠费），它依然会返回 `ConnectivityResult.wifi`。
> **真正可靠的网络诊断，仍然需要你发一次真 API 请求或 Ping 测试！**

---

## 3. 查户口系统：`device_info_plus` 📱

在排查问题、做埋点分析，或者控制在某些特定机型才开放的高级动画特效时，光用 Dart 自带的 `Platform.isIOS` 是远远不够的。你需要把用户的家底扒得更清楚点。

### 功能大纲：

它分平台暴露了极其详尽的信息对象。不同平台的字段不同。

### 核心用法

```dart
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io' show Platform;

final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();

if (Platform.isAndroid) {
  AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
  print('运行在 Android 上: ${androidInfo.model}'); // e.g. "SM-G973F"
  print('SDK 级别: ${androidInfo.version.sdkInt}'); // e.g. 33
} else if (Platform.isIOS) {
  IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
  print('运行在 iOS 上: ${iosInfo.utsname.machine}'); // e.g. "iPhone13,2"
  print('系统版本: ${iosInfo.systemVersion}'); // e.g. "16.1"
}
```

> 💡 **防呆设计**：因为 `AndroidDeviceInfo` 和 `IosDeviceInfo` 的属性名长得截然不同。在使用该包时，最好在底层实现一个隔离转换类，提取出通用的一些属性 (如 `osVersion`, `model`, `vendorId`) 再供业务层使用，这样你就避免了满页面的 `if(Platform.isIOS)...` 的平台绑定烂代码。

---

## Day 37 总结

这三个插件看起来不起眼，却是每个中大型商业 App 的基石：
1. `flutter_svg` 解决了从设计师手中接棒高精图标的问题。
2. `connectivity_plus` 搭建起友好的用户离线体验的第一步。
3. `device_info_plus` 是处理机型适配兼容、用户画像、数据上报的核心数据源。

**明日预告**：
继续实用工具箱！Day 38 我们将补全扫码（生成与扫描）、文件下载与系统分享相关的必备包！
