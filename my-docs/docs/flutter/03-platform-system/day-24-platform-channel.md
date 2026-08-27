# 前端转 Flutter 笔记 (Day 24)：平台通道 (Platform Channel)——打破次元壁 🌉

> **前言**：
> 做前端的时候，如果要调用原生的扫码、分享、底层通讯录等能力，我们通常需要客户端提供一个 JSBridge。
> 到了 Flutter 也是同样的道理。虽然 pub.dev 上有很多插件，但遇到公司自研的 SDK（比如自家的统计 SDK、特殊的硬件设备通信）时，你就得自己写桥接了。
> 今天就来搞定这套**打破 Flutter 与原生层跨语言甚至跨进程屏障的"JSBridge"——平台通道 (Platfo rm Channel)**。

---

## 1. 概念对标：到底什么是通道？

在 Flutter 中，与原生的通信有三种主流方式：

1. **MethodChannel**（最常用）：相当于前端的 `Promise` 包装的 JSBridge。Dart 调原生，原生异步返回结果；或者原生调 Dart。
2. **EventChannel**：相当于前端的 `EventSource` 或 `WebSocket` 接收的数据流。原生通过这个通道源源不断地向 Dart 推送事件（比如重力感应、电量变化等）。
3. **BasicMessageChannel**：底层通道，主要用于传递字符串或半结构化信息，实际开发中较少直接手写，通常用 Pigeon 生成代码代替。

| 场景                     | 前端对标                                       | Flutter 通道            |
| ------------------------ | ---------------------------------------------- | ----------------------- |
| 获取原生一个字符串结果   | `window.JSBridge.invoke('getOSVersion')`       | **MethodChannel**       |
| 持续监听原本设备传感器   | `window.addEventListener('deviceorientation')` | **EventChannel**        |
| JS 和 Native 互相传 JSON | `postMessage`                                  | **BasicMessageChannel** |

> **关键点：** Platform Channel 是**异步**的。为了保证 UI 线程不卡顿，所有通道通信都必须加上 `await`。

---

## 2. 实战演练：MethodChannel 调用原生分享

我们来实现一个极其常见的需求：**调用手机系统自带的分享面板**（iOS 的 `UIActivityViewController` 和 Android 的 `Intent.ACTION_SEND`）。

### 第一步：在 Dart 层开辟通道 🛣️

首先，我们需要在 Dart 里定义一个"通道名"，这个名字在全局必须是唯一的（习惯上用 `域名/模块名称` 格式）：

```dart
// lib/pages/platform_channel_demo/platform_channel_demo_page.dart (截取)
import 'package:flutter/services.dart';

class NativeChannelService {
  // 定义通道，名字必须和原生端保持一致！
  static const platform = MethodChannel('com.example.my_flutter_app/share');

  // 封装调用方法
  static Future<bool> shareText(String text) async {
    try {
      // 通过 invokeMethod 调用原生名为 'shareText' 的方法，并传参数
      final bool result = await platform.invokeMethod('shareText', {'text': text});
      return result;
    } on PlatformException catch (e) {
      print("调用系统分享失败: '${e.message}'.");
      return false;
    }
  }
}
```

这写法简直跟我们以前调用前端 `window.wx.invoke('shareAppMessage', {title: 'xxx'})` 一模一样，传方法名和参数。

---

### 第二步：iOS 原生端接客 🍏

打开 `ios/Runner/AppDelegate.swift`，在其中拦截我们在 Dart 端发出的请求。

```swift
import UIKit
import Flutter

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {

    // 1. 获取 Flutter 引擎的 rootViewController
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    // 2. 建立 MethodChannel，名字必须一模一样！
    let shareChannel = FlutterMethodChannel(name: "com.example.my_flutter_app/share",
                                              binaryMessenger: controller.binaryMessenger)
    // 3. 设置方法调用回调监听
    shareChannel.setMethodCallHandler({
      (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      // 判断调用的方法名是不是我们想要的那个
      if call.method == "shareText" {
        // 提取传过来的参数字典
        guard let args = call.arguments as? [String: Any],
              let text = args["text"] as? String else {
          result(FlutterError(code: "INVALID_ARGUMENT", message: "参数不对啊小伙子", details: nil))
          return
        }

        // 咱们干正事：调用 iOS 自带的分发控制器
        let activityViewController = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        controller.present(activityViewController, animated: true, completion: nil)

        // 告诉 Dart 侧："搞定了哥！"
        result(true)
      } else {
        // 其他方法不认识
        result(FlutterMethodNotImplemented)
      }
    })

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

### 第三步：Android 原生端接客 🤖

同理，打开 `android/app/src/main/kotlin/.../MainActivity.kt`，使用 Kotlin 拦截请求：

```kotlin
package com.example.my_flutter_app

