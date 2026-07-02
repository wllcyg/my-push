# 前端转 Flutter 笔记 (Day 40 下)：手撸小红书图片墙，顺便踩了几个坑

> 上篇介绍了瀑布流的几种方案和选型思路，这篇直接开写。目标是做一个 2 列瀑布流图片墙，支持下拉刷新和上拉加载更多，顺便把图片加载抖动这个坑填上。

---

## 数据模型

先把数据结构定义好：

```dart
class FeedItem {
  final int id;
  final String imageUrl;
  final String title;
  final String author;
  final String avatar;
  final int likes;

  const FeedItem({
    required this.id,
    required this.imageUrl,
    required this.title,
    required this.author,
    required this.avatar,
    required this.likes,
  });
}
```

---

## 主页面

页面逻辑分两块：下拉刷新重新生成数据，上拉到底部时追加数据。用 `useScrollController` 监听滚动位置，距底部 200px 就开始加载下一批，这样用户基本感觉不到等待：

```dart
class Day40StaggeredGridDemo extends HookWidget {
  const Day40StaggeredGridDemo({super.key});

  @override
  Widget build(BuildContext context) {
    final items = useState<List<FeedItem>>(_generateMockData());
    final isLoading = useState(false);
    final scrollController = useScrollController();

    Future<void> onRefresh() async {
      isLoading.value = true;
      await Future.delayed(const Duration(seconds: 1));
      items.value = _generateMockData();
      isLoading.value = false;
    }

    useEffect(() {
      void onScroll() {
        if (scrollController.position.pixels >=
            scrollController.position.maxScrollExtent - 200) {
          if (!isLoading.value) {
            isLoading.value = true;
            Future.delayed(const Duration(seconds: 1), () {
              items.value = [
                ...items.value,
                ..._generateMockData(offset: items.value.length),
              ];
              isLoading.value = false;
            });
          }
        }
      }

      scrollController.addListener(onScroll);
      return () => scrollController.removeListener(onScroll);
    }, [scrollController]);

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: RefreshIndicator(
        onRefresh: onRefresh,
        child: MasonryGridView.count(
          controller: scrollController,
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          padding: const EdgeInsets.all(8),
          itemCount: items.value.length,
          itemBuilder: (context, index) {
            return _FeedCard(item: items.value[index]);
          },
        ),
      ),
    );
  }

  static List<FeedItem> _generateMockData({int offset = 0}) {
    return List.generate(20, (i) {
      final index = offset + i;
      final height = 300 + (index % 5) * 80;  // 300 ~ 620，制造高度差异
      return FeedItem(
        id: index,
        imageUrl: 'https://picsum.photos/id/${100 + index}/400/$height',
        title: '今日份的美好分享 ✨',
        author: '用户${1000 + index}',
        avatar: 'https://i.pravatar.cc/150?img=${(index % 70) + 1}',
        likes: 100 + index * 10,
      );
    });
  }
}
```

`_generateMockData` 里故意让每张图的高度不一样（300 到 620 循环），这样瀑布流效果才明显。

---

## 卡片组件

卡片分三层：图片、标题、作者和点赞。重点在图片那一块，后面会解释为什么要套一层 `AspectRatio`：

```dart
class _FeedCard extends HookWidget {
  final FeedItem item;
  const _FeedCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final isLiked = useState(false);

    return GestureDetector(
      onTap: () {},
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 图片区
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
              child: AspectRatio(
                aspectRatio: _parseAspectRatio(item.imageUrl),  // 关键
                child: CachedNetworkImage(
                  imageUrl: item.imageUrl,
                  fit: BoxFit.cover,
                  memCacheWidth: 400,
                  maxWidthDiskCache: 400,
                  placeholder: (context, url) => Container(
                    color: Colors.grey.shade200,
                    child: const Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                  errorWidget: (context, url, error) => Container(
                    color: Colors.grey.shade200,
                    child: const Icon(Icons.image_not_supported),
                  ),
                ),
              ),
            ),

            // 文字区
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundImage: CachedNetworkImageProvider(item.avatar),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          item.author,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => isLiked.value = !isLiked.value,
                        child: Icon(
                          isLiked.value ? Icons.favorite : Icons.favorite_border,
                          size: 16,
                          color: isLiked.value ? Colors.red : Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _formatLikes(item.likes),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  double _parseAspectRatio(String url) {
    final match = RegExp(r'/(\d+)/(\d+)$').firstMatch(url);
    if (match != null) {
      final w = double.parse(match.group(1)!);
      final h = double.parse(match.group(2)!);
      return w / h;
    }
    return 1.0;
  }

  String _formatLikes(int likes) {
    if (likes >= 10000) return '${(likes / 10000).toStringAsFixed(1)}w';
    if (likes >= 1000) return '${(likes / 1000).toStringAsFixed(1)}k';
    return likes.toString();
  }
}
```

