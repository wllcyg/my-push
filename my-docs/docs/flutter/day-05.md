# 前端转 Flutter 笔记 (Day 5)：通知推送与深色模式 🌙

> **摘要**：Day 5，今天的主题是"完善用户体验"。上午折腾了本地推送通知（踩了 `flutter_local_notifications` v20 的大坑），下午则给 App 换上了一套完整的深色模式。从 Android 权限配置到 iOS 时区处理，再到 Riverpod 状态管理，这一天收获满满。

## 1. 本地通知：从"不响"到"准时响" 🔔

日记 App 需要一个"每日提醒"功能，让用户可以设定一个固定时间收到推送。方案选型：**flutter_local_notifications**。

### A. 第一个大坑：API 大改 (v10 → v20)

这个库从 v10 升到 v20 是**破坏性更新**，网上大部分教程都过时了。

**旧版写法 (v10)：**
```dart
// 这些在 v20 里全部报错！
await _notificationsPlugin.zonedSchedule(
  0, 'Title', 'Body', scheduledTime, details,
  uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
  matchDateTimeComponents: DateTimeComponents.time,
);
```

**新版写法 (v20)：**
```dart
await _notificationsPlugin.zonedSchedule(
  id: 0,                     // 👈 变成命名参数了
  title: 'Title',
  body: 'Body',
  scheduledDate: scheduledTime,
  notificationDetails: details,
  matchDateTimeComponents: DateTimeComponents.time,         // 保留
  androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle, // 新增
);
// uiLocalNotificationDateInterpretation 被彻底删除了！
```

教训：用第三方库前一定要去 pub.dev 看最新的 **Changelog** 和 **Example**。

### B. 第二个坑：时区 (`flutter_timezone`)

通知调度需要用 `TZDateTime`（带时区的时间）。`flutter_timezone` 库用于获取设备时区名称，但它返回的是一个 `TimezoneInfo` 对象，不是 `String`！

```dart
// 错误写法
final String timeZoneName = await FlutterTimezone.getLocalTimezone(); 

// 正确写法
final String timeZoneName = 
    (await FlutterTimezone.getLocalTimezone()).identifier; // 👈 取 .identifier
```

### C. Android 权限大全

Android 13+ 对通知权限收紧了，需要在 `AndroidManifest.xml` 里显式声明：

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

还需要注册 Receiver 才能让手机重启后通知依然生效：
```xml
<receiver android:exported="false" 
          android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED"/>
        <!-- ... -->
    </intent-filter>
</receiver>
```

### D. 请求权限的正确姿势

iOS 和 Android 的权限请求 API 也不一样：

```dart
Future<bool> requestPermissions() async {
  // iOS
  final iosResult = await _notificationsPlugin
      .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
      ?.requestPermissions(alert: true, badge: true, sound: true);

  // Android 13+
  final androidResult = await _notificationsPlugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();

  return iosResult ?? androidResult ?? false;
}
```

## 2. 深色模式：不只是换个背景色 🎨

下午的任务是给整个 App 加上深色模式切换。这可比我想象的工作量大多了。

### A. 核心：Riverpod + ThemeMode

用 `StateNotifierProvider` 管理主题状态，并持久化到 `SharedPreferences`。

```dart
// providers/theme_provider.dart
enum AppThemeMode {
  system, light, dark;
  
  ThemeMode get flutterThemeMode => switch (this) {
    AppThemeMode.system => ThemeMode.system,
    AppThemeMode.light => ThemeMode.light,
    AppThemeMode.dark => ThemeMode.dark,
  };
}

final themeModeProvider = StateNotifierProvider<ThemeModeNotifier, AppThemeMode>((ref) {
  return ThemeModeNotifier();
});
```

### B. MaterialApp 接入

在 `main.dart` 里监听主题状态，并传给 `MaterialApp`：

```dart
Widget build(BuildContext context, WidgetRef ref) {
  final themeMode = ref.watch(themeModeProvider);
  
  return MaterialApp.router(
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,       // 👈 定义深色主题
    themeMode: themeMode.flutterThemeMode, // 👈 动态切换
    // ...
  );
}
```

### C. 颜色常量：Light vs Dark

在 `res/colors.dart` 里定义两套颜色：