import android.content.Intent
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterFragmentActivity() {
    private val CHANNEL = "com.example.my_flutter_app/share"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // 注册通道监听
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler {
            call, result ->
            if (call.method == "shareText") {
                // 获取参数
                val text = call.argument<String>("text")
                if (text != null) {
                    shareText(text)
                    result.success(true)
                } else {
                    result.error("INVALID_ARGUMENT", "Text cannot be null", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }

    private fun shareText(text: String) {
        val sendIntent: Intent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, text)
            type = "text/plain"
        }
        val shareIntent = Intent.createChooser(sendIntent, null)
        startActivity(shareIntent)
    }
}
```

**写完原生代码后，记得关掉当前的 `flutter run` 进程，重新 `flutter run`，因为热重载对原生层修改无效！**

---

## 3. EventChannel：原生主动找 Dart 推送

如果不是我们要调用原生方法，而是原生端有变化（例如传感器、电量、特殊的硬件蓝牙回调），想主动推送给 Dart，该怎么处理呢？

Dart 端只需要监听 `EventChannel` 收听 Stream 即可：

```dart
static const EventChannel _eventChannel = EventChannel('com.example.my_flutter_app/battery');

@override
void initState() {
  super.initState();
  // 就跟听 Web Socket 一样
  _eventChannel.receiveBroadcastStream().listen((dynamic event) {
    print('收到原生事件: $event');
  }, onError: (dynamic error) {
    print('原生报错了: ${error.message}');
  });
}
```

原生端则通过 `EventChannel.StreamHandler`，在需要的时候通过 `eventSink.success(数据)` 狂发数据给 Dart。用法思路几乎与 MethodChannel 一致。

---

## 4. 痛点与进阶：Pigeon 代码生成 🐦

当我们手写上面的通道代码时，估计细微的你也发现了几个极大的痛点（隐患）：

1. **都是魔法字符串 (Magic String)**：通道名 `'com.example.xxx'`、方法名 `'shareText'` 和参数 key `'text'`。万一 iOS 和 Android 兄弟手抖拼错一个字母，两边排查起来能抓狂。
2. **缺乏类型安全**：传递的是动态类型 `dynamic` 或者字典 `Map`，在接收端要不停地手动 `as? String` 或者转型。如果传复杂的 JSON 对象结构，解析代码惨不忍睹。

**有没有对标前端 TypeScript 接口定义的终极方案呢？**
有，那就是 Flutter 官方出品的 [**Pigeon 开发包**](https://pub.dev/packages/pigeon)。

它的思路极其简单暴力但是有用：
你在 Dart 中用特有的注解 `@HostApi` 像写接口定义（类似 GraphQL Schema）一样把数据模型和方法声明出来，然后跑一条终端命令：

```bash
flutter pub run pigeon --input pigeons/messages.dart \
  --dart_out lib/pigeon.dart \
  --objc_header_out ios/Runner/pigeon.h \
  --objc_source_out ios/Runner/pigeon.m \
  --java_out android/app/src/main/java/dev/flutter/pigeon/Pigeon.java \
  --java_package "dev.flutter.pigeon"
```

它就会自动帮你生成一套可以在 **iOS 调用协议中强类型约束的代码**、**Android Interface 强类型代码**，以及对应的 Dart 实体类代码。你只需要去原生端 implements 它生成的接口，不仅没有了魔法字符串，参数还全部都是强类型！

由于本文主要聚焦基础的 Platform Channel 如何手写理解原理，Pigeon 的具体用法以后在遇到了极其复杂的跨端通讯场景（比如做车载音视频底层应用）再深究。如果是轻量的两三个方法，用普通的 MethodChannel 完全足够了。

---

## 5. 小结 📝

- 无论任何找不到插件的第三方平台级需求（特殊推送、私有 SDK 等），直接掏出 Platform Channel 就能搞定。
- **MethodChannel** 是一问一答的调用模式，是绝大多数桥接原生功能的核心通道；**EventChannel** 则是被动的 Stream 数据流传输通道。
- 两端定义通道方法时，名字一定要一模一样（建议建一个独立的常量文件专门存 Channel 名称防拼写错误）。
- 改了原生端代码必须重启冷启动编译，热重载管不到原生。
- 大型项目需要双端通讯成百上千次接口交互时，丢弃手写魔法字符字符串，改用 **Pigeon** 确保类型安全并减少胶水代码。

> 💡 **Demo 演示**：我在**开发者工具 -> 平台通道通信**里实现了"调用系统原生分享弹窗"的功能，欢迎体验双端不同的丝滑原生活动组件效果！

---

_(完)_
