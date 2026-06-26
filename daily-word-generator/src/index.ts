import { buildPushHTTPRequest } from '@pushforge/builder';

export interface Env {
  DB: any;
  VECTORIZE: any;
  AI: any;
  VAPID_PRIVATE_KEY: string;
}

const BASE_WORDS = [
  'Serendipity', 'Melancholy', 'Ephemeral', 'Solitude', 'Nostalgia',
  'Eternity', 'Luminous', 'Oblivion', 'Resilience', 'Wanderlust',
  'Enigma', 'Ethereal', 'Petrichor', 'Ineffable', 'Sonorous',
  'Labyrinth', 'Halcyon', 'Aurora', 'Zenith', 'Echo'
];

export default {
  async scheduled(event: any, env: Env, ctx: any) {
    const today = new Date().toISOString().split('T')[0];

    // Branch 1: Push Notifications (0 23 * * * -> 07:00 Beijing Time)
    if (event?.cron === "0 23 * * *" || event?.cron === "push-only") {
      console.log("Starting smart push notification job...");
      await this.sendPushNotifications(env, today);
      return;
    }

    // Branch 2: Generate Words (1 16 * * * -> 00:01 Beijing Time)
    console.log("Starting daily word generation cron job...");

    // 1. Get recent words from D1 to fetch their embeddings from Vectorize or just fetch texts
    const { results: recentWords } = await env.DB.prepare('SELECT word, translation FROM words ORDER BY created_at DESC LIMIT 10').all();
    const recentMeanings = recentWords.map((w: any) => `${w.word}: ${w.translation}`).join('; ');

    // 2. Pick 3 new words
    const { results: allWords } = await env.DB.prepare('SELECT word FROM words').all();
    const existingWords = new Set(allWords.map((w: any) => w.word));
    
    const availableWords = BASE_WORDS.filter(w => !existingWords.has(w));
    const wordsToGen = availableWords.length >= 3 ? availableWords.slice(0, 3) : BASE_WORDS.slice(0, 3);

    const newWordIds = [];

    for (const word of wordsToGen) {
      // Prompt injection with semantic history
      const prompt = `你是一个精通中英双语的语言学和文学大师。我们要挑选一个今日核心词汇："${word}"。
最近我们已经生成过以下词汇及其意境：[${recentMeanings}]。
请你在生成时，尽量在情感和意境上避开上述已经存在的话题，给用户带来新鲜感。
请严格返回如下 JSON 格式（无 markdown，仅限 JSON 对象）：
{
  "word": "${word}",
  "phonetic": "音标",
  "meaning": "词性和中文释义 (如: n. 恢复力；弹力)",
  "example": "对应的优美英文例句",
  "exampleTranslation": "例句的中文优美翻译",
  "root": "词根词源解析 (如: re (回) + salire (跳跃))",
  "emoji": "代表该单词意境的单个 emoji (如: 🌱)",
  "quoteSource": "例句的出处或场景 (如: - Everyday Context)"
}`;

      let wordData: any;
      let responseText = '';
      try {
        const aiResponse = await env.AI.run('@cf/moonshotai/kimi-k2.6', {
          messages: [{ role: 'user', content: prompt }]
        });
        
        // Log full object to debug Kimi's specific return format
        responseText = JSON.stringify(aiResponse);
        const actualText = 
          (aiResponse as any).response || 
          (aiResponse as any).result?.response || 
          (aiResponse as any).choices?.[0]?.message?.content || 
          '';
        
        if (!actualText) throw new Error("Could not find text in AI response");
        
        let cleaned = actualText.replace(/```json/g, '').replace(/```/g, '').trim();
        wordData = JSON.parse(cleaned);
      } catch (e: any) {
        console.error("AI Generation failed for word", word, e);
        throw new Error(`AI parse failed. Full response object: ${responseText}. Error: ${e.message}`);
      }

      // 3. Store in D1 (Mapping the new JSON structure to the existing database schema)
      const info = await env.DB.prepare(
        'INSERT INTO words (word, phonetic, translation, pos, literature_example, english_example) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        word,
        wordData.phonetic || '',
        wordData.meaning || '', // Mapped meaning to translation
        wordData.root ? `Emoji: ${wordData.emoji} | Root: ${wordData.root}` : 'N/A', // Mapped extra info to pos field to avoid losing it
        `${wordData.exampleTranslation} ${wordData.quoteSource ? '(' + wordData.quoteSource + ')' : ''}`, // Mapped to literature_example
        wordData.example || ''
      ).run();

      const newId = info.meta.last_row_id;
      newWordIds.push(newId);

      // 4. Vectorize: embed the translation & literature example
      try {
        const textToEmbed = `${wordData.translation}。${wordData.literature_example}`;
        const embeddingResp = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
          text: [textToEmbed]
        });
        
        const embedding = embeddingResp.data[0];
        
        await env.VECTORIZE.upsert([{
          id: newId.toString(),
          values: embedding,
          metadata: { word, translation: wordData.translation }
        }]);
      } catch (embErr: any) {
        console.error("Embedding failed for word", word, embErr);
      }
    }

    // 5. Update daily_words
    if (newWordIds.length > 0) {
      await env.DB.prepare('INSERT INTO daily_words (date, word_ids) VALUES (?, ?)')
        .bind(today, JSON.stringify(newWordIds))
        .run();
      console.log(`Successfully generated and saved ${newWordIds.length} words for ${today}`);
    } else {
      console.log("No words were successfully generated.");
    }
  },

  async sendPushNotifications(env: Env, today: string) {
    try {
      // 找出所有未在今天活跃的订阅用户
      const { results: subscriptions } = await env.DB.prepare(
        'SELECT * FROM push_subscriptions WHERE last_active_date IS NULL OR last_active_date != ?'
      ).bind(today).all();

      if (subscriptions && subscriptions.length > 0 && env.VAPID_PRIVATE_KEY) {
        const privateJWK = JSON.parse(env.VAPID_PRIVATE_KEY);
        
        for (const sub of subscriptions) {
          try {
            const subscriptionObj = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth
              }
            };

            const { endpoint, headers, body } = await buildPushHTTPRequest({
              privateJWK,
              subscription: subscriptionObj,
              message: {
                payload: {
                  title: `消息通知`,
                  body: "每天进步一点点，点击查看今日的精美短文与单词解析。",
                  url: "/"
                },
                adminContact: "mailto:admin@example.com"
              }
            });

            await fetch(endpoint, { method: 'POST', headers, body });
          } catch (pushErr) {
            console.error("Failed to push to endpoint", sub.endpoint, pushErr);
          }
        }
        console.log(`Successfully sent pushes to ${subscriptions.length} devices.`);
      } else {
        console.log("No active subscriptions needing a push today.");
      }
    } catch (e) {
      console.error("Failed during push notification phase", e);
    }
  },
  
  // Expose a secret HTTP endpoint just for manual triggering during dev
  async fetch(request: any, env: Env, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname === '/force-run-cron') {
      try {
        // Mock a generation cron event
        await this.scheduled({ cron: "1 16 * * *" }, env, ctx);
        return new Response("Generation cron job triggered manually. Check D1.", { status: 200 });
      } catch (err: any) {
        return new Response("Generation cron job failed: " + err.message, { status: 500 });
      }
    }
    if (url.pathname === '/force-run-push') {
      try {
        // Mock a push cron event
        await this.scheduled({ cron: "push-only" }, env, ctx);
        return new Response("Push cron job triggered manually.", { status: 200 });
      } catch (err: any) {
        return new Response("Push cron job failed: " + err.message, { status: 500 });
      }
    }
    return new Response("Not found", { status: 404 });
  }
};
