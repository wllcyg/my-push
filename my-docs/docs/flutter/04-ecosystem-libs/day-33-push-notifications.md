# 前端转 Flutter 笔记 (Day 33)：推送通知 — 让 App 主动跟用户打招呼 🔔

> **前言**：
> Web 前端有 Notification API 和 Service Worker Push，但老实说，浏览器推送的覆盖率和体验一直很一般。
> 在移动端，推送通知是 App 与用户保持联系的「生命线」—— 外卖到了、朋友发消息了、限时折扣开始了……全靠推送唤回用户。
> 移动端的推送分为两种：**本地推送**（App 在前台/后台自行触发）和 **远程推送**（后端通过 FCM/APNs 发到用户手机）。
> 今天我们用 `flutter_local_notifications` 实现本地推送的完整流程，并深入讲解远程推送的架构与接入思路。

---

## 1. 推送通知的两种类型

### 本地通知 (Local Notification)

由 App 本地代码直接触发，**不需要服务器**：

```
App 代码 → flutter_local_notifications 插件 → 系统通知栏
```

典型场景：
- 定时提醒（闹钟、番茄钟、日程）
- 下载进度通知
- 任务完成提示

### 远程推送 (Remote Push Notification)

由**后端服务器**通过推送服务商发送，即使 App 没有打开也能收到：

```
你的后端 → FCM/APNs/极光 → 系统推送服务 → 用户通知栏
```

典型场景：
- 即时消息（聊天、评论回复）
- 营销活动（优惠券、限时折扣）
- 系统通知（订单状态、物流更新）

> 前端类比：本地通知 ≈ `new Notification('标题', { body: '内容' })`
> 远程推送 ≈ Service Worker 的 `push` 事件，但移动端的覆盖率和到达率远远超过 Web Push。

---

## 2. flutter_local_notifications 快速上手

### 初始化

```dart
final FlutterLocalNotificationsPlugin notificationsPlugin =
    FlutterLocalNotificationsPlugin();

Future<void> initNotifications() async {
  // Android 设置
  const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');

  // iOS 设置
  final iosSettings = DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );

  final initSettings = InitializationSettings(
    android: androidSettings,
    iOS: iosSettings,
  );

  await notificationsPlugin.initialize(
    initSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      // 用户点击了通知，可以在这里做跳转
      print('用户点击了通知，payload: ${response.payload}');
    },
  );
}
```

> Android 需要在 `AndroidManifest.xml` 中配置权限和通知频道（channel），iOS 需要在 Xcode 中开启 Push Notifications 能力。

### 发送简单通知

```dart
Future<void> sendSimpleNotification() async {
  const androidDetails = AndroidNotificationDetails(
    'demo_channel',           // channel ID (Android 8.0+ 必须)
    '演示通知',                // channel 名称
    channelDescription: '用于演示的频道',
    importance: Importance.high,
    priority: Priority.high,
  );

  const iosDetails = DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: true,
    presentSound: true,
  );

  const details = NotificationDetails(
    android: androidDetails,
    iOS: iosDetails,
  );

  await notificationsPlugin.show(
    id: 1,                      // 通知 ID（相同 ID 会覆盖旧通知）
    title: '📬 新消息',
    body: '你有一条未读消息',
    notificationDetails: details,
    payload: 'message_123',     // 携带数据，点击时可获取
  );
}
```

### 进度条通知（模拟下载）

```dart
Future<void> sendProgressNotification() async {
  for (int progress = 0; progress <= 100; progress += 20) {
    await Future.delayed(const Duration(milliseconds: 500));

    final androidDetails = AndroidNotificationDetails(
      'progress_channel', '下载进度',
      showProgress: true,
      maxProgress: 100,
      progress: progress,
      ongoing: progress < 100,  // 未完成时常驻通知栏
    );

    await notificationsPlugin.show(
      id: 2,
      title: '正在下载...',
      body: '$progress%',
      notificationDetails: NotificationDetails(android: androidDetails),
    );
  }
}
```

> **注意**：进度条通知目前仅 Android 支持，iOS 原生不支持进度条样式的通知。

### 取消通知

```dart
// 取消指定 ID 的通知
await notificationsPlugin.cancel(1);

// 取消所有通知
await notificationsPlugin.cancelAll();
```

---

## 3. 通知频道 (Notification Channel) — Android 8.0+ 必知

从 Android 8.0 (Oreo) 开始，所有通知都必须归属于一个**频道 (Channel)**。用户可以在系统设置中单独控制每个频道的开关、是否振动、是否静音等。

```dart
// 不同重要性的频道
const highChannel = AndroidNotificationDetails(
  'high_channel', '重要通知',
  importance: Importance.high,    // 会弹出横幅
  priority: Priority.high,
);

const lowChannel = AndroidNotificationDetails(
  'low_channel', '次要通知',
  importance: Importance.low,     // 只在通知栏显示，不弹横幅
  priority: Priority.low,
);
```

> 前端类比：频道有点像 Web Notification 的 `tag` 概念，但功能更强大 —— 用户能对每一类通知做细粒度的控制。

---

## 4. 远程推送架构解析

虽然本 Demo 没有实现远程推送（需要 Firebase/极光后台账号和服务器端配合），但理解其架构非常重要。

