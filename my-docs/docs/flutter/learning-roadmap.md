# Flutter 进阶学习路线大纲 (Day 19 ~ Day 31)

> 基于已完成 Day 1~18 的知识体系，以下为后续学习大纲。

---

## 第一梯队：实战必备 🔥

### Day 19：列表性能优化——下拉刷新 + 上拉加载 + 分页

1. **ListView vs ListView.builder vs ListView.separated** — 何时用哪个
2. **RefreshIndicator** — 下拉刷新（对标前端 pull-to-refresh）
3. **ScrollController + 上拉加载更多** — 监听滚动到底触发加载
4. **分页数据模型设计** — `PagedState<T>`（page / hasMore / items）
5. **Riverpod + Repository 分页整合** — `AsyncNotifier` 管理分页状态
6. **Sliver 系列组件** — SliverList / SliverGrid / SliverAppBar 组合布局
7. **常见优化** — `const` 构造、`itemExtent` 固定高度、`AutomaticKeepAlive`

---

### Day 20：国际化 (i18n) 与多语言

1. **Flutter 内置 i18n 方案** — `flutter_localizations` + `intl`
2. **ARB 文件结构** — 类似前端 `i18n/zh.json` 的资源文件
3. **代码生成** — `flutter gen-l10n` 自动生成 `AppLocalizations`
4. **动态切换语言** — Riverpod 管理 Locale 状态
5. **复数/性别/日期格式化** — ICU 消息语法
6. **第三方方案对比** — `easy_localization` vs `slang` vs 官方方案

---

### Day 21：图片处理——拍照/相册/裁剪/压缩/上传

1. **image_picker** — 调用相机/相册（对标 `<input type="file">`）
2. **image_cropper** — 图片裁剪（对标 `cropperjs`）
3. **flutter_image_compress** — 压缩图片（减小上传体积）
4. **权限申请** — `permission_handler` 处理相机/相册权限
5. **上传到 Supabase Storage** — 文件流 + 进度监听
6. **图片缓存** — `cached_network_image` 优化加载体验
7. **完整流程串联** — 拍照 → 裁剪 → 压缩 → 上传 → 显示

---

## 第二梯队：进阶提升 ⭐

### Day 22：地图与定位

1. **大厂原生 SDK 避坑** — 为什么体积暴增与编译报错频发
2. **flutter_map 核心原理** — 纯 Dart 瓦片 (Tile) 地图渲染逻辑
3. **免费瓦片源实战** — 组合高德/天地图 Web 瓦片与 Widget Marker
4. **geolocator** — 获取经纬度坐标与权限动态申请

---

### Day 23：原生硬件与生物识别 (Face ID / 传感器)

1. **local_auth** — 调用苹果 Face ID / Touch ID 与安卓指纹识别
2. **硬件支持检验** — 检查设备安全域状态（如是否录入指纹）
3. **震动与触觉反馈** — `haptic_feedback` 系统级震动（对标 `navigator.vibrate`）
4. **传感器接入** — `sensors_plus` 处理陀螺仪、加速度计
5. **设备特征收集** — `device_info_plus` 获取系统版本、设备型号

---

### Day 24：平台通道 (Platform Channel)

1. **MethodChannel** — Dart↔原生双向通信（对标 JSBridge）
2. **EventChannel** — 原生向 Dart 推送事件流
3. **实战：调用原生分享** — iOS `UIActivityViewController` / Android `Intent`
4. **Pigeon 代码生成** — 类型安全的通道通信
5. **常见场景** — 获取底层受保护状态、原生组件内嵌

---

### Day 25：App 生命周期与后台任务

1. **AppLifecycleState** — resumed/inactive/paused/detached（对标 `visibilitychange`）
2. **WidgetsBindingObserver** — 监听生命周期回调
3. **后台任务** — `workmanager` 定期后台同步数据
4. **前后台切换场景** — 隐私遮罩、重连 WebSocket、刷新 Token
5. **isolate** — Dart 的多线程模型（对标 Web Worker）

---

### Day 26：CI/CD 与发布流程

1. **Flutter 构建命令** — `flutter build apk` / `flutter build ipa`
2. **签名配置** — Android keystore / iOS Provisioning Profile
3. **GitHub Actions** — 自动化构建 + 产物上传
4. **Fastlane** — 自动化发布到 App Store / Google Play
5. **版本管理** — 语义化版本 + `pubspec.yaml` 版本号策略
6. **环境分离** — dev / staging / prod 多环境配置（`--dart-define`）

---

### Day 27：WebSocket + 实时通信

1. **web_socket_channel** — 建立持久连接
2. **心跳 + 断线重连** — 保活机制
3. **StreamProvider 集成** — Riverpod 消费 WebSocket 消息流
4. **实战：简易聊天** — 消息收发 + 本地持久化 + 列表滚动

---

## 第三梯队：锦上添花 🌟

### Day 28：性能调优 (DevTools)

