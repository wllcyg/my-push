# 前端转 Flutter 笔记 (Day 23)：生物识别——用 Face ID / 指纹给你的 App 加把锁 🔐

> **前言**：
> 做前端的时候，我们顶多在 Web 上搞个 `navigator.credentials` 或者接个 Fingerprint.js 做设备指纹采集——说白了浏览器不让你碰真正的硬件。
> 到了 Flutter 这边就完全不一样了，你可以直接唤起手机的 Face ID、指纹识别甚至虹膜扫描。今天就来搞一个最实用的场景：**用生物识别做 App 的快捷登录**。

---

## 1. 先把插件装上 🛠️

用到的核心包就一个：`local_auth`，Flutter 官方团队亲自维护的，质量有保障。

```yaml
# pubspec.yaml
dependencies:
  local_auth: ^2.3.0
```

跑一下 `flutter pub get` 就完事了。不像接地图 SDK 那样搞一堆原生配置（虽然这次也有一点，但少很多）。

---

## 2. 三板斧：检测、查询、认证

整个 `local_auth` 的 API 就三个核心方法，非常简洁：

```dart
import 'package:local_auth/local_auth.dart';

final auth = LocalAuthentication();

// 第一板斧：这台设备能不能搞生物识别？
final bool canAuthenticate =
    await auth.canCheckBiometrics || await auth.isDeviceSupported();

// 第二板斧：这台设备上用户注册了哪些（Face ID？指纹？虹膜？）
final List<BiometricType> biometrics = await auth.getAvailableBiometrics();
// BiometricType.face / BiometricType.fingerprint / BiometricType.iris

// 第三板斧：弹窗让用户验证！
final bool ok = await auth.authenticate(
  localizedReason: '请验证身份以继续操作',
  options: const AuthenticationOptions(
    stickyAuth: true,       // 切后台回来不会丢弹窗
    biometricOnly: false,   // false = 人脸/指纹失败后可以输 PIN 兜底
  ),
);
```

就这么多。比起前端对接微信 JS-SDK 的那套 `wx.config()` 签名流程，简直是降维打击。

---

## 3. 平台配置——别跳过，不然必崩 💣

这是最容易翻车的地方。API 调用代码写好了，一跑直接闪退，然后你对着 Dart 源码看半天觉得没问题——因为问题出在原生层。

### iOS：告诉系统你为什么要刷脸

在 `ios/Runner/Info.plist` 里加一句话就行：

```xml
<key>NSFaceIDUsageDescription</key>
<string>需要使用 Face ID 进行身份验证</string>
```

不加这个，App 提审会被 Apple 直接打回来。

### Android：两个坑，踩一个少一个

**坑 1**：加权限声明

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.USE_BIOMETRIC"/>
```

**坑 2**：改 MainActivity 的父类！

```kotlin
// android/app/src/main/kotlin/.../MainActivity.kt
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity: FlutterFragmentActivity()
//                   ^^^^^^^^^^^^^^^^^^^^^^^^
//                   默认生成的是 FlutterActivity，必须改成这个！
```

为什么？因为 `local_auth` 内部需要用到 `FragmentActivity` 来弹系统指纹弹窗。你用默认的 `FlutterActivity`，它找不到 fragment manager，直接给你一个 crash。

**我第一次接的时候就栽在这儿了，排查了快一个小时。** 记住这个坑，以后用到任何需要弹原生 Dialog 的插件（比如支付、权限弹窗），大概率都要改这个。

---

## 4. 重头戏：Face ID 登录到底怎么做？ ⭐

很多人有个误解，以为 Face ID 能直接替代账号密码登录。其实不是的。

### 搞清楚一件事

**Face ID 不存储任何账号密码，也不跟你的服务器有任何交互。**

它本质上就是一个"门卫"——只负责确认"现在操作手机的是不是录入面容的那个人"。验证通过了，它给你返回一个 `true`，仅此而已。

所以真正的逻辑是这样的：

- **你自己**要负责把登录凭证（Token）存到手机的安全区域
- **Face ID** 只负责在读取这个 Token 之前，确认一下"你是你"
- 这跟前端的 `localStorage` 里存 token + 自动登录是一个意思，只不过多了一道生物验证

### 完整流程，画个图就清楚了

```
【首次登录】

用户输入账号密码 → 服务端返回 Token
        ↓
弹窗问："要不要开启 Face ID 快捷登录？"
        ↓
  [要] → Token 加密丢进 flutter_secure_storage (iOS Keychain / Android Keystore)
  [不要] → 啥也不干


【下次打开 App】