---

## 卡片抖动是怎么回事

写完跑起来，大概率会看到这个现象：滚动时图片刚加载完成的瞬间，卡片突然变高，周围的卡片跟着跳一下。

问题出在这里：图片还没加载时，Flutter 不知道这张图有多高，就用 placeholder 的默认尺寸占位；图片加载完成后，真实宽高比和占位时不一样，卡片高度发生突变，瀑布流被迫重新计算所有卡片的位置，视觉上就"抖"了。

解决思路是在渲染前就告诉 Flutter 这张图的宽高比。我们的测试图片 URL 里正好带了尺寸信息：

```
https://picsum.photos/id/100/400/620
                                ↑   ↑
                               宽  高
```

用正则把宽高解析出来，在外层包一个 `AspectRatio`：

```dart
// 加载前就确定容器尺寸，图片来了也不会撑开
AspectRatio(
  aspectRatio: _parseAspectRatio(item.imageUrl),
  child: CachedNetworkImage(
    imageUrl: item.imageUrl,
    fit: BoxFit.cover,
    placeholder: (context, url) => Container(
      color: Colors.grey.shade200,  // 自动继承外层的宽高比
    ),
  ),
)
```

加了 `AspectRatio` 之后，不管图片有没有加载完，这块区域的高度始终固定，不会有任何跳动。

这和 Web 性能优化里的 CLS（Cumulative Layout Shift）是同一个问题——浏览器的解决方案是给 `<img>` 标签预设 `width` 和 `height` 属性，逻辑完全一样，换了个平台，坑也换了个形状。

---

## 几个值得注意的细节

**图片源的选择**

开发调试时别用 `https://source.unsplash.com/random/` 这类随机 API，有频率限制而且每次返回不同图片，缓存完全失效，加载失败率很高。picsum.photos 按固定 ID 请求稳定得多：

```dart
// 稳定，可缓存
'https://picsum.photos/id/100/400/600'

// 头像，支持 1~70 的 img 参数
'https://i.pravatar.cc/150?img=1'
```

**图片缓存不要缓存原图**

`CachedNetworkImage` 默认会把原始尺寸的图片缓存下来，但手机屏幕宽度就那么点，没必要把 4000px 的高清原图存进内存。加两个参数限制一下：

```dart
CachedNetworkImage(
  imageUrl: item.imageUrl,
  memCacheWidth: 400,      // 内存缓存按 400px 宽度存
  maxWidthDiskCache: 400,  // 磁盘缓存同样限制
  fit: BoxFit.cover,
)
```

内存占用能降不少，在图片密集的瀑布流里效果比较明显。

**懒加载的触发时机**

等用户真的滑到底才开始加载下一页，体验不太好。提前 200px 触发，用户大概率感觉不到等待：

```dart
if (scrollController.position.pixels >=
    scrollController.position.maxScrollExtent - 200) {
  _loadMore();
}
```

这个 200 可以根据实际网络情况调整，网络慢的环境可以适当提前到 400~500px。

---

## Day 40 小结

两篇下来，瀑布流这块基本够用了：

- 做小红书式瀑布流选 `MasonryGridView`，大图小图混排用 `StaggeredGridTile`
- 图片抖动的根本原因是宽高比不确定，用 `AspectRatio` 提前锁定尺寸就解决了
- 测试图片用 picsum.photos，比随机 API 稳定很多
- 图片缓存记得限制宽度，别把原图塞进内存

明天（Day 41）聊 UI 提示组件——[Toast 与 Badge 角标 (Part 1)](file:///Volumes/MOBILE/flutter-mode/my-flutter/my_flutter_app/day41_part1_toast.md)。


---

**今天的代码已上传到仓库**：[查看完整代码](https://github.com/your-repo/flutter-example)