1. **Flutter DevTools** — Performance / Memory / Network 面板
2. **常见卡顿原因** — build 耗时、频繁 setState、不必要的重建
3. **const 构造 + RepaintBoundary + 缓存策略**
4. **Riverpod select** — 精细化监听，减少 rebuild 范围
5. **Tree Shaking + 包体积分析** — `flutter build --analyze-size`

---

### Day 29：WebView 深度实战

1. **webview_flutter** — 官方插件核心用法与生命周期
2. **JSBridge 通信** — `JavaScriptChannel` 实现 Dart 与 Web 双向互调
3. **加载体验优化** — 进度条监听、资源预加载、错误页面自定义
4. **Cookie 与 Header 管理** — 处理登录态同步与持久化
5. **flutter_inappwebview** — 为什么复杂场景推荐使用第三方增强版
6. **混合滚动冲突** — 解决 WebView 嵌套在 ListView 中的手势竞争问题

---

### Day 30：高级 UI——CustomPainter 与 Canvas 绘图

1. **渲染原理浅析** — 为什么需要 CustomPainter？（对标 CSS Canvas/SVG）
2. **Paint 对象** — 颜色、线宽、渐变、混合模式设置
3. **Canvas 核心 API** — `drawRect`, `drawCircle`, `drawPath`（贝塞尔曲线）
4. **性能陷阱** — 如何避免 `shouldRepaint` 导致的无效重绘
5. **实战：贝塞尔曲线背景** — 为“我的”页面绘制一个丝滑的波浪 Header
6. **动画结合** — 让波浪动起来（AnimationController + Painter）

---

> **学习建议**：按日逐个攻破，每天专注一个主题。每个 Day 的代码都落地到项目 `lib/pages/` 中做成 Demo 页面，积累成你自己的组件库 📦

---

---

# Flutter 深入学习路线大纲 (Day 31 ~ Day 38)

> 基于已完成 Day 1~30 的知识体系，以下为进阶包与实战能力补全。

---

## 第四梯队：代码生成与工程化 🏗️

### Day 31：Model 代码生成——freezed + json_serializable

1. **为什么需要代码生成** — 手写 `copyWith` / `toJson` / `fromJson` 的痛点
2. **json_serializable 基础** — `@JsonSerializable()` 注解 + `build_runner` 生成
3. **freezed 核心用法** — `@freezed` 不可变数据类 + 联合类型（Union Types）
4. **与 Riverpod 结合** — freezed State 作为 `AsyncNotifier` 状态类型
5. **嵌套对象序列化** — `@JsonKey` 自定义字段映射、默认值、嵌套转换
6. **迁移现有 Model** — 将项目中 `lib/models/` 的手写类逐步迁移到 freezed
7. **常用包**：`freezed_annotation` / `freezed` / `json_serializable` / `json_annotation`

---

### Day 32：网络请求进阶——Retrofit 声明式 API

1. **Retrofit 核心概念** — 注解式定义 API 接口（对标前端 axios 封装）
2. **常用注解** — `@GET` / `@POST` / `@PUT` / `@DELETE` / `@Part` 文件上传
3. **与 Dio 的协作** — Retrofit 底层依赖 Dio，拦截器/Token 注入保持不变
4. **代码生成流程** — `@RestApi()` + `build_runner` 自动生成实现类
5. **与 freezed 联动** — 请求返回的 Model 用 freezed 定义，自动反序列化
6. **Repository 层重构** — 将项目中现有的手写请求逐步迁移到 Retrofit
7. **常用包**：`retrofit` / `retrofit_generator`

---

## 第五梯队：推送与链接 📲

### Day 33：远程推送通知

1. **推送原理** — APNs (iOS) / FCM (Android) 工作流程
2. **firebase_messaging** — FCM 集成（全球方案，海外 App 首选）
3. **jpush_flutter** — 极光推送（国内方案，兼容华为/小米/OPPO 等厂商通道）
4. **与本地通知互补** — `flutter_local_notifications` 处理前台消息展示
5. **通知点击跳转** — 结合 GoRouter 实现消息 → 指定页面
6. **角标/分组/静默推送** — 进阶用法

---

### Day 34：图表可视化——fl_chart

1. **折线图 (LineChart)** — 数据趋势展示（适配 `statistics/` 统计页面）
2. **柱状图 (BarChart)** — 分类数据对比
3. **饼图 (PieChart)** — 占比分析
4. **交互手势** — 触摸高亮、Tooltip 弹出数据详情
5. **数据驱动渲染** — Riverpod 管理图表数据 + 动态刷新
6. **常用包**：`fl_chart`

---

## 第六梯队：可视化与动效 🎨

### Day 35：深链接与 App 内更新

1. **Deep Link 原理** — Universal Links (iOS) / App Links (Android) 配置
2. **app_links 包** — 监听外部 URL 打开 App 事件
3. **GoRouter 深链接集成** — `redirect` 中处理入站链接跳转
4. **App 版本检测** — `package_info_plus` 获取当前版本号
5. **应用内更新引导** — `upgrader` 弹窗提示新版本下载
6. **常用包**：`app_links` / `package_info_plus` / `upgrader`

