# Day 38: 常用工具包 (二) —— 扫码、下载与分享

在移动应用开发中，扫描二维码、文件下载以及调用系统级分享是非常常见的需求。本篇笔记介绍了Flutter中实现这些功能的主流方案。

---

## 1. qr_flutter (生成二维码)

通常在需要用户出示凭证、展示专属邀请码等场景下，需要应用动态生成二维码。`qr_flutter` 提供了一个简单的 `QrImageView` 控件。

**安装:** `flutter pub add qr_flutter`

**核心用法:**
```dart
import 'package:qr_flutter/qr_flutter.dart';

QrImageView(
  data: 'https://flutter.dev', // 二维码包含的文本内容
  version: QrVersions.auto, // 自动计算复杂度版本
  size: 200.0,
  backgroundColor: Colors.white, // 设置背景色以防暗色模式下被遮盖
  // embeddedImage: const AssetImage('assets/images/logo.png'), // 中心可嵌入 Logo
)
```

**避坑指南:** 
- 在深色模式下，二维码周围容易失去对比度从而无法被扫描，务必设置 `backgroundColor: Colors.white`。

---

## 2. mobile_scanner (扫码)

实现扫描二维码/条形码最佳实践之一，相比于老旧的 `barcode_scan2` 或 `qr_code_scanner` ，`mobile_scanner` 仍在积极维护并支持最新的 ML Kit。

**安装:** `flutter pub add mobile_scanner`

**核心用法:**
```dart
import 'package:mobile_scanner/mobile_scanner.dart';

MobileScanner(
  onDetect: (BarcodeCapture capture) {
    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      print('扫描到: \${barcode.rawValue}');
    }
  },
)
```

**原生配置 (重要):**
- **iOS**: 必须在 `ios/Runner/Info.plist` 里添加相机权限声明：
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>需要使用您的相机来扫描二维码</string>
  ```
- **Android**: `android/app/build.gradle` 的 `minSdkVersion` 需满足要求（通常为 21+）。

**避坑指南:**
- 模拟器的摄像头功能非常受限，调试最好使用真机。
- `MobileScanner` 在部分页面推栈 (push) 后可能会占用相机不释放，离开页面需合理控制状态。

---

## 3. flutter_downloader (文件下载)

想要在 App 退到后台后依然能够下载文件、并在系统的通知栏展示进度？`flutter_downloader` 是你的首选。

**安装:** `flutter pub add flutter_downloader`

**核心用法:**
```dart
// 1. main.dart 初始化
await FlutterDownloader.initialize(debug: true, ignoreSsl: true);

// 2. 发起下载
final taskId = await FlutterDownloader.enqueue(
  url: 'https://example.com/file.zip',
  savedDir: '/path/to/save/directory', // 通常用 path_provider 获取
  showNotification: true, // 在状态栏显示进度
  openFileFromNotification: true, // 下载完成后允许点击打开
);
```

**避坑指南:**
- 需要极其繁琐的 Android/iOS 原生配置才能工作，包括 `AndroidManifest.xml` 中声明 `android:requestLegacyExternalStorage="true"`（根据API级别）以及权限声明。
- iOS 下载同样需要开启后台传输配置。如果不涉及后台和状态栏，简单的网络请求结合写文件更优！

---

## 4. share_plus (调用系统分享)

想要快速将一段文本、一张截图或一个文件分享给微信好友或保存到备忘录，无需接入复杂的微信 SDK，可以直接调用系统原生的分享面板。

**安装:** `flutter pub add share_plus`

**核心用法:**
```dart
import 'package:share_plus/share_plus.dart';

// 分享纯文本
Share.share('快来看看这个 Flutter App！https://flutter.dev', subject: '邀请注册');

// 分享文件或图片
// final result = await Share.shareXFiles([XFile('/path/to/image.png')], text: '图片分享');
```

**避坑指南:**
- iPad 上触发底层弹出窗口时需要提供 `sharePositionOrigin` (Rect)，否则会导致应用崩溃。

---

## 总结
这四个包填补了标准库中移动端常见场景的空白，但凡涉及硬件（相机）和底层（通知栏、系统分享）的需求，务必进行 Android/iOS 双端真机测试。
