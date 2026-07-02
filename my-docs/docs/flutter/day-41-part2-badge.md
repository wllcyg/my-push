# Day 41: Badge 角标提示 (Part 2)

## 📚 概述

这篇文章介绍常用的 UI 提示组件：**badges**。它专门用于红点提示、购物车数量显示及其与状态管理框架（如 Riverpod）的联动。

## 🎯 核心功能

### Badge 角标

- 数字角标（购物车数量、未读消息）
- 红点提示（新消息提醒）
- 自定义位置（右上角、左上角、右下角、左下角）
- 动画效果（缩放、滑动）
- 与 Riverpod 结合实现动态更新

## 依赖包

```yaml
dependencies:
  badges: ^3.1.2
  flutter_riverpod: ^2.6.1
```

## 安装

```bash
flutter pub add badges flutter_riverpod
flutter pub get
```

## 核心 API

### Badge API

```dart
badges.Badge(
  badgeContent: Text('9', style: TextStyle(color: Colors.white)),
  showBadge: true,  // 控制是否显示
  position: badges.BadgePosition.topEnd(top: -5, end: -5),
  badgeStyle: badges.BadgeStyle(
    badgeColor: Colors.red,
    padding: EdgeInsets.all(6),
  ),
  badgeAnimation: badges.BadgeAnimation.scale(),
  child: Icon(Icons.shopping_cart),
)
```

## 完整示例

### 1. Badge 基础用法

```dart
// 数字角标
badges.Badge(
  badgeContent: Text(
    '5',
    style: TextStyle(color: Colors.white, fontSize: 12),
  ),
  showBadge: true,
  child: Icon(Icons.shopping_cart, size: 32),
)

// 红点提示（无数字）
badges.Badge(
  showBadge: true,
  badgeStyle: badges.BadgeStyle(
    badgeColor: Colors.red,
    padding: EdgeInsets.all(4),
  ),
  child: Icon(Icons.notifications, size: 32),
)
```

### 2. Badge 位置配置

```dart
// 右下角
badges.Badge(
  position: badges.BadgePosition.bottomEnd(bottom: -5, end: -5),
  badgeContent: Text('9'),
  child: Icon(Icons.inbox),
)

// 左上角
badges.Badge(
  position: badges.BadgePosition.topStart(top: -5, start: -5),
  child: Icon(Icons.mail),
)
```

### 3. 动态更新角标（Riverpod）

```dart
final cartCountProvider = StateProvider<int>((ref) => 0);

class BadgeDemo extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartCountProvider);

    return badges.Badge(
      badgeContent: Text('$cartCount'),
      showBadge: cartCount > 0,
      badgeAnimation: badges.BadgeAnimation.scale(),
      child: IconButton(
        icon: Icon(Icons.shopping_cart),
        onPressed: () => ref.read(cartCountProvider.notifier).state++,
      ),
    );
  }
}
```

### 4. Badge 动画效果

```dart
// 滑动动画
badges.Badge(
  badgeAnimation: badges.BadgeAnimation.slide(
    animationDuration: Duration(milliseconds: 300),
  ),
  child: Icon(Icons.mail),
)

// 淡入淡出动画
badges.Badge(
  badgeAnimation: badges.BadgeAnimation.fade(
    animationDuration: Duration(milliseconds: 300),
  ),
  child: Icon(Icons.notifications),
)
```

## 实战场景

### 场景 1: 购物车角标

```dart
class ShoppingCartButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartCountProvider);

    return badges.Badge(
      badgeContent: Text('$cartCount', style: TextStyle(color: Colors.white, fontSize: 10)),
      showBadge: cartCount > 0,
      position: badges.BadgePosition.topEnd(top: 0, end: 3),
      child: IconButton(
        icon: Icon(Icons.shopping_cart),
        onPressed: () => context.push('/cart'),
      ),
    );
  }
}
```

### 场景 2: 底部导航栏角标

```dart
class BottomNavBar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messageCount = ref.watch(unreadMessagesProvider);

    return BottomNavigationBar(
      items: [
        BottomNavigationBarItem(icon: Icon(Icons.home), label: '首页'),
        BottomNavigationBarItem(
          icon: badges.Badge(
            badgeContent: Text('$messageCount'),
            showBadge: messageCount > 0,
            child: Icon(Icons.message),
          ),
          label: '消息',
        ),
      ],
    );
  }
}
```

## 注意事项

1. **数字显示**: 超过 99 建议显示 "99+"，避免遮挡图标。
2. **位置调整**: 根据图标大小微调位置，确保视觉平衡。
3. **性能**: 使用 `showBadge` 控制显示，避免不必要的重绘。
4. **无障碍**: 确保屏幕阅读器能识别角标内容。

## 🔍 最佳实践

### 1. 封装通用 Badge 组件

```dart
class AppBadge extends ConsumerWidget {
  final Widget child;
  final StateProvider<int> countProvider;

  const AppBadge({required this.child, required this.countProvider});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(countProvider);
    return badges.Badge(
      badgeContent: Text(count > 99 ? '99+' : '$count', style: TextStyle(color: Colors.white, fontSize: 10)),
      showBadge: count > 0,
      badgeAnimation: badges.BadgeAnimation.scale(),
      child: child,
    );
  }
}
```

### 2. 统一管理状态

```dart
// providers/badge_providers.dart
final totalUnreadProvider = Provider<int>((ref) {
  final messages = ref.watch(messageCountProvider);
  final notifications = ref.watch(notificationCountProvider);
  return messages + notifications;
});
```

**今天的代码已上传到仓库**：[查看完整代码](https://github.com/your-repo/flutter-example)