---

### Day 36：Lottie 动画与骨架屏

1. **Lottie 原理** — 设计师导出 JSON 动画，App 端播放（对标前端 `lottie-web`）
2. **lottie 包核心用法** — `Lottie.asset()` / `Lottie.network()` + 控制器
3. **动画事件监听** — 播放完成回调、帧控制、循环/单次配置
4. **骨架屏 (Shimmer)** — 列表加载时的闪光占位动画
5. **空状态/错误状态动画** — 用 Lottie 替代静态图标提升体验
6. **常用包**：`lottie` / `shimmer`

---

## 第七梯队：实用工具箱 🧰

### Day 37：常用工具包 (一) —— 矢量图、网络与设备信息

1. **`flutter_svg`** — SVG 矢量图标支持（配合 flutter_gen 自动生成引用）
2. **`connectivity_plus`** — 网络连接状态监听（WiFi / 移动数据 / 无网络）
3. **`device_info_plus`** — 获取设备型号、系统版本信息

---

### Day 38：常用工具包 (二) —— 扫码、下载与分享

1. **`qr_flutter`** — 生成二维码 Widget
2. **`mobile_scanner`** — 扫描二维码 / 条形码
3. **`flutter_downloader`** — 文件下载 + 通知栏进度条
4. **`share_plus`** — 系统分享（文本/图片/文件）

---

> **⚠️ 注意事项**：
>
> - 项目中使用的 `isar` 已停止维护，建议逐步迁移到 `hive_ce`（轻量 KV 存储）或 `drift`（SQLite ORM）
> - `pubspec.yaml` 中已注释的 `retrofit` / `retrofit_generator` 可在 Day 32 正式启用
> - `flutter_gen` 配置中 `flutter_svg` 改为 `true` 即可启用 SVG 支持

> **学习建议**：延续之前的节奏，每日一主题。优先攻克 **Day 31~32（代码生成）**，能显著提升后续开发效率 🚀

---

## 第八梯队：UI 增强与交互体验 🎯

### Day 39：列表侧滑操作——flutter_slidable

1. **flutter_slidable 核心概念** — 列表项侧滑操作（对标 iOS 原生列表）
2. **基础用法** — `Slidable` Widget 包裹列表项
3. **侧滑动作配置** — `ActionPane` 定义删除/编辑/置顶操作
4. **动画效果** — Slide / Drawer / Behind 三种展开模式
5. **与 ListView.builder 结合** — 实战：待办事项侧滑删除
6. **手势冲突处理** — 与页面滑动返回的协调
7. **常用包**：`flutter_slidable`

---

### Day 40：瀑布流布局——flutter_staggered_grid_view

1. **瀑布流原理** — 不规则网格布局（Pinterest / 小红书风格）
2. **flutter_staggered_grid_view 核心用法** — `MasonryGridView` / `StaggeredGrid`
3. **动态高度计算** — 根据内容自适应高度
4. **与图片加载结合** — `cached_network_image` 优化加载体验
5. **性能优化** — `itemExtent` 预估高度、懒加载
6. **实战场景** — 图片墙、商品列表、内容流
7. **常用包**：`flutter_staggered_grid_view`

---

---

### Day 41：轻量级 Toast 与角标

1. **fluttertoast** — 轻量级 Toast（Android 原生风格）
2. **位置配置** — 顶部/中间/底部显示
3. **对比 SnackBar** — 何时用 Toast / SnackBar / Dialog
4. **badges 包** — 角标提示（购物车数量、未读消息红点）
5. **角标位置** — 右上角、自定义偏移
6. **动态更新角标** — Riverpod 管理未读数量
7. **常用包**：`fluttertoast` / `badges`

---

### Day 42：表单增强——评分与虚线边框

1. **flutter_rating_bar** — 星级评分组件（商品评价、用户反馈）
2. **自定义图标** — 用 SVG/图片替代默认星星
3. **半星支持** — `allowHalfRating` 精细化评分
4. **只读模式** — 展示评分结果（不可交互）
5. **dotted_border** — 虚线边框（文件上传区域、占位框）
6. **自定义虚线样式** — 间距、圆角、颜色
7. **常用包**：`flutter_rating_bar` / `dotted_border`

---

### Day 43：增强版下拉刷新——pull_to_refresh

1. **pull_to_refresh 核心优势** — 比 `RefreshIndicator` 更强大
2. **自定义 Header** — 替换默认的 CircularProgressIndicator
3. **自定义 Footer** — 上拉加载更多的样式定制
4. **刷新状态管理** — 成功/失败/无更多数据
5. **与 Riverpod 结合** — 触发数据重新加载
6. **实战场景** — 新闻列表、社交动态、商品列表
7. **常用包**：`pull_to_refresh`

