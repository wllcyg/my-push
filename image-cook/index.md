### 问题分析：上传图片后未出现在列表

**问题原因：**
因为 Cloudflare R2 默认按**对象的 Key 的字典序（字母顺序）升序**返回列表。
在 `backend/src/index.ts` 中，上传图片时生成 key 的逻辑是：
```typescript
const key = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}.${ext}`
```
这里的 `Date.now().toString(36)` 随着时间推移，生成的字符串字典序是递增的。
当执行 `c.env.IMAGE_BUCKET.list({ limit: 30 })` 时，R2 总是优先返回字典序最小的，也就是**最早上传的图片**。
虽然在接口最后通过 `images.sort(...)` 做了倒序排列，但那只是对“第一页获取到的 30 张老图片”进行了倒序。最新上传的图片因为排在整个 Bucket 的末尾，如果总数超过 30 张，根本就不会出现在第一页的返回结果中，导致前端重新刷新第一页时看不到刚才上传的图片。

**解决方案：**
要让最新上传的图片排在最前面，我们需要反转时间戳，使生成的 Key 字典序随时间递减。可以通过 `Number.MAX_SAFE_INTEGER - Date.now()` 来实现，并往前补齐 0 保证长度一致。

**修改 `backend/src/index.ts`：**

找到上传生成 key 的地方，将其修改为：

```typescript
  const ext = file.name.split('.').pop()
  // 用最大安全整数减去当前时间，再转36进制并补齐11位，确保最新上传的字典序排在最前面
  const reverseTime = (Number.MAX_SAFE_INTEGER - Date.now()).toString(36).padStart(11, '0')
  const key = `${reverseTime}-${Math.random().toString(36).substring(2, 8)}.${ext}`
```

这样修改后，新上传的图片 Key 字典序总是最小的，R2 的 `.list()` 就会优先返回最新的图片。