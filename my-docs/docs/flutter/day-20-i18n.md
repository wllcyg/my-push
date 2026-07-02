# 前端转 Flutter 笔记 (Day 20)：国际化 (i18n) 与多语言 🌍

![Flutter i18n 国际化](article_images/day20/01_hero_banner.png)

> **前言**：
> 在前端中，我们对 `i18next`、`react-intl`、`vue-i18n` 并不陌生——配置 JSON 翻译文件，通过 `t('key')` 获取翻译文本，然后用 Context/Provider 实现语言切换。
>
> Flutter 的官方 i18n 方案思路几乎一样，只是翻译文件用 **ARB 格式** (Application Resource Bundle)，通过 `flutter gen-l10n` 代码生成实现**类型安全**的翻译访问。今天我们来完整走一遍。

---

## 1. 整体流程一览 🗺️

![ARB → gen-l10n → AppLocalizations 代码生成流程](article_images/day20/02_arb_gen_flow.png)

```
┌─────────────┐     flutter gen-l10n    ┌──────────────────────┐
│  ARB 文件    │  ──────────────────→   │  AppLocalizations    │
│  app_en.arb  │                        │  (自动生成的 Dart 类)  │
│  app_zh.arb  │                        └──────────┬───────────┘
└─────────────┘                                    │
                                                   ▼
                              AppLocalizations.of(context).appTitle
```

| 步骤       | 前端对标                   | Flutter                            |
| ---------- | -------------------------- | ---------------------------------- |
| 翻译文件   | `zh.json` / `en.json`      | `app_zh.arb` / `app_en.arb`        |
| 代码生成   | `i18next` 自动扫描         | `flutter gen-l10n`                 |
| 运行时访问 | `t('key')` / `$t('key')`   | `AppLocalizations.of(context).key` |
| 语言切换   | Context / Store            | Riverpod `StateNotifier`           |
| 复数处理   | ICU `{count, plural, ...}` | 完全相同的 ICU 语法                |

---

## 2. 配置 l10n 基础设施 ⚙️

### 2.1 `pubspec.yaml` 开启代码生成

```yaml
flutter:
  generate: true # ← 必须加这行！
  uses-material-design: true

dependencies:
  flutter_localizations:
    sdk: flutter
  intl: ^0.20.2 # ICU 消息格式化
```

> **💡 前端类比**：相当于在 `package.json` 里加 `"i18n": { "generate": true }` 开启自动扫描。

### 2.2 创建 `l10n.yaml` 配置

```yaml
# 项目根目录下
arb-dir: lib/l10n # ARB 文件目录
template-arb-file: app_en.arb # 模板（英文为主语言）
output-localization-file: app_localizations.dart
output-dir: lib/l10n/generated # 生成 Dart 代码的位置
nullable-getter: false # of(context) 不返回 null
```

---

## 3. ARB 文件——翻译资源 📦

ARB 文件本质就是 JSON，每个 key 对应一条翻译，`@key` 是元数据描述。

### 3.1 基础字符串

```json
// app_en.arb
{
  "@@locale": "en",
  "appTitle": "Minimal Diary",
  "@appTitle": {
    "description": "The title of the application"
  },
  "greeting": "Hello!"
}
```

```json
// app_zh.arb
{
  "@@locale": "zh",
  "appTitle": "极简日记",
  "greeting": "你好！"
}
```

> **💡 前端对标**：完全等价于 `en.json: { "appTitle": "Minimal Diary" }`。`@appTitle` 的描述信息类似 `i18next` 的 defaultValue 注释。

### 3.2 带参数的翻译

```json
{
  "welcomeUser": "Welcome, {name}!",
  "@welcomeUser": {
    "placeholders": {
      "name": { "type": "String", "example": "Alice" }
    }
  }
}
```

生成的 Dart 代码会变成**带参数的方法**（类型安全！）：

```dart
// 自动生成 → String welcomeUser(String name)
l10n.welcomeUser('Flutter')  // → "Welcome, Flutter!"
```

> **前端对标**：`t('welcomeUser', { name: 'Flutter' })` → 但 Flutter 版本是**编译期检查**参数类型，前端只能运行时报错。

---

## 4. ICU 消息语法——复数/性别/日期 🎯

![ICU plural 与 select 语法图解](article_images/day20/03_icu_plural_select.png)

这是 Flutter i18n 最强大的特性，直接在 ARB 文件中使用 ICU MessageFormat 语法。

### 4.1 复数 `plural`

```json
{
  "unreadMessages": "{count, plural, =0{No unread messages} =1{1 unread message} other{{count} unread messages}}",
  "@unreadMessages": {
    "placeholders": { "count": { "type": "num" } }
  }
}
```