### 远程推送工作流程

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│ 你的后端服务  │────→│ FCM / APNs   │────→│ 操作系统推送服务 │────→│ 用户设备  │
│ (Node/Java)  │     │ 极光/个推     │     │ (系统级守护进程) │     │ 通知栏弹出│
└─────────────┘     └──────────────┘     └────────────────┘     └──────────┘
```

### 主流推送方案选型

| 方案 | 适用场景 | Flutter 插件 | 优点 | 缺点 |
|---|---|---|---|---|
| **FCM** (Firebase) | 海外项目 | `firebase_messaging` | Google 官方，免费 | 国内无法使用 |
| **APNs** | iOS 专用 | 通过 FCM 或原生桥接 | Apple 原生，稳定 | 仅限 iOS |
| **极光推送** | 国内项目 | `jpush_flutter` | 国内全覆盖，文档好 | 有收费套餐 |
| **个推** | 国内项目 | `getui_flutter_plugin` | 国内各大厂兼容好 | 配置较复杂 |

### 国内特殊情况

国内 Android 生态非常特殊：
- 大多数手机**没有 Google 服务**（GMS），FCM 无法工作
- 各厂商有自己的推送通道：小米推送、华为 Push、OPPO Push、vivo Push
- **极光/个推**等第三方 SDK 会自动适配各厂商通道，实现全覆盖

```dart
// 极光推送的典型初始化代码 (伪代码)
import 'package:jpush_flutter/jpush_flutter.dart';

final JPush jpush = JPush();

jpush.setup(
  appKey: '你的极光AppKey',
  channel: 'developer-default',
  production: false,
);

// 监听收到的推送
jpush.addEventHandler(
  onReceiveNotification: (Map<String, dynamic> message) async {
    print('收到推送: $message');
  },
  onOpenNotification: (Map<String, dynamic> message) async {
    print('用户点击推送: $message');
    // 这里可以根据 message 里的数据做页面跳转
  },
);

// 获取设备 Registration ID (需上传给你的后端实现定向推送)
jpush.getRegistrationID().then((rid) {
  print('Registration ID: $rid');
  // 发送给后端保存：api.registerDevice(rid)
});
```

### 前台时如何展示远程推送？

远程推送默认只在 App 处于后台/杀掉时才弹系统通知。如果 App 在前台，需要配合 `flutter_local_notifications` 手动弹出：

```dart
// 在 FCM/极光的 onMessage 回调中
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  // App 在前台时，用 flutter_local_notifications 本地弹出
  notificationsPlugin.show(
    id: message.hashCode,
    title: message.notification?.title,
    body: message.notification?.body,
    notificationDetails: details,
  );
});
```

> 这也是为什么即使做远程推送，也需要 `flutter_local_notifications` 的原因 —— 两者互补。

---

## 5. 通知点击跳转

通知最重要的交互环节就是用户点击后的跳转。通过 `payload` 传递数据，在回调中用 `GoRouter` 导航：

```dart
// 初始化时注册点击回调
notificationsPlugin.initialize(
  initSettings,
  onDidReceiveNotificationResponse: (response) {
    final payload = response.payload;
    if (payload != null && payload.startsWith('order_')) {
      final orderId = payload.replaceFirst('order_', '');
      GoRouter.of(context).push('/order/$orderId');
    }
  },
);

// 发送通知时附带 payload
await notificationsPlugin.show(
  id: 1,
  title: '订单已发货',
  body: '您的订单 #12345 已发出',
  notificationDetails: details,
  payload: 'order_12345',   // 用户点击后会带着这个跳转
);
```

> 前端类比：就像 PWA Service Worker 的 `notificationclick` 事件中做 `clients.openWindow('/order/12345')`。

---

## 6. Demo 在哪看

已经写好了一个完整的本地推送演示页面：`lib/pages/push_demo/push_demo_page.dart`

入口在：**我的 → 开发者工具 → 推送通知**

在这个页面里你可以体验：

1. **📬 简单文本通知** — 发送标题 + 内容的基础通知
2. **📊 进度条通知** — 模拟文件下载进度（仅 Android）
3. **⏰ 延迟 5s 通知** — 预约 5 秒后弹出通知
4. **🗑️ 取消全部通知** — 清除所有未读通知
5. **通知日志面板** — 实时查看发送和点击操作的完整日志

---

## Day 33 小结 📝

- **本地通知** = App 代码直接触发 → `flutter_local_notifications` 插件 → 系统通知栏。适合定时提醒、进度提示等。
- **远程推送** = 后端 → FCM/APNs/极光 → 系统通知栏。两者不互斥，远程推送在前台时仍需本地通知展示。
- Android 8.0+ 必须配置 **Notification Channel**，用户可以单独控制每类通知。
- 国内项目推荐用**极光/个推**，它们自动适配小米/华为/OPPO/vivo 厂商推送通道。
- 通知点击跳转通过 **payload** 传数据 + 路由导航实现，是推送功能闭环的关键一环。

> 📖 下篇预告：**Day 34: 深度链接与应用内更新 (Deep Links & In-App Update)**——让你的 App 可以通过 URL 被唤醒，并且能从 App 内提示版本升级。
