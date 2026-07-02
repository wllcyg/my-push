# 前端转 Flutter 笔记 (Day 21)：图片处理——拍照/相册/裁剪/压缩/上传 📸

![Flutter 图片处理](article_images/day21/01_hero_banner.png)

> **前言**：
> 在前端中，我们处理图片通常是 `<input type="file" accept="image/*">` 调起原生文件选择框，借用 Canvas API 或 `cropperjs` 裁剪，再使用 `canvas.toBlob()` 压缩，最后封装成 FormData 发并上传。
>
> 在 Flutter 中，前端的 "这一套连招" 对应着：**`permission_handler`** (权限) → **`image_picker`** (选择) → **`image_cropper`** (裁剪) → **`flutter_image_compress`** (压缩) → 上传至 **Supabase**。今天我们就来串联这个工业级的图片处理流程。

---

## 1. 核心依赖清单 📦

在开发完整的图片处理闭环前，我们需要准备好 5 款 "基建包" (`pubspec.yaml`)：

```yaml
dependencies:
  # 权限请求
  permission_handler: ^11.3.1
  # 相机与相册选择
  image_picker: ^1.2.1
  # 图片裁剪
  image_cropper: ^9.0.0
  # 图片压缩
  flutter_image_compress: ^2.4.0
  # 云端上传 (以 Supabase 为例)
  supabase_flutter: ^2.8.3
  # 图片网络缓存加载
  cached_network_image: ^3.4.1
```

> **⚡ 前端对比**：相当于由于运行在系统沙盒中，你不再是一个纯网页，所以你需要 `permission_handler` 来获取相册和摄像头，这在传统的 Web 环境是浏览器内建的安全提示，而在 Flutter 需要用代码精细控制。

---

## 2. 权限申请配置 🛡️

要调用相机和相册，必须要进行**原生系统级别的权限配置**，否则应用会直接闪退。

### 2.1 iOS 配置 (`ios/Runner/Info.plist`)

在 `<dict>` 内增加对应的配置，解释**为什么**要使用权限（上架审核非常严格，不写会被苹果拒绝）：

```xml
<!-- 照片权限 -->
<key>NSPhotoLibraryUsageDescription</key>
<string>我们需要访问您的相册以选择头像或上传图片</string>
<!-- 摄像头权限 -->
<key>NSCameraUsageDescription</key>
<string>我们需要访问您的相机以拍摄照片</string>
<!-- 麦克风权限（针对拍视频） -->
<key>NSMicrophoneUsageDescription</key>
<string>我们需要访问您的麦克风以录制视频声音</string>
```

### 2.2 Android 配置 (`android/app/src/main/AndroidManifest.xml`)

在 `<manifest>` 节点下添加：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<!-- Android 13+ 需要区分图片权限 -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

---

## 3. 调用相册与相机 (`image_picker`) 🖼️

`image_picker` 的作用就像前端的 `<input type="file">`。

```dart
import 'package:image_picker/image_picker.dart';

class ImageService {
  final ImagePicker _picker = ImagePicker();

  /// 从相册选择单张图片
  Future<XFile?> pickImageFromGallery() async {
    // 等价于 <input type="file" accept="image/*">
    return await _picker.pickImage(source: ImageSource.gallery);
  }

  /// 使用相机拍照
  Future<XFile?> takePhoto() async {
    // 等价于 <input type="file" accept="image/*" capture="camera">
    return await _picker.pickImage(source: ImageSource.camera);
  }
}
```

> **🎯 重点细节**：`XFile` 是跨平台文件抽象类，不直接等于原生系统的 `File`。如果要读取内容，可以使用 `await xfile.readAsBytes()` 获得 `Uint8List` (类似 `ArrayBuffer`)。

---

## 4. 图片裁剪 (`image_cropper`) ✂️

前端常用 `cropperjs` 或者 `vue-cropper` 实现图片的旋转、缩放比例裁剪。在 Flutter 中，有对应的 `image_cropper`。此插件会直接调起 Android 和 iOS 原生最底层的图片编辑界面，体验丝滑流畅。

```dart
import 'package:image_cropper/image_cropper.dart';

Future<CroppedFile?> cropImage(String imagePath) async {
  return await ImageCropper().cropImage(
    sourcePath: imagePath, // 待裁剪文件路径 (picker生成的路径)
    aspectRatioPresets: [
      CropAspectRatioPreset.square, // 强制 1:1 (适合头像)
      CropAspectRatioPreset.ratio16x9,
      CropAspectRatioPreset.original,
    ],
    uiSettings: [
      AndroidUiSettings(
        toolbarTitle: '图片裁剪',
        toolbarColor: Colors.deepOrange, // 定制原生的工具栏颜色
        toolbarWidgetColor: Colors.white,
        initAspectRatio: CropAspectRatioPreset.original,
        lockAspectRatio: false,
      ),
      IOSUiSettings(
        title: '裁剪',
        doneButtonTitle: '完成',
        cancelButtonTitle: '取消',
      ),
    ],
  );
}
```

---

## 5. 图片压缩 (`flutter_image_compress`) 🗜️