---
### Day 44：图片上传——腾讯云 COS 实战
1. **腾讯云 COS 准备** — 创建存储桶、获取 SecretId/SecretKey/AppId
2. **SDK 集成** — 推荐使用 `tencent_cos_plus` 或通过 Dio 手动调用 XML API
3. **上传策略** — 客户端固定密钥（仅限测试） vs 服务端预签名/STS 临时授权
4. **单文件上传** — `cos.putObject` 接口调用与路径规划
5. **上传进度监听** — 结合 `onProgress` 实现进度条（与 Day 21 联动）
6. **常见优化** — 分块上传（大文件）、图片处理参数、CDN 域名绑定
7. **常用包**：`tencent_cos_plus` / `dio` / `crypto`

## 第九梯队：数据处理与工具类 🛠️

### Day 44：日期格式化——intl 深度使用

1. **intl 包核心功能** — 国际化工具集（不仅是 i18n）
2. **DateFormat 日期格式化** — `yyyy-MM-dd HH:mm:ss` 自定义格式
3. **多语言日期** — 结合 i18n 显示本地化日期（中文"2026年3月"）
4. **常用格式模板** — `yMd()` / `jm()` / `yMMMMd()` 快速格式化
5. **解析字符串为日期** — `DateFormat.parse()` 反向转换
6. **实战场景** — 表单日期选择、列表时间显示、图表横轴
7. **常用包**：`intl`

---

### Day 45：货币与数字格式化

1. **NumberFormat 数字格式化** — 千分位、小数位控制
2. **货币格式化** — `NumberFormat.currency()` 显示 `¥1,234.56`
3. **百分比格式化** — `NumberFormat.percentPattern()` 显示 `85.5%`
4. **紧凑数字** — `NumberFormat.compact()` 显示 `1.2K` / `3.5M`
5. **实战场景** — 商品价格、统计数据、金融应用
6. **常用包**：`intl`

---

### Day 46：相对时间显示——timeago

1. **timeago 包核心用法** — 相对时间显示（"刚刚" / "3分钟前"）
2. **多语言支持** — 中文/英文/日文等语言包
3. **自定义时间阈值** — 何时显示"刚刚"、何时显示具体时间
4. **与 DateTime 结合** — 计算时间差
5. **实战场景** — 聊天消息时间、动态发布时间、评论时间
6. **常用包**：`timeago`

---

### Day 47：时区处理

1. **timezone 包** — 处理跨时区场景
2. **时区转换** — UTC ↔ 本地时区 ↔ 指定时区
3. **夏令时处理** — 自动处理 DST 变化
4. **实战场景** — 全球化应用、会议预约、航班时间
5. **常用包**：`timezone`

---

### Day 48：加密基础——crypto 包

1. **crypto 包核心功能** — MD5 / SHA-1 / SHA-256 哈希计算
2. **密码加密** — 登录密码加盐哈希（不要明文传输）
3. **文件校验** — 下载文件完整性验证（MD5 校验）
4. **HMAC 签名** — API 请求签名验证
5. **实战场景** — 密码加密、文件上传校验、Token 签名
6. **常用包**：`crypto`

---

### Day 49：UUID 与对称加密

1. **uuid 包** — 生成唯一标识符（UUID v1/v4/v5）
2. **使用场景** — 本地数据临时 ID、请求追踪 ID、文件命名
3. **encrypt 包** — AES 对称加密（敏感数据本地存储）
4. **加密流程** — 密钥生成 → 加密 → 解密
5. **实战场景** — 本地敏感信息加密、离线数据保护
6. **常用包**：`uuid` / `encrypt`

---

### Day 50：文件选择——file_picker

1. **file_picker 核心用法** — 选择任意类型文件（PDF / Word / Excel / ZIP）
2. **文件类型过滤** — `allowedExtensions` 限制可选格式
3. **单文件 vs 多文件** — `allowMultiple` 批量上传
4. **获取文件信息** — 文件名、大小、路径、字节流
5. **权限处理** — 存储权限申请（Android）
6. **实战场景** — 上传附件、导入数据、选择头像
7. **常用包**：`file_picker`

---

### Day 51：路径管理——path_provider

1. **path_provider 核心功能** — 获取系统目录路径
2. **目录类型详解** — 临时目录 / 文档目录 / 缓存目录 / 外部存储
3. **平台差异** — iOS / Android 目录结构对比
4. **文件操作** — 结合 `dart:io` 读写文件
5. **实战：文件缓存管理** — 计算缓存大小 + 一键清理
6. **实战场景** — 下载文件保存、日志文件、离线数据
7. **常用包**：`path_provider`

---

## 第十梯队：媒体与硬件 🎬

### Day 52：视频播放基础——video_player

1. **video_player 官方包** — Flutter 官方视频播放器
2. **基础播放控制** — 播放/暂停/进度条/音量
3. **VideoPlayerController** — 初始化、监听、释放
4. **网络视频 vs 本地视频** — `network()` / `asset()` / `file()`
5. **播放状态监听** — 缓冲、播放中、暂停、错误
6. **实战场景** — 视频详情页、短视频列表
7. **常用包**：`video_player`