```dart
class AppColors {
  // ===== 亮色模式 =====
  static const Color background = Color(0xFFF5F7F8);
  static const Color textPrimary = Color(0xFF111518);
  static const Color textSecondary = Color(0xFF60778A);

  // ===== 深色模式 =====
  static const Color backgroundDark = Color(0xFF121212);
  static const Color surfaceDark = Color(0xFF1E1E1E);
  static const Color textPrimaryDark = Color(0xFFE0E0E0);
  static const Color textSecondaryDark = Color(0xFFAAAAAA);
}
```

### D. 页面适配：无处不在的 `isDark`

几乎每个页面的 `build` 方法里都要加这一行：

```dart
final isDark = Theme.of(context).brightness == Brightness.dark;
```

然后在所有颜色使用的地方做三元判断：

```dart
Text(
  'Hello',
  style: TextStyle(
    color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimary,
  ),
),
```

这一趟下来，我改了十几个文件：
- `MainPage`, `HomePage`, `TimelinePage`, `StatisticsPage`, `MinePage`
- 各种 Header, Card, ListItem 组件
- 日记详情页、编辑页、设置页...

**小技巧**：`SliverPersistentHeaderDelegate` 的 `shouldRebuild` 要返回 `true`，否则主题切换时 Header 不会重建。

## 3. 设置页的主题选择器

做了一个 Bottom Sheet 来让用户选择主题模式：

```dart
void _showThemeSelector(BuildContext context, WidgetRef ref, AppThemeMode currentMode) {
  showModalBottomSheet(
    context: context,
    builder: (context) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: AppThemeMode.values.map((mode) => ListTile(
          leading: Icon(mode.icon),
          title: Text(mode.displayName),
          trailing: currentMode == mode ? Icon(Icons.check) : null,
          onTap: () {
            ref.read(themeModeProvider.notifier).setThemeMode(mode);
            Navigator.pop(context);
          },
        )).toList(),
      );
    },
  );
}
```

三个选项：
- ☀️ 浅色模式
- 🌙 深色模式  
- 📱 跟随系统

## 4. NotificationService 初始化的教训

还遇到了一个逻辑 Bug：用户设置了提醒，但返回再进去，开关又变回关闭了。

**根因分析**：
1. `NotificationService` 没有在 `main.dart` 里初始化。
2. 调用 `scheduleDailyNotification` 时报错（因为时区没初始化）。
3. `try-catch` 吞掉了错误，但导致后续的云端同步代码没执行。
4. 下次进入页面，从云端拉取的是旧数据（关闭状态）。

**修复**：
```dart
// main.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // ...其他初始化...
  
  await NotificationService().init(); // 👈 关键！在 runApp 之前初始化
  
  runApp(const ProviderScope(child: MyApp()));
}
```

并且把通知逻辑用独立的 `try-catch` 包起来，确保即使通知失败，也不影响状态保存。

## 5. 首页 (HomePage)：日记卡片列表 🏠

首页的核心是展示用户的日记列表，用 `CustomScrollView` + `SliverList` 实现。

### A. 毛玻璃吸顶 Header

用 `SliverPersistentHeader` + `BackdropFilter` 实现毛玻璃效果的吸顶标题栏：

```dart
class HomeHeader extends SliverPersistentHeaderDelegate {
  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          color: Colors.white.withOpacity(0.8), // 半透明背景
          child: SafeArea(child: Text('我的日记')),
        ),
      ),
    );
  }
}
```

### B. 日记卡片 (DiaryCard)

每张卡片包含：封面图（可选）、标题、内容预览、时间、心情 Emoji。
用 `CachedNetworkImage` 加载远程图片，自带缓存和占位符。

```dart
CachedNetworkImage(
  imageUrl: entry.coverUrl!,
  fit: BoxFit.cover,
  placeholder: (context, url) => Container(color: AppColors.background),
  errorWidget: (context, url, error) => Icon(Icons.broken_image),
)
```

### C. 空状态处理

没有日记时显示友好的空状态提示，而不是一片空白：

```dart
if (diaries.isEmpty)
  Center(
    child: Column(
      children: [
        Icon(Icons.book, size: 64.w, color: Colors.grey[300]),
        Text('还没有日记，快去写一篇吧~'),
      ],
    ),
  )
```

## 6. 时间轴页 (TimelinePage)：按年份分组 📅

时间轴页面的设计灵感来自 iOS 照片 App 的年视图。

