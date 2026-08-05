# 微服务网关 API 接口设计规范与安全指南

> **标准版本**：`API-SPEC-v4.0`  
> **适用范围**：所有后端微服务 API 接口与网关对外开放接口  

---

## 一、 接口命名与 RESTful 规范

1. **URL 路由命名**：一律使用小写字母及连字符 `-`，禁止使用驼峰写法。例如 `GET /api/v1/user-profiles`。
2. ** HTTP 动词语义**：
   * `GET`：查询资源，严禁带 Request Body；
   * `POST`：创建资源；
   * `PUT` / `PATCH`：更新资源；
   * `DELETE`：删除资源。

---

## 二、 安全认证与签名机制 (Authentication)

### 2.1 Bearer JWT 认证
所有受保护接口 Header 必须携带标准的 JWT Token：
`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2.2 Header 签名防止篡改 (Sign Verification)
客户端请求需携带以下自定义 Header 字段：
* `X-Signature-Timestamp`：当前毫秒级时间戳；
* `X-Signature-Nonce`：随机 16 位 UUID（单次有效）；
* `X-Signature`：使用 HMAC-SHA256 对 `timestamp + nonce + body` 计算的哈希签名。

---

## 三、 限流与错误响应状态码 (Rate Limit & Status Codes)

* **HTTP 429 Too Many Requests**：触发网关限流（默认单 IP 每分钟 120 次）。响应 Body 需返回 `{"code": 42901, "message": "请求过于频繁，请稍后再试"}`。
* **HTTP 401 Unauthorized**：Token 失效或缺失。
* **HTTP 403 Forbidden**：无权限访问该资源。
