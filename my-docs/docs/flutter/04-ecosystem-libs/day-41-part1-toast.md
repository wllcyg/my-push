# Day 41: Toast 轻量级提示 (Part 1)

## 📚 概述

今天写的是最常用的 UI 提示组件之一：**fluttertoast**。我感觉是最轻量级的 Toast 提示，支持 Android 原生风格及其自定义扩展。

## 🎯 核心功能

### Toast 提示

- 轻量级、不阻塞用户交互
- 支持顶部/中间/底部位置配置
- 自定义背景色、文字颜色、显示时长
- 适合简单的成功/失败/警告提示

## 📦 依赖包

```yaml
dependencies:
  fluttertoast: ^9.0.0
  flutter_riverpod: ^2.6.1
```

## 🔧 安装

```bash
flutter pub add fluttertoast
flutter pub get
```

## 💡 使用场景对比

### Toast vs SnackBar vs Dialog

| 组件         | 使用场景                 | 特点               | 示例               |
| ------------ | ------------------------ | ------------------ | ------------------ |
| **Toast**    | 简单提示，不需要用户操作 | 轻量级，不阻塞交互 | 保存成功、复制成功 |
| **SnackBar** | 需要撤销操作或查看详情   | 可添加操作按钮     | 删除后可撤销       |
| **Dialog**   | 需要用户确认或输入       | 阻塞交互，必须响应 | 删除确认、表单提交 |

## 📖 核心 API

### Toast API

```dart
Fluttertoast.showToast(
  msg: "提示消息",
  toastLength: Toast.LENGTH_SHORT,  // SHORT(2秒) 或 LONG(3.5秒)
  gravity: ToastGravity.BOTTOM,     // TOP, CENTER, BOTTOM
  backgroundColor: Colors.black87,
  textColor: Colors.white,
  fontSize: 16.0,
);
```

## 🎨 完整示例

### 1. Toast 位置配置

```dart
// 顶部提示
void _showTopToast() {
  Fluttertoast.showToast(
    msg: "顶部提示",
    gravity: ToastGravity.TOP,
    backgroundColor: Colors.black87,
    textColor: Colors.white,
  );
}

// 中间提示
void _showCenterToast() {
  Fluttertoast.showToast(
    msg: "中间提示",
    gravity: ToastGravity.CENTER,
  );
}

// 底部提示
void _showBottomToast() {
  Fluttertoast.showToast(
    msg: "底部提示",
    gravity: ToastGravity.BOTTOM,
  );
}
```

### 2. Toast 样式配置

```dart
// 成功提示
void _showSuccessToast() {
  Fluttertoast.showToast(
    msg: "操作成功",
    backgroundColor: Colors.green,
    textColor: Colors.white,
    gravity: ToastGravity.CENTER,
  );
}

// 错误提示
void _showErrorToast() {
  Fluttertoast.showToast(
    msg: "操作失败",
    backgroundColor: Colors.red,
    textColor: Colors.white,
  );
}

// 警告提示
void _showWarningToast() {
  Fluttertoast.showToast(
    msg: "警告信息",
    backgroundColor: Colors.orange,
    textColor: Colors.white,
  );
}
```

## 🎯 实战场景

### 场景: 表单提交反馈

```dart
class FormSubmitButton extends StatelessWidget {
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () async {
        try {
          await onSubmit();
          // 成功提示
          Fluttertoast.showToast(
            msg: "提交成功",
            backgroundColor: Colors.green,
            gravity: ToastGravity.CENTER,
          );
        } catch (e) {
          // 失败提示
          Fluttertoast.showToast(
            msg: "提交失败: $e",
            backgroundColor: Colors.red,
            gravity: ToastGravity.CENTER,
          );
        }
      },
      child: Text('提交'),
    );
  }
}
```

## 特殊点

1. **不要过度使用**
   - Toast 会覆盖在界面上，频繁显示会影响用户体验
   - 对于重要操作，考虑使用 Dialog 或 SnackBar

2. **文字长度**
   - Toast 文字不宜过长，建议控制在 20 字以内
   - 过长的文字可能被截断或显示不全

3. **显示时长**
   - `Toast.LENGTH_SHORT`: 约 2 秒
   - `Toast.LENGTH_LONG`: 约 3.5 秒
   - 无法自定义精确时长

4. **平台差异**
   - Android: 原生 Toast 样式
   - iOS: 自定义实现，样式可能略有不同

## 🔍 最佳实践

### 封装 Toast 工具类

```dart
class ToastUtil {
  static void success(String message) {
    Fluttertoast.showToast(
      msg: message,
      backgroundColor: Colors.green,
      textColor: Colors.white,
      gravity: ToastGravity.CENTER,
    );
  }

  static void error(String message) {
    Fluttertoast.showToast(
      msg: message,
      backgroundColor: Colors.red,
      textColor: Colors.white,
      gravity: ToastGravity.CENTER,
    );
  }

  static void info(String message) {
    Fluttertoast.showToast(
      msg: message,
      backgroundColor: Colors.blue,
      textColor: Colors.white,
      gravity: ToastGravity.BOTTOM,
    );
  }
}
```

## 总结

1. **Toast** 适合简单的、不需要用户操作的提示。
2. 注意不要过度使用，影响用户体验。

## 下一步

- Badge 角标提示
