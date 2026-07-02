# Flutter 实战：使用 url_launcher 唤起手机默认地图 App

> 在很多 O2O、本地生活或者工具类 App 中，我们经常需要实现“导航到店”或“查看位置”的功能。与其自己在 App 里费时费力地集成完整的地图 SDK（高德、百度等），不如直接**唤起手机上已安装的地图 App**，既省事又丝滑！这就是广义上 Deep Link（深链接）和 URL Scheme 的一种典型应用。

## 🎯 今天要做什么？

在这篇实战中，我们将：
1. 检测用户的手机是否安装了常用的地图 App（高德、百度、腾讯地图、Apple Maps）。
2. 如果安装了，直接弹出一个底部菜单（BottomSheet），让用户选择用哪个地图导航。
3. 如果都没安装，退回到使用网页版地图或者系统默认地图。

---

## 🚀 开始动手！

### 第一步：添加依赖

唤起外部 App 最强大的工具就是官方提供的 `url_launcher` 包：

```yaml
dependencies:
  flutter:
    sdk: flutter
  url_launcher: ^6.2.5  # 用于打开自定义 URL Scheme
```

### 第二步：配置原生权限（必须！）

因为 iOS 9+ 和 Android 11+ 增加了包可见性的隐私限制，我们**必须在原生配置文件中声明我们要唤起的 App URL Scheme**，否则 `url_launcher` 会一直返回 `false`（检测不到已安装）。

#### 🍎 iOS 配置 (`ios/Runner/Info.plist`)
在 `<dict>` 标签内添加：
```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>iosamap</string> <!-- 高德地图 -->
    <string>baidumap</string> <!-- 百度地图 -->
    <string>qqmap</string> <!-- 腾讯地图 -->
</array>
```
*(注：Apple Maps 不需要声明，直接可以打开)*

#### 🤖 Android 配置 (`android/app/src/main/AndroidManifest.xml`)
在 `<manifest>` 根标签内（`<application>` 的外面）添加：
```xml
<queries>
    <!-- 高德地图 -->
    <package android:name="com.autonavi.minimap" />
    <!-- 百度地图 -->
    <package android:name="com.baidu.BaiduMap" />
    <!-- 腾讯地图 -->
    <package android:name="com.tencent.map" />
</queries>
```

---

## 🗺️ 核心逻辑：定义地图唤起工具类

我们要根据不同的地图 App 拼接不同的 URL 参数（经纬度、目的地名称等）。

```dart
import 'dart:io';
import 'package:url_launcher/url_launcher.dart';

class MapUtils {
  /// 打开高德地图导航
  static Future<bool> openAMap(double lat, double lon, String title) async {
    // 高德的 URL Scheme: iosamap://navi 或者 androidamap://navi
    final url = 'iosamap://path?sourceApplication=MyApp&dlat=$lat&dlon=$lon&dname=$title&dev=0&t=0';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri);
    }
    return false;
  }

  /// 打开百度地图导航
  static Future<bool> openBaiduMap(double lat, double lon, String title) async {
    final url = 'baidumap://map/direction?destination=name:$title|latlng:$lat,$lon&coord_type=gcj02&mode=driving&src=MyApp';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri);
    }
    return false;
  }

  /// 打开腾讯地图导航
  static Future<bool> openTencentMap(double lat, double lon, String title) async {
    final url = 'qqmap://map/routeplan?type=drive&to=$title&tocoord=$lat,$lon&referer=MyApp';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri);
    }
    return false;
  }

  /// 打开苹果自带地图 (仅限 iOS)
  static Future<bool> openAppleMap(double lat, double lon, String title) async {
    if (!Platform.isIOS) return false;
    final url = 'http://maps.apple.com/?daddr=$lat,$lon&dirflg=d';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri);
    }
    return false;
  }
}
```

---

## 🎨 UI 交互：弹窗让用户选择

当用户点击“导航”按钮时，我们弹出一个优雅的 `BottomSheet`：

```dart
import 'dart:io';
import 'package:flutter/material.dart';
// 引入上面的 MapUtils

class NavigateButton extends StatelessWidget {
  final double latitude = 39.9042; // 目的地纬度（北京）
  final double longitude = 116.4074; // 目的地经度
  final String destName = '天安门广场';

  const NavigateButton({super.key});

  void _showMapSelection(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16.0),
                child: Text('选择导航方式', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ),
              ListTile(
                leading: const Icon(Icons.map, color: Colors.blue),
                title: const Text('高德地图'),
                onTap: () async {
                  final success = await MapUtils.openAMap(latitude, longitude, destName);
                  if (!success) _showError(context, '未安装高德地图');
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.map, color: Colors.blueAccent),
                title: const Text('百度地图'),
                onTap: () async {
                  final success = await MapUtils.openBaiduMap(latitude, longitude, destName);
                  if (!success) _showError(context, '未安装百度地图');
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.map, color: Colors.green),
                title: const Text('腾讯地图'),
                onTap: () async {
                  final success = await MapUtils.openTencentMap(latitude, longitude, destName);
                  if (!success) _showError(context, '未安装腾讯地图');
                  Navigator.pop(context);
                },
              ),
              if (Platform.isIOS) // 仅 iOS 设备显示使用 Apple Maps
                ListTile(
                  leading: const Icon(Icons.apple, color: Colors.black),
                  title: const Text('Apple Maps'),
                  onTap: () async {
                    await MapUtils.openAppleMap(latitude, longitude, destName);
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  void _showError(BuildContext context, String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      onPressed: () => _showMapSelection(context),
      icon: const Icon(Icons.navigation),
      label: const Text('导航到目的地'),
      style: ElevatedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      ),
    );
  }
}
```

---

## 💡 开发心得与避坑指南

1. **`canLaunchUrl` 返回 false？** 
   - 99% 的情况是忘记配置 `Info.plist` (iOS) 或 `AndroidManifest.xml` (Android) 的包可见性规则（Queries）。不要忘了配置！
2. **坐标系转换问题！** 
   - 百度地图默认使用 `bd09` 坐标系，而高德、腾讯和苹果地图通常使用国家测绘局标准 `gcj02`（火星坐标系）。在上面的百度例子中，参数 `coord_type=gcj02` 非常重要，它告诉百度：“我传给你的是高德（火星）坐标，你帮我转一下”，这样才不会有定位偏差。
3. **更丝滑的体验** 
   - 你可以在弹窗前先用 `canLaunchUrl` 判断，如果用户只装了高德，就干脆别弹窗了，直接跳高德。如果一个都没装，可以作为兜底用 `url_launcher` 打开一个网页版的导航 URL。

## 🎉 总结

通过 `url_launcher` 配合特定的 URL Scheme，我们巧妙地将复杂的地图导航功能“外包”给了专业的第三方 App。这本质上就是 App 间使用 Deep Link 通信的绝佳案例！

试着把这段代码加入你的项目吧，只需几分钟，你的应用就能拥有成熟的导航功能！