### A. 数据分组

先按年份对日记进行分组，用 Dart 的 `groupBy` 或手动遍历：

```dart
Map<String, List<DiaryEntry>> groupedByYear = {};
for (var entry in diaries) {
  final year = entry.createdAt.year.toString();
  groupedByYear.putIfAbsent(year, () => []).add(entry);
}
```

### B. 虚线连接

时间轴项目之间用虚线连接，通过 `CustomPainter` 绘制：

```dart
class DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Color(0xFFDBE1E6)
      ..strokeWidth = 1;
    
    double startY = 0;
    while (startY < size.height) {
      canvas.drawLine(Offset(0, startY), Offset(0, startY + 4), paint);
      startY += 8; // 虚线间隔
    }
  }
}
```

### C. 年份吸顶

用 `SliverPersistentHeader` 让年份标签在滚动时吸顶：

```dart
SliverPersistentHeader(
  pinned: true,
  delegate: TimelineYearHeader(year: '2026'),
)
```

## 7. 统计页 (StatisticsPage)：日历 + 日记预览 📊

统计页使用了 `table_calendar` 库来展示一个可交互的日历。

### A. 日历组件配置

```dart
TableCalendar(
  focusedDay: _focusedDay,
  selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
  onDaySelected: (selectedDay, focusedDay) {
    setState(() {
      _selectedDay = selectedDay;
      _focusedDay = focusedDay;
    });
  },
  calendarStyle: CalendarStyle(
    todayDecoration: BoxDecoration(
      color: AppColors.primary.withOpacity(0.3),
      shape: BoxShape.circle,
    ),
    selectedDecoration: BoxDecoration(
      color: AppColors.primary,
      shape: BoxShape.circle,
    ),
  ),
)
```

### B. 有日记的日期标记

用 `calendarBuilders` 自定义日期样式，给有日记的日期加上小圆点：

```dart
calendarBuilders: CalendarBuilders(
  markerBuilder: (context, date, events) {
    if (hasDiaryOnDate(date)) {
      return Positioned(
        bottom: 1,
        child: Container(
          width: 6, height: 6,
          decoration: BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
        ),
      );
    }
    return null;
  },
),
```

### C. 选中日期的日记列表

日历下方展示当天的日记，点击可进入详情页。如果当天没写日记，显示空状态提示。

## 8. 新增日记页 (CalendarAddPage)：简洁输入 + 心情选择 ✍️

这是用户写日记的核心页面，采用简洁的纯文本输入方式（移除了富文本编辑器，让体验更轻量）。

### A. 页面结构

```dart
Scaffold(
  appBar: AppBar(title: Text(dateStr)), // 显示当前日期
  body: Column(
    children: [
      TextField(...),           // 标题输入框（可选）
      Expanded(
        child: TextField(       // 多行正文输入
          maxLines: null,
          expands: true,
          textAlignVertical: TextAlignVertical.top,
        ),
      ),
      Row([                     // 附件功能区
        AttachmentButton('添加封面'),
        AttachmentButton('心情标签'),
      ]),
      Row([                     // 底部按钮
        TextButton('取消'),
        TextButton('保存'),
      ]),
    ],
  ),
)
```

### B. 封面选择 (ImagePicker)

用 `image_picker` 库从相册选择封面图片，上传到 Supabase Storage：

```dart
Future<void> _pickCoverImage() async {
  final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
  if (image != null) {
    setState(() => _coverImage = File(image.path));
  }
}

// 上传到 Supabase Storage
await Supabase.instance.client.storage
    .from('diary_covers')
    .uploadBinary(filePath, await _coverImage!.readAsBytes());
```

### C. 心情选择器 (Bottom Sheet)

点击心情按钮，弹出一个 Grid 让用户选择今天的心情：

```dart
final List<Mood> _moods = [
  Mood('开心', '😊', Color(0xFFFFC107)),
  Mood('难过', '😔', Color(0xFF607D8B)),
  Mood('生气', '😡', Color(0xFFF44336)),
  // ...
];

showModalBottomSheet(
  builder: (context) => GridView.builder(
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4),
    itemBuilder: (_, index) => GestureDetector(
      onTap: () {
        setState(() => _selectedMood = _moods[index]);
        context.pop();
      },
      child: Column(children: [
        Text(_moods[index].emoji, style: TextStyle(fontSize: 32)),
        Text(_moods[index].label),
      ]),
    ),
  ),
);
```

