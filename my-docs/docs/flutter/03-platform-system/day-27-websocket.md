# 前端转 Flutter 笔记 (Day 27)：WebSocket 与实时通信 💬

> **前言**：
> 前端做长连接实时通信一般都会用到 `WebSocket`，遇到稍微大型点或者旧浏览器会有 `Socket.io` 甚至 `SignalR`。
> 在移动端也是同样的逻辑：普通的 HTTP 请求是一次性的"一问一答"，但在做**聊天室、实时股票推送、买家卖家打字状态、甚至是双向硬件控制**的时候，必须通过 WebSocket 让服务器主动"推"数据下来。
>
> 今天我们就用纯正的 Flutter，不用买任何昂贵的第三方 IM 服务（极光、融云），手摇一个极其畅快的简易实时聊天 Demo。

---

## 1. 核心依赖：`web_socket_channel`

Flutter 官方团队维护的官方包，是所有高阶长连接特性的底层基石。

```yaml
dependencies:
  web_socket_channel: ^3.0.0
```

> 为什么不用 Dart 标准库里的 `WebSocket` (dart:io 里的)？
> 因为 `dart:io` 没法直接编译到 Flutter Web 平台跑，而 `web_socket_channel` 完美抹平了 App 和浏览器之间的长连接 API 差异，提供统一的 `StreamChannel`。

---

## 2. 建立连接与发消息的"三板斧"

在前端，你可能习惯这样写：

```javascript
const ws = new WebSocket("ws://example.com/socket");
ws.onmessage = (event) => {
  console.log(event.data);
};
ws.send("Hello");
```

在 Flutter 中的对标操作，是标准的 Dart **`Stream` / `Sink` 模型**：

### 2.1 建立连接

```dart
import 'package:web_socket_channel/web_socket_channel.dart';

// 用 Uri.parse 包装一下
final channel = WebSocketChannel.connect(
  Uri.parse('wss://echo.websocket.events'), // 这是一个公共的测试服务器，发什么它就回什么
);
```

### 2.2 监听服务端推送 (Stream)

用 `channel.stream.listen` 就可以持续收到服务器扔过来的每一条数据：

```dart
channel.stream.listen(
  (message) {
    print('收到服务端神秘来信: $message');
  },
  onError: (error) => print('网络断了: $error'),
  onDone: () => print('服务端主动跟你分手 (连接被关闭)'),
);
```

### 2.3 给服务端发消息 (Sink)

就像我们在自来水池子里往下水道倒水，它叫 `sink`：

```dart
channel.sink.add('Hello, Server! 能收到吗？');
```

> 发送对象时，记得把 Map 用 `jsonEncode` 转成 String 字符串丢进去。

### 2.4 断开连接

长连接极其耗电/占据系统资源，只要退出页面，**千万不能忘记关掉它** (放在 `dispose` 里)：

```dart
// 随手传个关闭码 1000 代表正常断开
channel.sink.close(1000, 'User left chatroom');
```

---

## 3. 生产环境中不可或缺的基建：保活与重连

`wss://echo.websocket.events` 这种测试服务器永远是绿灯常亮的，但在真实的移动互联网（尤其是坐地铁、进电梯、基站切换）时，WebSocket 连接非常脆弱。

### 3.1 心跳机制 (Heartbeat)

如果你和服务器超过 N 分钟没说话，中间的宽带运营商路由器（NAT设备）会觉得你们没事干，为了节省端口，把你们的连接偷偷干掉。
**此时客户端和服务器都不知道自己掉线了！这叫做"死链"！**

所以我们需要"心跳"：

```dart
import 'dart:async';

Timer? _heartbeatTimer;

// 每隔 30 秒发一个 "ping"
void startHeartbeat() {
  _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
    channel.sink.add(jsonEncode({"type": "ping"}));
  });
}
```

### 3.2 断线重连 (Reconnection)

如果监听到 `onDone` 或者 `onError`，代表连接已经物理断了，这时候必须启动指数退避重连（不断隔几秒尝试连接，直到成功）。

在 Flutter 侧如果你不想手写这种恶心的计次与延迟重试逻辑，很多人会使用 `web_socket_client` 这样的社区二次封装包，支持开箱即用的自动重连。这里给大家一个自己写的重试参考框架：

```dart
Future<void> _connect() async {
  try {
    channel = WebSocketChannel.connect(Uri.parse('wss://xxx'));

    // 这里如果报错或者掉线，会抛到 catch 里或者走 onDone
    channel.stream.listen(
      (msg) => _handleMsg(msg),
      onError: (e) {
        _scheduleReconnect(); // 核心：掉线了就安排重连
      },
      onDone: () {
        _scheduleReconnect(); // 核心：被服务踢了也安排重连
      }
    );
  } catch (e) {
     _scheduleReconnect();
  }
}

void _scheduleReconnect() {
   // 过 3 秒钟重新调 _connect()
   Future.delayed(Duration(seconds: 3), () => _connect());
}
```

---

## 4. Riverpod 集成 `StreamProvider` 的终极快感

当你有了 WebSocket 流，你要怎么把它画到屏幕上的聊天列表里呢？
通常的做法是：每收到一条新消息，塞进一个 `List<String>` 然后调 `setState`。可以，但不优雅。

我们在之前学过 Riverpod，既然是用流 (`Stream`) 接收的数据，简直天生就是为了 `StreamProvider` 准备的！

有了 `StreamProvider`，**Riverpod 会自动帮你管理 `Stream` 的订阅 (`listen`)、甚至在你的 UI 组件销毁时帮你自动取消订阅，连内存泄露都不会有！** 我们将在后面的进阶应用中深入这种最佳实践，而在目前的 Demo 我们用最通俗易懂的 `List` 追加法以便看清每一行通讯日志。

---

## 5. Demo 在哪看

已经写好了一个极具可玩性的演示页面：`lib/pages/websocket_demo/websocket_demo_page.dart`

入口在：**我的 → 开发者工具 → WebSocket 聊天通信**

在这个页面里：
我们全程连接了一个免费的回显 WebSocket 服务器：`wss://echo.websocket.events`。
你发的任何话，它都会像鹦鹉学舌一样还给你。你可以通过界面上的状态灯观察它：

1. `连接建立`、`主动断开` 的物理状态响应
2. `发送流` 和 `接收流` 的双边通信打字机体验
3. 回收资源时的强制中断特性

---

## Day 27 小结 📝

- `web_socket_channel` 抹平了多端的基建差异。
- 对标前段 `ws.send`，这里叫 `sink.add`；对标 `ws.onmessage`，这里叫 `stream.listen`。
- 长连接不要一直挂在后台干耗着手机电，如果由于 AppLifecycle 回到了桌面且停留很久，**务必在生命周期切到 paused 的时候主动断开 WebSocket**。
- 绝不要过于相信移动端的网络，断线重连和心跳包（Ping/Pong）是商业级别即时通讯的核心护城河。

> 📖 下篇预告：**Day 28: 性能调优 (DevTools)** —— 很多刚转 Flutter 的人抱怨应用卡顿甚至疯狂发烫？看一眼怎么找出由于 `setState` 颗粒度太大导致的 60fps 帧率断崖下跌元凶。
