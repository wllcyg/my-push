# 前端转 Flutter 笔记 (Day 26)：CI/CD、多环境配置与应用发布 🚀

> **前言**：
> 前端我们很熟悉，写完代码扔进流水线或者用 `Vercel` / `Netlify` 就完事了，多环境也就是配置一下 `.env.development` 和 `.env.production`，发版极为轻松。
> 在移动端，一切都变得极其重度：你需要处理漫长的构建、极其严格的 **Android 签名 / iOS 证书 (Provisioning Profile)**、不同的后台 API 环境切分，以及往 App Store / Google Play 提审的复杂流程。
>
> 别慌，这就是我们今天 Day 26 要解决的终极一公里——安全优雅地打包，以及让机器帮你打包。

---

## 1. 最核心的多环境管理：`--dart-define`

在前端，我们用 `process.env.API_URL` 来区分是用开发服还是正式服；
到了 Flutter，最原生、最轻量的方案是它内置的编译期注入指令：`--dart-define`。

### 代码里怎么拿？

在 Dart 源码里，你可以用到 `String.fromEnvironment()`、`bool.fromEnvironment()`。这玩意在编译阶段会变成常量，安全且没有任何第三方包依赖。

```dart
// lib/config/env_config.dart
class EnvConfig {
  // 定义常量，如果命令行没有传，默认 fallback 为 'dev'
  static const String envName = String.fromEnvironment('ENV', defaultValue: 'dev');

  // 不同环境对应不同的 API
  static String get baseUrl {
    switch (envName) {
      case 'prod':
        return 'https://api.my-flutter-app.com';
      case 'staging':
        return 'https://staging.my-flutter-app.com';
      case 'dev':
      default:
        return 'http://192.168.1.100:3000';
    }
  }

  // 是否显示用于调试的测试面板
  static const bool enableDebugTools = bool.fromEnvironment('DEBUG_TOOLS', defaultValue: true);
}
```

### 怎么动态传参启动？

现在，如果你想运行指定环境的包，只需要在命令行带着参数跑：

```bash
# 启动生产环境
flutter run --dart-define=ENV=prod --dart-define=DEBUG_TOOLS=false

# 构建 Android 生产包
flutter build apk --release --dart-define=ENV=prod --dart-define=DEBUG_TOOLS=false
```

### 如果参数太多怎么办？用 `--dart-define-from-file`

如果你环境变量很多（好几套 API Key、第三方 SDK 的配置等），全都拼在命令行会非常痛苦。
Flutter 1.17 开始支持了通过 JSON 传参：

建一个 `dev_config.json`:

```json
{
  "ENV": "dev",
  "DEBUG_TOOLS": "true",
  "SUPABASE_URL": "xxxx",
  "AMAP_KEY": "yyyy"
}
```

然后启动：

```bash
flutter run --dart-define-from-file=dev_config.json
```

这也是目前大厂主流的纯 Flutter 环境管理方案，简单且暴力，而且它注入的字符串不仅能在 Dart 层用，还能被原生 (iOS 里的 Plist, Android 里的 Gradle) 读取到！

---

## 2. 认识打包与证书（最大的痛点）

我们常说的打包，就是把一堆 Dart 代码变成了双端机器能认识的二进制指令包。

### Android：相对亲民的 APK / AAB

- **APK (Android Package)**：可以直接发给别人或者传蓝奏云让人下载安装（必须 `flutter build apk`）。
- **AAB (Android App Bundle)**：这是 Google Play 商店强制要求的格式（必须 `flutter build appbundle`），里面包含了多种架构的碎片，手机在商店下载时会自动按需拼出来。
- **签名 (Keystore)**：Android 相对随意，你只需要自己用 JAVA `keytool` 命令生成一个 `.jks` 文件，把它配到 `android/app/build.gradle` 就够了。这是安卓世界确认"这个包是你打的"唯一凭据。

### iOS：严格到变态的体系

- **IPA**：iOS 的安装包格式（`flutter build ipa`）。不能随便让人安装。
- **证书体系的三神座**：
  1. **Certificates (证书)**：证明"你是你"，等于你的开发者身份证。分为 Development 和 Distribution 两种。
  2. **Identities (应用标识 / Bundle ID)**：相当于你给宝宝（App）上的户口，一旦上报全剧唯一。
  3. **Provisioning Profile (描述文件 / PP文件)**：终极封印卡！它把**【你的证书 + 你的应用标示 + 哪些设备的 UUID 可以装】**绑在了一起。只有被这东西罩着的 App，才能在没越狱的苹果设备上跑。

