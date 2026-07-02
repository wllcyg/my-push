# 前端转 Flutter 笔记 (Day 1)：环境搭建与项目“大扫除”

> **写在前面**：作为一名 Vue 开发者，习惯了 `npm run dev` 的丝滑和 `Element Plus` 的便捷，初入 Flutter 可能会被那堆复杂的 Android/iOS 配置文件吓退。
> 其实，Flutter 的现代开发体验已经离前端非常近了。这是我（一个 Vue 老鸟）的 Flutter 学习日记第一天。

## 1. 工程结构：Flutter 里的 package.json

创建完项目，第一眼看到的 `pubspec.yaml` 其实就是前端的 `package.json`。

*   **依赖管理**：`dependencies` 对应 `dependencies`，`dev_dependencies` 对应 `devDependencies`。
*   **区别**：Flutter 对缩进极其严格（YAML 格式），少一个空格都会报错，这点比 JSON 严格。

```yaml
dependencies:
  flutter:
    sdk: flutter
  # 相当于 npm install flutter_screenutil
  flutter_screenutil: ^5.9.3 
  # 相当于 npm install flutter_riverpod
  flutter_riverpod: ^2.5.1
```

## 2. 资源管理：告别手写路径 🙅‍♂️

在 Vue 里，我们可能习惯了 `src="@/assets/logo.png"`。
但在 Flutter 原生开发中，如果要在代码里写字符串 `"assets/images/logo.png"`，一旦改文件名或拼错，运行起来才报错，非常痛苦。

**神器推荐：FlutterGen**
这东西就像前端的自动导入插件。配置好后，运行脚本，它会自动扫描所有图片生成一个 `Assets` 类。

**对比体验：**
*   🔴 **Old**: `Image.asset('assets/images/logo_blue.png')` (容易拼错)
*   🟢 **New**: `Assets.images.logoBlue.image()` (类型安全，有补全，甚至能预览！)

这也是我进项目做的第一件事：写了一个 `gen.sh` 脚本，把生成命令封装起来，体验接近 `npm run build`。

## 3. 路由去哈希：URL 的洁癖 🧹

Flutter Web 默认的 URL 也是带 `#` 的 (Hash Mode)，像 `localhost:8080/#/login`。
对于有洁癖的前端来说，必须利用 `url_strategy` 把它改成 Path Mode (`localhost:8080/login`)。

虽然这次做的是 App，但在调试阶段（或未来发 Web 版）看着干净的 URL 心情都会好很多。

## 4. 调试神器：VS Code 配置

Flutter 的调试体验其实优于 Web。在 `.vscode/launch.json` 里配置好设备后，**F5 一键启动**。
最爽的是 **Hot Reload (热重载)**，按一下 `r`，界面状态保留，UI 瞬间刷新。这比 Webpack HMR 有时还要快和稳。

## Day 1 总结

第一天没有急着画页面，而是：
1.  **统一规范**：清理了官方 Demo 的计数器代码。
2.  **配置工具**：搞定了自动生成资源的脚本。
3.  **启动屏**：做了一个包含 Logo 的 Splash Page，作为 App 的门面。

**感悟**：Flutter 的工程化程度很高，只要配置好基建，后面的开发效率不输 Vue。明天开始挑战 UI 布局！
