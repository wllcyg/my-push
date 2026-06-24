var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-0nyXXR/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-0nyXXR/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var src_default = {
  // 供我们本地调试或浏览器触发使用
  async fetch(request, env, ctx) {
    try {
      const result = await runWorkflow(env);
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },
  // 供 Cron 定时任务触发
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWorkflow(env));
  }
};
async function runWorkflow(env) {
  console.log("1. Fetching word from Qwen...");
  const wordData = await getWordFromQwen(env);
  console.log("Uploading JSON to Supabase...");
  const publicJsonUrl = await uploadToSupabase(env, JSON.stringify(wordData), "today.json", "application/json");
  console.log("Pushing to WeChat Test Account...");
  const pageUrl = `http://localhost:3000?t=${(/* @__PURE__ */ new Date()).getTime()}`;
  const pushResult = await pushToWeChatTestAccount(env, wordData, pageUrl);
  return {
    wordData,
    publicJsonUrl,
    pushResult
  };
}
__name(runWorkflow, "runWorkflow");
async function getWordFromQwen(env) {
  if (env.QWEN_API_KEY === "your-qwen-api-key") {
    return {
      word: "Resilience",
      phonetic: "/r\u0259\u02C8zily\u0259ns/",
      meaning: "n. \u6062\u590D\u529B\uFF1B\u5F39\u529B\uFF1B\u987A\u5E94\u529B",
      example: "The rescue workers showed remarkable resilience in dealing with the difficult conditions.",
      exampleTranslation: "\u6551\u63F4\u4EBA\u5458\u5728\u5E94\u5BF9\u6076\u52A3\u73AF\u5883\u65F6\u5C55\u73B0\u51FA\u4E86\u60CA\u4EBA\u7684\u97E7\u6027\u3002",
      root: "re (\u56DE) + salire (\u8DF3\u8DC3)",
      emoji: "\u{1F331}",
      quoteSource: "\u2014 Everyday Context",
      streak: "1"
    };
  }
  const prompt = `\u8BF7\u4F60\u4F5C\u4E3A\u4E00\u4E2A\u8D44\u6DF1\u82F1\u8BED\u8001\u5E08\uFF0C\u968F\u673A\u6311\u9009\u4E00\u4E2A\u5177\u6709\u7F8E\u611F\u3001\u6709\u6DF1\u5EA6\u6216\u9AD8\u7EA7\u7684\u82F1\u8BED\u5355\u8BCD\u3002
\u8BF7\u4EE5 JSON \u683C\u5F0F\u8FD4\u56DE\u4EE5\u4E0B\u5B57\u6BB5\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u591A\u4F59\u7684\u89E3\u91CA\uFF1A
{
  "word": "\u5355\u8BCD",
  "phonetic": "\u97F3\u6807",
  "meaning": "\u7B80\u77ED\u7CBE\u51C6\u7684\u4E2D\u6587\u91CA\u4E49\uFF08\u5305\u542B\u8BCD\u6027\uFF09",
  "example": "\u5305\u542B\u8BE5\u5355\u8BCD\u7684\u7EAF\u82F1\u6587\u7ECF\u5178\u4F8B\u53E5\u6216\u7535\u5F71\u540D\u8A00",
  "exampleTranslation": "\u8FD9\u53E5\u4F8B\u53E5\u7684\u7CBE\u51C6\u4F18\u7F8E\u4E2D\u6587\u7FFB\u8BD1",
  "root": "\u8BCD\u6839\u8BCD\u7F00\u62C6\u89E3\uFF08\u5982 seren(\u5E73\u9759)+dipity\uFF09",
  "emoji": "\u4E00\u4E2A\u6700\u7B26\u5408\u8BE5\u5355\u8BCD\u610F\u5883\u7684Emoji\uFF08\u5982 \u{1F340}\uFF09",
  "quoteSource": "\u4F8B\u53E5\u7684\u51FA\u5904\uFF08\u5982 \u2014 The Great Gatsby\uFF09",
  "streak": "\u586B\u5165 1 \u5373\u53EF"
}`;
  const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.QWEN_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "qwen-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`Qwen API Error: ${data.message || JSON.stringify(data)}`);
  return JSON.parse(data.choices[0].message.content);
}
__name(getWordFromQwen, "getWordFromQwen");
async function uploadToSupabase(env, data, fileName, contentType) {
  const bucketName = "daily-card";
  const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    // or PUT if upsert behavior differs, but x-upsert header handles it
    headers: {
      "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": contentType,
      // 重要：设置 upsert 为 true，永远覆盖同一个文件，节省空间！
      "x-upsert": "true"
    },
    body: data
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${errorText}`);
  }
  const timestamp = (/* @__PURE__ */ new Date()).getTime();
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}?t=${timestamp}`;
}
__name(uploadToSupabase, "uploadToSupabase");
async function pushToWeChatTestAccount(env, wordData, imageUrl) {
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get WeChat access_token: ${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;
  const openIds = env.WECHAT_OPENID.split(",").map((id) => id.trim()).filter((id) => id.length > 0);
  const results = [];
  for (const openId of openIds) {
    const sendUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`;
    const payload = {
      touser: openId,
      template_id: env.WECHAT_TEMPLATE_ID,
      url: imageUrl,
      data: {
        word: {
          value: wordData.word,
          color: "#173177"
        },
        meaning: {
          value: wordData.meaning,
          color: "#666666"
        }
      }
    };
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    results.push({ openId, data });
  }
  return results;
}
__name(pushToWeChatTestAccount, "pushToWeChatTestAccount");

// node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260624.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260624.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-0nyXXR/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260624.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-0nyXXR/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