> _血泪史提醒：接下来的所有事情，你绝不能手动每天搞一次，一定要靠 CI。_

---

## 3. GitHub Actions x Fastlane = 自动化流水线神器

作为一个极简主义开发者，**我们坚决拒绝每次发版本都用自己的电脑傻乎乎地跑上二十分钟构建**。我们应该利用托管式 CI/CD。

在前端，我们用得最多的可能是 Vercel；但在客户端，我们最常搭配的黄金组合是：**GitHub Actions (负责给机器资源) + Fastlane (负责对付双端系统流程)**。

### 什么是 Fastlane？

Fastlane 是用 Ruby 写的一个超强大的开源工具集，专门用来对抗 iOS 和 Android 发布这摊浑水的。
有了它，你可以用极为简单的脚本描述复杂的行为：

比如 iOS 打包+上传到 App Store (TestFlight)：

```ruby
# ios/fastlane/Fastfile
lane :beta do
  # 自动同步最新的 PP 证书（不用你再去苹果网页手动下了）
  match(type: "appstore")
  # 拉取打包
  build_app(workspace: "Runner.xcworkspace", scheme: "Runner")
  # 传上 TestFlight
  upload_to_testflight
end
```

### GitHub Actions 串联全过程

你在仓库根目录下创建一个 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to TestFlight & Google Play

on:
  push:
    tags:
      - "v*" # 只要你打个像 v1.0.0 的 tag 就会触发流水包

jobs:
  build_ios:
    runs-on: macos-latest # 免费用苹果电脑，爽
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: "3.x.x"

      - name: Flutter 依赖
        run: flutter pub get

      - name: 生成 IPA 与上传
        run: |
          cd ios
          # 这里调用 Fastlane 命令
          bundle exec fastlane beta
```

只要你学会了这套流水线：未来当你自己写独立的 App 准备灰度的时候，你只需要敲一句 `git push origin v1.0.5`，然后去喝杯咖啡，等 20 分钟之后，你的 iPhone 上直接就会收到新版本的 TestFlight 提示通知，非常极客与优雅。

---

## 4. 版本号的管理规范

经常有人搞不懂在 `pubspec.yaml` 中的 `version: 1.0.5+8` 是啥意思？

- **`1.0.5`**：面向用户的显示版本号 (`versionName`)。代表功能迭代（大版本.小特性.Bug修复），遵从语义化版本标准。
- **`+8`**：构建编号 (`versionCode` 或 iOS里的 `buildNumber`)。这是一个纯粹永远递增的**整型数字**！它的意义只在于：你要上新商店的包，`versionCode` 就**必定并且必须**比上一个大。哪怕你展示版本号还是 `1.0.5`，只要把 +8 变成了 +9，商店就认为你有新包可以审核。

---

## 5. Demo 在哪看

已经写好了一个演示页面：`lib/pages/cicd_demo/cicd_demo_page.dart`
入口在：**我的 → 开发者工具 → 多环境配置 (CI/CD)**

在这个页面中：
你会通过代码体验从 `String.fromEnvironment`、`bool.fromEnvironment` 抓取到的当前环境参数。
你可以随便用 `flutter run --dart-define=ENV=prod --dart-define=API_URL=https://prod.abc.com` 来重开项目验证！

---

## Day 26 小结 📝

- 环境分离直接用官方内置最强方案 `--dart-define`，少即是多，比额外装插件去读文件强多了。
- 永远记住 iOS 那繁琐的证书体系，并且用它折磨你一次。
- 早点接触 **Fastlane + GitHub Actions**：它比手写 Gradle 和 Xcode 打包好一万倍，能极度解放生产力。
- `version: x.y.z+n` 中，`n` 必须严格递增，应用市场就是靠 `n` 来识别覆盖安装的。

> 📖 下篇预告：**Day 27: WebSocket + 实时通信** —— 是时候接触 Flutter 如何进行持久的双向数据流收发了，带你写个极光/融云无法满足的自研小聊天 Demo！