检查本地有没有存过 Token？
        ↓
  [有] → 调 local_auth 弹出 Face ID
              ↓
         [刷脸成功] → 读出加密 Token → 拿 Token 去服务端校验
                          ↓
                     [Token 没过期] → 直接进首页 ✅
                     [Token 过期了] → 走 refresh token 流程
              ↓
         [刷脸失败/取消] → 乖乖回到账号密码页
        ↓
  [没有] → 直接显示登录页
```

### 关键实现代码

你项目里已经有 `flutter_secure_storage` 了，直接拿来配合就行：

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

class BiometricAuthService {
  final _auth = LocalAuthentication();
  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'biometric_auth_token';

  /// 用户登录成功后调这个，把 Token 塞进 Keychain
  Future<void> enableBiometricLogin(String token) async {
    await _storage.write(key: _tokenKey, value: token);
  }

  /// 下次打开 App 时调这个
  Future<String?> authenticateAndGetToken() async {
    // 1. 先看看有没有存过 Token
    final token = await _storage.read(key: _tokenKey);
    if (token == null) return null; // 没开启过，走正常登录

    // 2. 有 Token，弹 Face ID
    final canAuth = await _auth.canCheckBiometrics ||
        await _auth.isDeviceSupported();
    if (!canAuth) return null;

    final didAuth = await _auth.authenticate(
      localizedReason: '请验证身份以快捷登录',
      options: const AuthenticationOptions(
        stickyAuth: true,
        biometricOnly: false,
      ),
    );

    // 3. 验证通过才把 Token 吐出来
    return didAuth ? token : null;
  }

  /// 关闭生物识别登录（在设置页用）
  Future<void> disableBiometricLogin() async {
    await _storage.delete(key: _tokenKey);
  }
}
```

### 安全性怎么样？

说实话，比前端的 `localStorage` 安全太多了：

- **Token 存储**：`flutter_secure_storage` 底层走的是 iOS 的 Keychain 和 Android 的 Keystore，硬件级别的加密，不是你拿个 root 手机就能读出来的
- **生物识别数据**：Face ID 的面部特征是由 Apple 的 Secure Enclave 芯片处理的，App 层面连碰都碰不到原始数据，你只能拿到"验证通过/不通过"这个布尔值
- **降级方案**：`biometricOnly: false` 会在生物识别多次失败后自动弹出系统 PIN 码输入，不会把用户锁死

---

## 5. 顺手聊聊其他硬件能力

既然都说到原生硬件了，顺便记几个前端没法做但 Flutter 随手就能搞的：

**震动反馈**——这个超好用，给按钮加上以后整个 App 质感直接拉满：

```dart
import 'package:flutter/services.dart';

HapticFeedback.lightImpact();     // 轻触——最常用，按钮点击时加上
HapticFeedback.mediumImpact();    // 中等——滑动选中、切换 Tab 时
HapticFeedback.heavyImpact();     // 重——删除确认那种"咚"的感觉
HapticFeedback.selectionClick();  // 选择——日期 Picker 滚动时那种"咔咔"的段落感
```

前端的 `navigator.vibrate()` 只能控制震动时长，完全没有这种精细的触觉反馈分级。实际上很多 iOS App 让你觉得"高级"的那种触感，就是靠这几行代码。

**设备信息 / 传感器这些**，用到的时候再查 `device_info_plus` 和 `sensors_plus` 的文档就行，API 都很简单，就不展开了。

---

## 6. Demo 在哪看

已经写好了一个演示页面：`lib/pages/biometric_demo/biometric_demo_page.dart`

入口在：**我的 → 开发者工具 → 生物识别**

里面可以：

- 查看当前设备支持哪些生物识别
- 测试"通用认证"（含 PIN 兜底）和"纯生物识别"两种模式
- 看 Face ID 登录方案的步骤拆解

> 💡 **iOS 模拟器测试技巧**：Simulator 菜单 → Features → Face ID → Enrolled 先打开，然后每次认证时选 Matching Face（成功）或 Non-matching Face（失败）来模拟。

---

## Day 23 小结 📝

- `local_auth` 的 API 极其简洁（三个方法打天下），但**平台配置千万别忘**，尤其是 Android 的 `FlutterFragmentActivity`
- Face ID 登录的本质是 **"Token 加密存储 + 生物验证守门"**，不要把它想复杂了
- `flutter_secure_storage` + `local_auth` 这俩配合就能覆盖绝大多数 App 的生物识别登录需求
- 震动反馈 `HapticFeedback` 是提升 App 质感的隐藏大招，成本为零效果拔群

> 📖 下篇预告：**Day 24：平台通道 (Platform Channel)**——当你面对一个连 pub.dev 上都找不到现成插件的需求时，如何自己动手写 Dart 和原生代码之间的桥梁。