---

### Day 53：增强视频播放器——chewie

1. **chewie 包** — 增强版视频播放器（基于 video_player）
2. **Material/Cupertino 风格** — 自动适配平台控制栏
3. **全屏支持** — 横屏全屏播放
4. **自定义控制栏** — 自定义按钮、进度条样式
5. **字幕支持** — 加载 SRT/VTT 字幕文件
6. **实战场景** — 在线课程、视频教程、直播回放
7. **常用包**：`chewie`

---

### Day 54：音频播放——audioplayers

1. **audioplayers 核心用法** — 音频播放（背景音乐、音效、语音消息）
2. **播放模式** — 单曲循环、列表循环、随机播放
3. **播放状态管理** — 播放/暂停/停止/跳转
4. **多音频实例** — 同时播放多个音效
5. **后台播放** — 锁屏后继续播放（需配置原生权限）
6. **实战场景** — 音乐播放器、语音消息、游戏音效
7. **常用包**：`audioplayers`

---

### Day 55：截图生成——screenshot

1. **screenshot 包核心原理** — 将 Widget 转为图片
2. **ScreenshotController** — 控制截图时机
3. **RepaintBoundary** — 标记需要截图的区域
4. **图片格式** — PNG / JPEG，质量控制
5. **实战：生成分享海报** — 用户信息 + 二维码 → 截图
6. **常用包**：`screenshot`

---

### Day 56：图片保存与分享

1. **image_gallery_saver** — 保存图片到系统相册
2. **权限处理** — 相册写入权限申请
3. **share_plus** — 系统分享面板（文本/图片/文件）
4. **分享类型** — 纯文本 / 图片 / 文件 / 多文件
5. **实战流程** — 截图 → 保存相册 → 分享到社交平台
6. **常用包**：`image_gallery_saver` / `share_plus`

---

### Day 57：二维码生成——qr_flutter

1. **qr_flutter 核心用法** — 生成二维码 Widget
2. **自定义样式** — 颜色、背景色、圆角
3. **Logo 嵌入** — 中心嵌入品牌 Logo
4. **容错级别** — L / M / Q / H 四档（影响可识别性）
5. **实战场景** — 支付码、分享链接、电子票券
6. **常用包**：`qr_flutter`

---

### Day 58：二维码扫描——mobile_scanner

1. **mobile_scanner 核心用法** — 扫描二维码 / 条形码
2. **相机预览** — `MobileScanner` Widget 显示相机画面
3. **扫码结果处理** — URL 跳转、添加好友、核销订单
4. **权限处理** — 相机权限申请与拒绝提示
5. **手电筒控制** — 暗光环境下开启闪光灯
6. **实战场景** — 扫码登录、扫码支付、扫码添加好友
7. **常用包**：`mobile_scanner`

---

## 第十一梯队：网络与连接状态 �

### Day 59：网络状态监听——connectivity_plus

1. **connectivity_plus 核心功能** — 监听网络连接状态
2. **连接类型** — WiFi / 移动数据 / 以太网 / 蓝牙 / 无网络
3. **实时状态流** — `Stream<ConnectivityResult>` 监听网络变化
4. **离线提示 UI** — 顶部横幅提示"网络已断开"
5. **与 Riverpod 结合** — 全局网络状态管理
6. **实战场景** — 离线模式切换、网络异常提示
7. **常用包**：`connectivity_plus`

---

### Day 60：离线数据处理

1. **离线缓存策略** — 结合 Isar/Hive 实现离线可用
2. **网络恢复后同步** — 自动重试失败请求
3. **离线队列** — 本地存储待上传数据
4. **冲突解决** — 离线修改与服务器数据冲突处理
5. **实战场景** — 聊天消息离线缓存、表单离线提交
6. **常用包**：`connectivity_plus` + `isar` / `hive`

---

### Day 61：文件下载——flutter_downloader

1. **flutter_downloader 核心功能** — 后台下载 + 通知栏进度条
2. **下载任务管理** — 暂停/恢复/取消/重试
3. **下载进度监听** — 实时更新 UI 进度条
4. **文件保存位置** — 结合 `path_provider` 选择存储目录
5. **实战场景** — PDF 报告下载、APK 更新包下载
6. **常用包**：`flutter_downloader`

---

### Day 62：打开下载文件——open_file

1. **open_file 包** — 调用系统应用打开文件
2. **支持文件类型** — PDF / Word / Excel / 图片 / 视频等
3. **与下载结合** — 下载完成后自动打开
4. **错误处理** — 无对应应用时的提示
5. **实战场景** — 打开下载的文档、查看下载的图片
6. **常用包**：`open_file`

---

## 第十二梯队：高级场景 🚀

### Day 63：应用内购买与支付