```dart
l10n.unreadMessages(0)   // → "No unread messages"
l10n.unreadMessages(1)   // → "1 unread message"
l10n.unreadMessages(42)  // → "42 unread messages"
```

对应中文：

```json
"unreadMessages": "{count, plural, =0{没有未读消息} =1{1 条未读消息} other{{count} 条未读消息}}"
```

> **💡 注意**：不同语言的复数规则不同。英语只有 `one/other`，阿拉伯语有 6 种形式（zero/one/two/few/many/other）。ICU 标准会根据 locale 自动匹配。

### 4.2 性别 `select`

```json
{
  "userGreeting": "{gender, select, male{Mr. {name}} female{Ms. {name}} other{Dear {name}}}",
  "@userGreeting": {
    "placeholders": {
      "gender": { "type": "String" },
      "name": { "type": "String" }
    }
  }
}
```

```dart
l10n.userGreeting('male', 'Alex')    // → "Mr. Alex"
l10n.userGreeting('female', 'Alex')  // → "Ms. Alex"
l10n.userGreeting('other', 'Alex')   // → "Dear Alex"
```

### 4.3 日期/数字格式化

ARB 支持在 `placeholders` 中指定格式化方式：

```json
{
  "currentDate": "Today is {date}",
  "@currentDate": {
    "placeholders": {
      "date": {
        "type": "DateTime",
        "format": "yMMMMd"
      }
    }
  },
  "price": "Price: {amount}",
  "@price": {
    "placeholders": {
      "amount": {
        "type": "double",
        "format": "currency",
        "optionalParameters": { "symbol": "$", "decimalDigits": 2 }
      }
    }
  }
}
```

```dart
l10n.currentDate(DateTime.now())  // en → "Today is February 27, 2026"
                                  // zh → "今天是 2026年2月27日"

l10n.price(1234.56)               // → "Price: $1,234.56"
```

> **🎉 亮点**：日期、数字的格式化会自动根据 locale 切换！中文显示"2026年2月27日"，英文显示 "February 27, 2026"。前端要实现这个效果需要额外引入 `date-fns/locale` 或 `moment` 的 locale 包。

---

## 5. 集成到 MaterialApp 🔌

### 5.1 注册 delegate 和 supportedLocales

```dart
import 'l10n/generated/app_localizations.dart';

MaterialApp.router(
  // 1. 注册本地化代理
  localizationsDelegates: AppLocalizations.localizationsDelegates,

  // 2. 声明支持的语言列表
  supportedLocales: AppLocalizations.supportedLocales,

  // 3. 绑定动态 locale（null = 跟随系统）
  locale: ref.watch(localeProvider),
)
```

### 5.2 在 Widget 中使用

```dart
@override
Widget build(BuildContext context) {
  // 获取翻译实例
  final l10n = AppLocalizations.of(context);

  return Text(l10n.appTitle);           // → "极简日记" 或 "Minimal Diary"
}
```

> **前端对标**：
>
> - `localizationsDelegates` ≈ `I18nextProvider` / `IntlProvider`
> - `AppLocalizations.of(context)` ≈ `useTranslation()` / `$t()`
> - `supportedLocales` ≈ 前端 i18n 的 `supportedLngs` 配置

---

## 6. Riverpod 动态切换语言 🔄

![语言切换 UI 演示](article_images/day20/05_locale_switch.png)

和 `theme_provider.dart` 设计模式一样，用 `StateNotifier` + `SharedPreferences` 实现：

```dart
/// locale_provider.dart
/// state 为 null 表示"跟随系统"，非 null 表示用户显式选择
final localeProvider =
    StateNotifierProvider<LocaleNotifier, Locale?>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return LocaleNotifier(prefs);
});

class LocaleNotifier extends StateNotifier<Locale?> {
  final SharedPreferences prefs;
  static const _key = 'app_locale';

  LocaleNotifier(this.prefs) : super(_loadLocale(prefs));

  static Locale? _loadLocale(SharedPreferences prefs) {
    final code = prefs.getString(_key);
    if (code == null || code.isEmpty) return null;
    return Locale(code);
  }

  /// 设置语言
  void setLocale(Locale locale) {
    state = locale;
    prefs.setString(_key, locale.languageCode);
  }

  /// 跟随系统
  void resetToSystem() {
    state = null;
    prefs.remove(_key);
  }
}
```

使用方式：

```dart
// 切换到英文
ref.read(localeProvider.notifier).setLocale(const Locale('en'));

// 切换到中文
ref.read(localeProvider.notifier).setLocale(const Locale('zh'));

// 跟随系统
ref.read(localeProvider.notifier).resetToSystem();
```

