export interface Env {
  QWEN_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  WECHAT_APP_ID: string;
  WECHAT_APP_SECRET: string;
  WECHAT_OPENID: string;
  WECHAT_TEMPLATE_ID: string;
  FRONTEND_URL: string;
}

export default {
  // 供我们本地调试或浏览器触发使用
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const result = await runWorkflow(env);
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  // 供 Cron 定时任务触发
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runWorkflow(env));
  },
};

async function runWorkflow(env: Env) {
  console.log('1. Fetching word from Qwen...');
  const wordData = await getWordFromQwen(env);

  // 2. 将数据上传到 Supabase (返回公开的带时间戳链接)
  console.log("Uploading JSON to Supabase...");
  const publicJsonUrl = await uploadToSupabase(env, JSON.stringify(wordData), 'today.json', 'application/json');

  // 3. 推送到微信测试号 (跳转到前端网页)
  console.log("Pushing to WeChat Test Account...");
  const pageUrl = `${env.FRONTEND_URL}?t=${new Date().getTime()}`;
  const pushResult = await pushToWeChatTestAccount(env, wordData, pageUrl);

  return {
    wordData,
    publicJsonUrl,
    pushResult
  };
}

async function getWordFromQwen(env: Env) {
  if (env.QWEN_API_KEY === 'your-qwen-api-key') {
    // 模拟数据用于本地测试，如果你还没配 Key
    return {
      word: "Resilience",
      phonetic: "/rəˈzilyəns/",
      meaning: "n. 恢复力；弹力；顺应力",
      example: "The rescue workers showed remarkable resilience in dealing with the difficult conditions.",
      exampleTranslation: "救援人员在应对恶劣环境时展现出了惊人的韧性。",
      root: "re (回) + salire (跳跃)",
      emoji: "🌱",
      quoteSource: "— Everyday Context",
      streak: "1"
    };
  }

  const prompt = `请你作为一个资深英语老师，随机挑选一个具有美感、有深度或高级的英语单词。
请以 JSON 格式返回以下字段，不要输出任何多余的解释：
{
  "word": "单词",
  "phonetic": "音标",
  "meaning": "简短精准的中文释义（包含词性）",
  "example": "包含该单词的纯英文经典例句，要求句子极具文学性、富有诗意、优雅且深刻，仿佛出自经典名著",
  "exampleTranslation": "这句例句的精准优美的中文翻译，必须信达雅",
  "root": "词根词缀拆解（如 seren(平静)+dipity）",
  "emoji": "一个最符合该单词意境的Emoji（如 🍀）",
  "quoteSource": "例句的出处（如 — The Great Gatsby，如果是原创请写 — Everyday Context）",
  "streak": "填入 1 即可"
}`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3.7-plus',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  const data: any = await response.json();
  if (!response.ok) throw new Error(`Qwen API Error: ${data.message || JSON.stringify(data)}`);
  
  return JSON.parse(data.choices[0].message.content);
}



async function uploadToSupabase(env: Env, data: ArrayBuffer | string, fileName: string, contentType: string) {
  const bucketName = 'daily-card';
  
  // Storage API endpoint
  const uploadUrl = `${env.SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;
  
  const response = await fetch(uploadUrl, {
    method: 'POST', // or PUT if upsert behavior differs, but x-upsert header handles it
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': contentType,
      // 重要：设置 upsert 为 true，永远覆盖同一个文件，节省空间！
      'x-upsert': 'true'
    },
    body: data
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed: ${errorText}`);
  }

  // 构建公开访问链接。为了防止微信缓存昨天的那张图，我们在链接后面加一个时间戳参数 ?t=...
  const timestamp = new Date().getTime();
  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}?t=${timestamp}`;
}

async function pushToWeChatTestAccount(env: Env, wordData: any, imageUrl: string) {
  // 1. 获取 access_token
  const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}`;
  const tokenRes = await fetch(tokenUrl);
  const tokenData: any = await tokenRes.json();
  
  if (!tokenData.access_token) {
    throw new Error(`Failed to get WeChat access_token: ${JSON.stringify(tokenData)}`);
  }
  const accessToken = tokenData.access_token;

  // 2. 解析多个 OpenID 并群发
  const openIds = env.WECHAT_OPENID.split(',').map(id => id.trim()).filter(id => id.length > 0);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json();
    results.push({ openId, data });
  }

  return results;
}