1. **in_app_purchase** — iOS / Android 统一内购接口
2. **商品查询** — 从 App Store / Google Play 获取商品信息
3. **购买流程** — 发起购买 → 验证收据 → 发放权益
4. **订阅管理** — 自动续费、取消订阅、恢复购买
5. **收据验证** — 后端验证防止伪造（Supabase Edge Function）
6. **常用包**：`in_app_purchase`

---

### Day 64：蓝牙与 IoT 设备

1. **flutter_blue_plus** — 蓝牙设备扫描与连接
2. **BLE 通信** — 读写特征值（Characteristic）
3. **设备状态管理** — 连接/断开/重连逻辑
4. **实战场景** — 智能手环、蓝牙打印机、IoT 传感器
5. **常用包**：`flutter_blue_plus`

---

### Day 65：PDF 生成与打印

1. **pdf 包** — 纯 Dart 生成 PDF 文档
2. **布局组件** — `pw.Container` / `pw.Text` / `pw.Table`（类似 Flutter Widget）
3. **中文字体支持** — 嵌入 TTF 字体文件
4. **printing 包** — 预览 + 打印 + 分享 PDF
5. **实战：生成报表** — 订单详情 → PDF → 打印/分享
6. **常用包**：`pdf` / `printing`

---

### Day 66：启动优化与原生启动屏

1. **flutter_native_splash** — 自动生成原生启动屏（替代白屏）
2. **配置文件** — `flutter_native_splash.yaml` 定义背景色/图片
3. **启动时间优化** — 延迟初始化、异步加载、预加载关键数据
4. **启动页过渡** — 从原生启动屏到 Flutter 首页的平滑衔接
5. **常用包**：`flutter_native_splash`

---

### Day 67：键盘与输入体验优化

1. **flutter_keyboard_visibility** — 键盘显隐监听
2. **自动调整布局** — 键盘弹起时避免遮挡输入框
3. **焦点管理** — `FocusNode` 控制输入框焦点切换
4. **输入法优化** — `TextInputAction` 配置键盘回车键行为
5. **实战场景** — 聊天输入框、表单填写、搜索框
6. **常用包**：`flutter_keyboard_visibility`

---

## 第十三梯队：调试与监控 �

### Day 68：日志美化——logger

1. **logger 包核心功能** — 美化日志输出（彩色分级、堆栈追踪）
2. **日志级别** — trace / debug / info / warning / error / fatal
3. **自定义输出格式** — 时间戳、调用位置、方法名
4. **日志过滤** — 生产环境关闭 debug 日志
5. **实战：全局 Logger 单例** — 统一日志管理
6. **常用包**：`logger`

---

### Day 69：环境变量管理——flutter_dotenv

1. **flutter_dotenv 核心用法** — 环境变量管理（`.env` 文件）
2. **多环境配置** — `.env.dev` / `.env.staging` / `.env.prod`
3. **加载环境变量** — `dotenv.load()` 初始化
4. **读取变量** — `dotenv.env['API_URL']` 获取配置
5. **实战：环境切换面板** — Debug 模式下显示环境选择器
6. **安全注意** — `.env` 文件不要提交到 Git
7. **常用包**：`flutter_dotenv`

---

### Day 70：网络日志美化——pretty_dio_logger

1. **pretty_dio_logger** — Dio 请求日志美化（开发环境必备）
2. **作为 Dio 拦截器** — 添加到 `interceptors` 列表
3. **日志内容** — 请求 URL、Headers、Body、响应数据、耗时
4. **配置选项** — 控制是否打印 Headers / Body / 错误信息
5. **生产环境关闭** — 仅在 Debug 模式启用
6. **实战场景** — 调试 API 接口、排查请求问题
7. **常用包**：`pretty_dio_logger`

---

### Day 71：崩溃收集——sentry_flutter 基础

1. **sentry_flutter 核心功能** — 崩溃日志收集与性能监控
2. **初始化配置** — DSN 配置、环境标识（dev/prod）
3. **自动捕获异常** — Flutter 框架异常、Dart 未捕获异常
4. **手动上报** — `Sentry.captureException()` 捕获业务异常
5. **用户信息绑定** — 关联用户 ID、邮箱、设备信息
6. **实战场景** — 生产环境崩溃监控
7. **常用包**：`sentry_flutter`

---

### Day 72：性能监控——sentry_flutter 进阶

1. **性能追踪** — `startTransaction` 监控关键操作耗时
2. **面包屑 (Breadcrumbs)** — 记录用户操作路径辅助定位问题
3. **自定义标签** — 为事件添加业务标签（页面、功能模块）
4. **采样率配置** — 控制上报频率（避免流量浪费）
5. **Source Maps** — 混淆代码的堆栈还原
6. **实战场景** — 监控页面加载耗时、API 请求耗时
7. **常用包**：`sentry_flutter`

---

### Day 73：Firebase 崩溃分析——firebase_crashlytics