### D. AttachmentButton 组件

自定义的附件按钮，支持显示已选择的图片缩略图或心情 Emoji：

```dart
AttachmentButton(
  icon: Icons.image,
  label: '添加封面',
  onTap: _pickCoverImage,
  customIcon: _coverImage != null
      ? ClipOval(child: Image.file(_coverImage!, width: 24, height: 24))
      : null,
  onClear: _coverImage != null ? () => setState(() => _coverImage = null) : null,
)
```

## 9. 日记详情页 (DiaryDetailPage)：沉浸式阅读 📖

详情页用于展示完整的日记内容，支持查看封面大图和删除操作。

### A. 透明 AppBar

用半透明 AppBar 实现沉浸式效果，让封面图可以延伸到状态栏下方：

```dart
AppBar(
  backgroundColor: isDark
      ? AppColors.surfaceDark.withValues(alpha: 0.8)
      : Colors.white.withValues(alpha: 0.8),
  scrolledUnderElevation: 0, // 滚动时不加阴影
)
```

### B. 删除确认对话框

删除日记前弹出确认框，防止误操作：

```dart
SmartDialog.show(
  builder: (_) => AlertDialog(
    backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
    title: Text('确认删除'),
    content: Text('确定要删除这篇日记吗？删除后无法恢复。'),
    actions: [
      TextButton(onPressed: () => SmartDialog.dismiss(), child: Text('取消')),
      TextButton(
        onPressed: () async {
          await ref.read(diaryListProvider.notifier).deleteDiary(entry.id);
          SmartDialog.dismiss();
          context.pop();
        },
        child: Text('删除', style: TextStyle(color: Colors.red)),
      ),
    ],
  ),
);
```

### C. 实时同步

详情页通过 `ref.watch(diaryListProvider)` 监听数据变化，当列表更新时（比如编辑后返回），页面自动刷新显示最新内容：

```dart
final diaryListAsync = ref.watch(diaryListProvider);
final displayedEntry = diaryListAsync.when(
  data: (list) => list.firstWhere((e) => e.id == entry.id, orElse: () => entry),
  loading: () => entry,
  error: (_, __) => entry,
);
```

## Day 5 总结

今天的工作量不小，但效果立竿见影：

### 功能开发
1. ✅ **每日提醒功能**：用户可以设定时间，准时收到本地推送
2. ✅ **深色模式**：眼睛终于舒服了，晚上写日记不再刺眼
3. ✅ **主题切换 UI**：三种模式任选（跟随系统/浅色/深色），设置即时生效

### 页面开发与改造
4. ✅ **首页 (HomePage)**：毛玻璃吸顶 Header、日记卡片列表、空状态处理
5. ✅ **时间轴页 (TimelinePage)**：按年份分组、虚线连接绘制、年份吸顶
6. ✅ **统计页 (StatisticsPage)**：`table_calendar` 日历、有日记日期标记、日记预览
7. ✅ **新增日记页 (CalendarAddPage)**：纯文本输入（移除富文本）、封面上传、心情选择
8. ✅ **日记详情页 (DiaryDetailPage)**：沉浸式透明 AppBar、删除确认、实时同步

### 踩坑总结
- `flutter_local_notifications` v10→v20 API 大改，命名参数 + 删除 `uiLocalNotificationDateInterpretation`
- `flutter_timezone` 返回 `TimezoneInfo` 对象，需要 `.identifier` 才是字符串
- Android 通知权限要在 Manifest 显式声明，iOS 要运行时请求
- 全局服务（如通知）要在 `main()` 里 `runApp` 之前初始化
- 深色模式适配是个体力活，改了十几个文件，但用户体验提升明显
- `SliverPersistentHeaderDelegate.shouldRebuild` 要返回 `true` 才能响应主题变化

### 技术栈回顾
- **状态管理**：Riverpod (`StateNotifierProvider`)
- **路由**：go_router (`StatefulShellRoute` 保持 Tab 状态)
- **存储**：Supabase (Auth + Database + Storage)
- **本地持久化**：SharedPreferences (主题偏好)
- **UI 组件**：`table_calendar`、`image_picker`、`flutter_smart_dialog`

**明日预告**：
继续优化 UI 细节，可能加个搜索功能？