现在的手机像素极高，随手拍一张就是 10MB+。如果直接上传不但浪费带宽，也会让对象存储流量费用暴增！
前端通常用 Canvas `ctx.drawImage` 接着调 `.toBlob(..., 'image/jpeg', quality)` 压缩。Flutter 这边则需要调用底层 C++ 性能包来解决。

```dart
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';

Future<XFile?> compressImage(String filePath) async {
  // 获取临时目录用来存放压缩后的图片
  final tempDir = await getTemporaryDirectory();
  final targetPath = '${tempDir.path}/compressed_${DateTime.now().millisecondsSinceEpoch}.jpg';

  var result = await FlutterImageCompress.compressAndGetFile(
    filePath,
    targetPath,
    quality: 80,         // 压缩率
    minWidth: 1080,      // 缩放最大宽度
    minHeight: 1080,     // 缩放最大高度
    format: CompressFormat.jpeg,
  );

  return result; // 返回压缩后的文件
}
```

> **⚠️ 注意**：如果压缩后的文件比源文件还大 (尤其是在小文件场景下强制压缩 PNG 为 JPG 时)，你需要做一次安全检查，保留体积更小的那一份文件。

---

## 6. 上传与展示 (Supabase + CachedNetworkImage) ☁️

图片压缩完毕，我们最终将文件流扔给后端 / 对象存储 (这里以 Supabase Storage 为例)，上传完毕后拿到 URL 供前端使用 `cached_network_image` 进行展示。

### 6.1 上传到 Supabase Storage

```dart
import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<String?> uploadImage(File imageFile, String userId) async {
  try {
    // 构造唯一文件名
    final fileName = 'avatar_$userId.jpg';
    final filePath = 'avatars/$fileName';

    // 1. 调用 supabase storage 上传文件
    await Supabase.instance.client.storage
        .from('profiles') // bucket 名称
        .upload(
            filePath,
            imageFile,
            fileOptions: const FileOptions(cacheControl: '3600', upsert: true), // 覆盖同名
        );

    // 2. 获取公开访问链接
    final String publicUrl = Supabase.instance.client
        .storage
        .from('profiles')
        .getPublicUrl(filePath);

    return publicUrl;
  } catch (e) {
    print('上传失败: $e');
    return null;
  }
}
```

### 6.2 优雅加载与缓存展现

在 Flutter 中千万不要直接使用 `Image.network`！一是不带缓存机制，二是无法控制进场动画。
我们使用 `cached_network_image`：

```dart
import 'package:cached_network_image/cached_network_image.dart';

// UI 写法
CachedNetworkImage(
  imageUrl: userAvatarUrl, // 上传成功的公网 url
  imageBuilder: (context, imageProvider) => CircleAvatar(
    backgroundImage: imageProvider, // 映射到圆形头像上
    radius: 40,
  ),
  placeholder: (context, url) => const CircularProgressIndicator(), // 骨架屏或 Loading
  errorWidget: (context, url, error) => const Icon(Icons.error),    // 加载失败兜底
)
```

---

## 7. 完整连招串联 🎬

现在我们把前面的代码连起来，成为一个真正在项目里可以直接抄过去用的：**改头像功能**。

```dart
import 'dart:io';

Future<void> handleChangeAvatar() async {
  // 1. 选择图片
  final ImagePicker picker = ImagePicker();
  final XFile? pickedFile = await picker.pickImage(source: ImageSource.gallery);

  if (pickedFile == null) return; // 用户取消了选择

  // 2. 裁剪图片
  final croppedFile = await ImageCropper().cropImage(
    sourcePath: pickedFile.path,
    aspectRatioPresets: [CropAspectRatioPreset.square],
    uiSettings: [
      AndroidUiSettings(toolbarTitle: '裁剪头像', toolbarWidgetColor: Colors.white),
      IOSUiSettings(title: '裁剪头像'),
    ],
  );

  if (croppedFile == null) return; // 用户取消了裁剪

  // 3. 压缩图片
  final compressedFile = await compressImage(croppedFile.path);
  if (compressedFile == null) return;

  final fileToUpload = File(compressedFile.path);
  final byteLength = await fileToUpload.length();
  print('最终准备上传的体积: ${byteLength / 1024} KB');

  // 4. 上传到云端
  // SmartDialog.showLoading(msg: "上传中..."); (可以加上 Toast 交互)
  final String? url = await uploadImage(fileToUpload, 'user_uuid_123');

  // 5. 将获取到的 url 保存到自己的 DB 等...
  print('改头像成功，链接: $url');
}
```

---

## Day 21 总结 📝

- 在 Flutter 中的图像处理比前端多了调用原生 SDK 的流程，但封装后的代码也非常简单。
- `image_picker` 对标 `<input file>`，获得初始 `XFile` 对象。
- `image_cropper` 对标 `cropperjs`，调起原生裁剪界面，性能远胜 H5 实现。
- `flutter_image_compress` 高效缩小突破 10M 的相片体积。
- 最终使用 Supabase Storage 上传，并通过 `cached_network_image` 给全量用户展示并做好磁盘缓存。

> 📖 下篇预告：**Day 22：平台通道 (Platform Channel)**——当 Flutter 遇到它做不了的事（比如获取剩余电量、特定硬件通信）时，我们如何通过方法通道 "指挥" iOS 和 Android 的底层代码！