1. **firebase_crashlytics** — Firebase 崩溃分析（与 FCM 配套）
2. **初始化配置** — 集成 Firebase SDK
3. **自动崩溃上报** — 原生崩溃 + Flutter 异常
4. **自定义日志** — `log()` 记录关键操作
5. **非致命异常上报** — `recordError()` 上报已处理异常
6. **对比 Sentry** — 何时用 Crashlytics / 何时用 Sentry
7. **常用包**：`firebase_crashlytics`

---

## 第十三梯队：动画与视觉效果 ✨

### Day 74：Lottie 动画基础

1. **Lottie 原理** — 设计师导出 JSON 动画，App 端播放（对标前端 `lottie-web`）
2. **lottie 包核心用法** — `Lottie.asset()` / `Lottie.network()`
3. **动画资源管理** — 本地 assets / 网络加载 / 缓存策略
4. **基础播放控制** — 自动播放、循环播放、单次播放
5. **实战场景** — 启动动画、空状态页面、成功/失败提示
6. **常用包**：`lottie`

---

### Day 75：Lottie 动画进阶控制

1. **AnimationController 集成** — 精确控制动画播放
2. **动画控制** — 播放/暂停/倒放/指定帧跳转
3. **动画事件监听** — 播放完成回调、进度监听
4. **动态替换颜色** — 修改 Lottie 动画中的颜色值
5. **性能优化** — 预加载、复杂动画降级、内存管理
6. **实战场景** — 加载动画、引导动画、交互反馈
7. **常用包**：`lottie`

---

### Day 76：骨架屏——shimmer

1. **shimmer 包核心原理** — 闪光骨架屏动画
2. **自定义骨架形状** — 圆形头像、矩形卡片、文本行组合
3. **与真实 UI 对齐** — 骨架屏布局与实际内容保持一致
4. **渐变方向** — 左到右、上到下、自定义角度
5. **加载策略** — 首次加载显示骨架屏，后续加载显示 Loading
6. **实战场景** — 列表加载、详情页加载、首页数据加载
7. **常用包**：`shimmer`

---

### Day 77：自动骨架屏——skeletonizer

1. **skeletonizer 包** — 自动生成骨架屏（基于真实 Widget 结构）
2. **零配置使用** — 包裹现有 Widget 自动转为骨架屏
3. **智能识别** — 自动识别文本、图片、容器并生成占位
4. **自定义配置** — 控制哪些元素显示骨架效果
5. **与数据加载结合** — `isLoading` 状态切换
6. **对比 shimmer** — 何时用自动生成、何时手动定制
7. **常用包**：`skeletonizer`

---

## 第十四梯队：进阶业务场景 🚀

### Day 78：应用内购买基础——in_app_purchase

1. **in_app_purchase** — iOS / Android 统一内购接口
2. **商品查询** — 从 App Store / Google Play 获取商品信息
3. **商品类型** — 消耗型 / 非消耗型 / 订阅型
4. **购买流程** — 发起购买 → 等待结果 → 处理回调
5. **实战场景** — 会员订阅、虚拟货币购买
6. **常用包**：`in_app_purchase`

---

### Day 79：应用内购买进阶——收据验证

1. **收据验证原理** — 防止伪造购买（必须后端验证）
2. **iOS 收据验证** — App Store Server API
3. **Android 收据验证** — Google Play Developer API
4. **Supabase Edge Function** — 实现收据验证接口
5. **订阅管理** — 自动续费、取消订阅、恢复购买
6. **实战流程** — 购买 → 上传收据 → 后端验证 → 发放权益
7. **常用包**：`in_app_purchase`

---

### Day 80：蓝牙设备扫描——flutter_blue_plus

1. **flutter_blue_plus 核心功能** — 蓝牙设备扫描与连接
2. **扫描蓝牙设备** — `startScan()` 发现周边设备
3. **设备信息** — 设备名称、MAC 地址、信号强度
4. **权限处理** — 蓝牙权限、定位权限（Android 12+）
5. **实战场景** — 智能手环、蓝牙音箱、IoT 传感器
6. **常用包**：`flutter_blue_plus`

---

### Day 81：蓝牙通信——BLE 读写

1. **连接蓝牙设备** — `connect()` 建立连接
2. **服务与特征值** — Service / Characteristic 概念
3. **读写特征值** — `read()` / `write()` 与设备通信
4. **通知订阅** — `setNotifyValue()` 监听设备主动推送
5. **设备状态管理** — 连接/断开/重连逻辑
6. **实战场景** — 读取心率数据、控制智能灯泡
7. **常用包**：`flutter_blue_plus`

---

### Day 82：PDF 生成基础——pdf 包

1. **pdf 包核心原理** — 纯 Dart 生成 PDF 文档
2. **布局组件** — `pw.Container` / `pw.Text` / `pw.Row` / `pw.Column`
3. **样式控制** — 字体、颜色、对齐、边距
4. **分页处理** — `pw.Page` 多页文档
5. **实战：生成简单报表** — 文本 + 表格
6. **常用包**：`pdf`

