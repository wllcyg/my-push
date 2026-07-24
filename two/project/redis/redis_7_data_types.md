# Redis 7 常见数据类型详解与实战指南

Redis 7 是当前最流行的内存高性能键值数据库。本文档详细梳理了 Redis 7 中最核心、最常见的数据类型，包含底层原理、常用命令、经典应用场景以及 Python / SDK 代码示例。

---

## 目录
1. [String（字符串）](#1-string字符串)
2. [Hash（哈希表）](#2-hash哈希表)
3. [List（双向列表）](#3-list双向列表)
4. [Set（无序集合）](#4-set无序集合)
5. [Sorted Set / ZSet（有序集合）](#5-sorted-set--zset有序集合)
6. [Bitmap（位图）](#6-bitmap位图)
7. [HyperLogLog（基数统计）](#7-hyperloglog基数统计)
8. [Geospatial（GEO 地理位置）](#8-geospatialgeo-地理位置)
9. [Stream（消息流）](#9-stream消息流)
10. [Redis 7 新特性数据结构](#10-redis-7-新特性数据结构)

---

## 1. String（字符串）

### 📖 简介
Redis 最基础的数据类型，二进制安全，可以存储文本、JSON 字符串、数字甚至是图片等二进制数据。单个 Key 的 Value 最大限制为 512MB。

### 🎯 经典应用场景
- **缓存对象 / 页面 HTML**
- **分布式锁（`SETNX`）**
- **计数器 / 限流器（如文章阅读量、接口调用次数 `INCR`）**
- **验证码 / Session 过期（配合 TTL）**

### 常用命令
```shell
SET key value               # 设置值
GET key                     # 获取值
SETEX key seconds value     # 设置值并指定过期秒数
SETNX key value             # 仅当 key 不存在时设置 (分布式锁基础)
INCR key                    # 自增 1
DECRBY key decrement        # 自减指定数值
```

---

## 2. Hash（哈希表）

### 📖 简介
一个键值对（Field-Value）的集合，特别适合用来存储对象结构（例如用户信息、商品属性）。

### 🎯 经典应用场景
- **用户 Profile / Session 信息存储**
- **电商购物车（Key=用户ID, Field=商品ID, Value=数量）**

### 常用命令
```shell
HSET user:1001 name "张三" age 25    # 设置字段值
HGET user:1001 name                # 获取指定字段
HGETALL user:1001                  # 获取所有字段与值
HDEL user:1001 age                 # 删除指定字段
HINCRBY user:1001 visits 1         # 字段累加
```

---

## 3. List（双向列表）

### 📖 简介
基于双向链表（或 QuickList）实现的有序字符串列表，插入和删除头部/尾部元素的时间复杂度为 O(1)。

### 🎯 经典应用场景
- **消息队列 / Task Queue（`LPUSH` + `RPOP` 或 `BRPOP` 阻塞读取）**
- **最新消息列表 / 时间线（如最新发布的 50 条动态）**

### 常用命令
```shell
LPUSH mylist "item1" "item2"    # 从左侧入队
RPOP mylist                     # 从右侧出队
LRANGE mylist 0 9               # 获取索引范围内的元素 (0到9为前10个)
LLEN mylist                     # 获取列表长度
BLPOP mylist 10                 # 阻塞式从左侧弹出 (最多等待10秒)
```

---

## 4. Set（无序集合）

### 📖 简介
无序且唯一的字符串集合，内部采用哈希表实现，添加、删除、查找的复杂度均为 O(1)。支持求交集、并集和差集。

### 🎯 经典应用场景
- **标签系统（如用户标签、商品分类）**
- **抽奖系统（`SRANDMEMBER` / `SPOP` 随机抽取）**
- **社交关系（共同好友、共同关注：交集 `SINTER`）**
- **独立 IP / 元素去重**

### 常用命令
```shell
SADD tags "python" "redis"      # 添加元素 (自动去重)
SMEMBERS tags                   # 获取所有元素
SISMEMBER tags "redis"          # 判断元素是否存在
SINTER set1 set2                # 求两个集合的交集
SUNION set1 set2                # 求两个集合的并集
```

---

## 5. Sorted Set / ZSet（有序集合）

### 📖 简介
Redis 最具特色的数据类型之一。每个元素关联一个 `double` 类型的浮点数 **分数 (Score)**，集合内元素按 Score 从小到大自动排序。底层由 **跳表 (SkipList) + 哈希表** 实现。

### 🎯 经典应用场景
- **热搜榜 / 游戏排行榜（按得分/阅读量排序）**
- **延迟队列（Score 存放未来执行的时间戳，使用 `ZRANGEBYSCORE` 定时拉取）**
- **权重优先级队列**

### 常用命令
```shell
ZADD leaderboard 100 "PlayerA" 200 "PlayerB"    # 添加带分数的元素
ZRANGE leaderboard 0 -1 WITHSCORES              # 正序获取所有元素及分数
ZREVRANGE leaderboard 0 9 WITHSCORES           # 倒序获取前 10 名 (排行榜)
ZINCRBY leaderboard 50 "PlayerA"               # 增加元素分数
ZSCORE leaderboard "PlayerA"                   # 获取指定元素的分数
```

---

## 6. Bitmap（位图）

### 📖 简介
不是独立的数据类型，而是基于 String 类型的位（bit）级别操作。非常节省内存（1 亿个 bit 仅需约 12MB 内存）。

### 🎯 经典应用场景
- **用户打卡 / 签到记录（Key=用户ID:年份, Offset=一年中的第几天）**
- **在线状态统计（`SETBIT online_users user_id 1`）**

### 常用命令
```shell
SETBIT sign:1001:202607 1 1     # 设置第 1 天已签到 (1)
GETBIT sign:1001:202607 1       # 获取第 1 天签到状态
BITCOUNT sign:1001:202607       # 统计当月总签到天数
```

---

## 7. HyperLogLog（基数统计）

### 📖 简介
一种用来进行**巨量概率性去重计数**的数据结构。即使统计几亿条数据，占用的内存也固定在 12KB 左右（标准误差率约 0.81%）。

### 🎯 经典应用场景
- **网站 UV（独立访客计数）**
- **海量搜索关键词去重统计**

### 常用命令
```shell
PFADD uv:20260724 "ip1" "ip2" "ip3"   # 添加元素
PFCOUNT uv:20260724                   # 统计独立基数
PFMERGE uv:total uv:day1 uv:day2      # 合并多个 HLL
```

---

## 8. Geospatial（GEO 地理位置）

### 📖 简介
底层基于 ZSet 和 GeoHash 算法实现，用于存储经纬度坐标并进行空间位置计算。

### 🎯 经典应用场景
- **附近的人 / 附近的商家（以指定半径搜索）**
- **计算两点间距离（如打车/外卖路线距离）**

### 常用命令
```shell
GEOADD drivers 116.40 39.90 "driver_A" 116.41 39.91 "driver_B"   # 添加经纬度
GEODIST drivers "driver_A" "driver_B" km                       # 计算两点距离(千米)
GEOSEARCH drivers FROMLONLAT 116.40 39.90 BYRADIUS 5 km        # 搜索方圆 5km 范围内的司机
```

---

## 9. Stream（消息流）

### 📖 简介
Redis 5.0 引入、Redis 7.0 大幅优化的专业**消息队列数据结构**。支持持久化、消息 ID 自动生成、消费组（Consumer Group）、消息 ACK 确认以及挂起消息恢复（PEL）。

### 🎯 经典应用场景
- **高性能分布式消息队列**
- **实时事件流 / 日志收集分析系统**

### 常用命令
```shell
XADD mystream * user "Moliang" action "login"                  # 发送消息 (* 自动生成唯一ID)
XREAD COUNT 2 STREAMS mystream 0                               # 顺序读取消息
XGROUP CREATE mystream mygroup $                               # 创建消费者组
XREADGROUP GROUP mygroup consumer1 STREAMS mystream >         # 消费者组读取未分配消息
XACK mystream mygroup <message_id>                            # 确认消息消费完成
```

---

## 10. Redis 7 新特性与进阶数据结构

- **Bitfield（位域）**：可在单字符中存储指定位数的整数（如 4 位或 16 位整数），适合存储游戏装备级别等超紧凑数据。
- **Function（函数）**：Redis 7 引入了替代 Lua 脚本的持久化服务端脚本机制，提高代码复用性。
- **RedisJSON（扩展模块）**：原生支持存储、查询 JSON 文档（类似 MongoDB 键值）。

---

## 💡 数据类型选型参考表

| 数据类型 | 重复性 | 是否有序 | 内存消耗 | 代表场景 |
| :--- | :--- | :--- | :--- | :--- |
| **String** | N/A | N/A | 低 | 缓存、计数器、分布式锁 |
| **Hash** | N/A | 否 | 低（小型字段有压缩） | 对象信息、购物车 |
| **List** | 可重复 | 插入顺序 | 中 | 消息队列、最新动态 |
| **Set** | 唯一 | 否 | 中 | 标签、共同好友、去重 |
| **ZSet** | 唯一 | 按分数 Score 排序 | 中高 | 排行榜、延迟队列 |
| **Bitmap** | 0/1 位 | 按偏移量 | **极低** | 每日签到、在线状态 |
| **HyperLogLog**| 唯一 | 否 | **固定 12KB** | 网站 UV 巨量独立访客统计 |
| **Stream** | N/A | 按时间戳消息ID | 中 | 类似 Kafka 的专业消息队列 |