> **💡 关键设计**：`Locale?` 用 `null` 表示跟随系统。`MaterialApp` 的 `locale` 为 `null` 时，Flutter 自动使用系统语言。

---

## 7. 第三方方案对比 ⚖️

![三大 i18n 方案对比](article_images/day20/04_solution_comparison.png)

| 特性          | 官方方案 ✅     | easy_localization | slang               |
| ------------- | --------------- | ----------------- | ------------------- |
| **类型安全**  | ✅ 编译期检查   | ❌ 字符串 key     | ✅ 编译期检查       |
| **代码生成**  | 需要 `gen-l10n` | 不需要            | 需要 `build_runner` |
| **资源格式**  | ARB (JSON 变体) | JSON / YAML / CSV | JSON / YAML         |
| **复数/性别** | ✅ 完整 ICU     | ✅ 基础支持       | ✅ 完整支持         |
| **热重载**    | ❌ 需重启       | ✅ 实时更新       | ❌ 需重启           |
| **官方维护**  | ✅ Flutter 团队 | ❌ 社区           | ❌ 社区             |
| **学习成本**  | 中              | 低                | 中高                |
| **访问方式**  | `l10n.appTitle` | `'appTitle'.tr()` | `t.appTitle`        |

### 怎么选？

- **新项目 / 团队项目** → 官方方案。长期维护有保障，类型安全减少翻译遗漏。
- **快速原型 / 小项目** → `easy_localization`。配置简单，热重载友好。
- **追求极致类型安全** → `slang`。API 最简洁 (`t.xxx`)，支持链接翻译。

---

## 8. 避坑指南 ⚠️

### ❌ 忘记 `generate: true`

```yaml
# pubspec.yaml
flutter:
  generate: true # ← 没有这行，gen-l10n 会报错
```

### ❌ ARB 文件 key 不一致

```json
// ❌ app_en.arb 有 "greeting"，但 app_zh.arb 漏掉了
// → 运行时中文环境会 fallback 到英文模板

// ✅ 所有 ARB 文件的 key 必须一一对应
```

### ❌ 复数语法 `{{count}}` 的双花括号

```json
// ❌ 忘记内层是参数引用，需要双花括号
"msg": "{count, plural, other{count items}}"

// ✅ 引用参数 count 需要加花括号
"msg": "{count, plural, other{{count} items}}"
```

### ❌ 切换语言后不生效

```dart
// ❌ 只改了 Provider，没有绑定到 MaterialApp
// ✅ 必须在 MaterialApp 中设置 locale 属性
MaterialApp(
  locale: ref.watch(localeProvider),  // ← 不能漏！
)
```

### ❌ iOS 未配置支持的语言

iOS 需要在 `ios/Runner/Info.plist` 中声明支持的语言：

```xml
<key>CFBundleLocalizations</key>
<array>
  <string>en</string>
  <string>zh</string>
</array>
```

---

## 9. 完整工作流速查 📋

```bash
# Step 1: 创建 ARB 文件
mkdir -p lib/l10n
# 创建 app_en.arb (模板) 和 app_zh.arb

# Step 2: 创建 l10n.yaml 配置
# 在项目根目录创建

# Step 3: pubspec.yaml 开启 generate
flutter:
  generate: true

# Step 4: 生成代码
flutter gen-l10n

# Step 5: 在 main.dart 中注册
# localizationsDelegates + supportedLocales + locale

# Step 6: 在 Widget 中使用
# AppLocalizations.of(context).xxx
```

> **⚡ 日常开发**：修改 ARB 文件后，只需重新运行 `flutter gen-l10n`（或 IDE 自动触发）。

---

## Day 20 总结 📝

- **Flutter 官方 i18n** = ARB 文件 + `flutter gen-l10n` + `AppLocalizations.of(context)`。
- **ARB 文件**是带元数据的 JSON，一个 locale 一个文件，key 必须一一对应。
- **ICU 消息语法**处理复数（`plural`）、性别（`select`）和日期/数字格式化，跨语言自动适配。
- **动态切换语言**用 Riverpod `StateNotifier<Locale?>` 管理 + `SharedPreferences` 持久化。
- **三大方案选型**：新项目推荐官方方案，快速原型选 `easy_localization`，极致类型安全选 `slang`。
- **别忘了**：`pubspec.yaml` 的 `generate: true`、iOS 的 `Info.plist` 语言声明。

> 📖 下篇预告：**Day 21：图片处理——拍照/相册/裁剪/压缩/上传**——学习 `image_picker`、`image_cropper`、权限申请的完整流程。