---

### Day 83：PDF 生成进阶——中文与图表

1. **中文字体支持** — 嵌入 TTF 字体文件（解决中文乱码）
2. **表格布局** — `pw.Table` / `pw.TableHelper` 复杂表格
3. **图片嵌入** — 将 Flutter Widget 转为图片插入 PDF
4. **图表嵌入** — fl_chart 生成图表 → 截图 → 插入 PDF
5. **实战：生成订单详情 PDF** — 订单信息 + 商品列表 + 二维码
6. **常用包**：`pdf`

---

### Day 84：PDF 预览与打印——printing

1. **printing 包核心功能** — 预览 + 打印 + 分享 PDF
2. **预览 PDF** — `Printing.layoutPdf()` 显示预览界面
3. **打印 PDF** — 调用系统打印对话框
4. **分享 PDF** — 保存到文件 / 分享到其他应用
5. **实战流程** — 生成 PDF → 预览 → 打印/分享
6. **常用包**：`printing`

---

### Day 85：启动优化——flutter_native_splash

1. **flutter_native_splash** — 自动生成原生启动屏（替代白屏）
2. **配置文件** — `flutter_native_splash.yaml` 定义背景色/图片
3. **平台适配** — iOS / Android 不同分辨率适配
4. **启动页过渡** — 从原生启动屏到 Flutter 首页的平滑衔接
5. **实战：配置品牌启动屏** — Logo + 品牌色
6. **常用包**：`flutter_native_splash`

---

### Day 86：启动性能优化

1. **启动时间分析** — DevTools Timeline 分析启动耗时
2. **延迟初始化** — 非关键服务延后初始化（Sentry、Analytics）
3. **异步加载** — 首页数据异步加载，不阻塞渲染
4. **预加载关键数据** — Token 验证、用户信息提前加载
5. **启动流程优化** — 减少 `main()` 中的同步操作
6. **实战场景** — 优化冷启动时间到 2 秒内

---

### Day 87：键盘监听——flutter_keyboard_visibility

1. **flutter_keyboard_visibility** — 键盘显隐监听
2. **监听键盘状态** — `KeyboardVisibilityController` 获取当前状态
3. **Stream 监听** — 实时监听键盘弹起/收起事件
4. **自动调整布局** — 键盘弹起时避免遮挡输入框
5. **实战场景** — 聊天输入框、表单填写、搜索框
6. **常用包**：`flutter_keyboard_visibility`

---

### Day 88：焦点与输入法优化

1. **FocusNode 焦点管理** — 控制输入框焦点切换
2. **自动聚焦** — 页面打开时自动聚焦到输入框
3. **焦点切换** — 表单中按 Tab 键切换输入框
4. **TextInputAction** — 配置键盘回车键行为（下一项/完成/搜索）
5. **键盘类型** — 数字键盘、邮箱键盘、URL 键盘
6. **实战场景** — 多步骤表单、登录注册页面
7. **常用包**：无需额外包（Flutter 内置）

---

## 学习建议 💡

**优先级排序**（根据实战频率）：

1. **Day 39~43**（UI 增强）— 立即提升用户体验，高频使用 ⭐⭐⭐
2. **Day 44~51**（数据处理与文件）— 日常开发必备工具 ⭐⭐⭐
3. **Day 52~58**（媒体处理）— 内容型 App 必需 ⭐⭐
4. **Day 59~62**（网络与下载）— 生产环境常见需求 ⭐⭐
5. **Day 74~77**（动画效果）— 提升 App 品质感 ⭐⭐
6. **Day 68~73**（调试监控）— 生产环境必备 ⭐⭐⭐
7. **Day 78~88**（高级场景）— 按需学习 ⭐

**实践方式**：

- 每个 Day 在 `lib/pages/` 下创建独立 Demo 页面
- 在 `app_router.dart` 中注册路由
- 首页添加入口按钮方便测试
- 将常用工具类封装到 `lib/utils/` 中复用

**学习节奏建议**：

- **快速通道**：每天 1 个主题，2~3 小时实践（适合全职学习）
- **稳健通道**：每 2 天 1 个主题，深度理解 + 完整 Demo（适合业余学习）
- **按需学习**：根据项目需求跳跃式学习（实战驱动）

**包管理建议**：

- 优先使用官方维护的包（`flutter.dev/packages` 标注 Flutter Favorite）
- 查看包的 pub.dev 评分、最近更新时间、issue 数量
- 大型包（如地图、视频）注意对 App 体积的影响
- 使用 `flutter pub outdated` 定期检查依赖更新

---

> **🎯 完成 Day 1~88 后，你将具备独立开发中大型 Flutter 应用的完整能力！**
>
> **📊 学习进度参考**：
>
> - Day 1~18：基础夯实（已完成）✅
> - Day 19~38：实战进阶（核心能力）
> - Day 39~77：工具包精通（效率提升）
> - Day 78~88：生产就绪（专业能力）
