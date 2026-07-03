import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  IMAGE_BUCKET: R2Bucket
  ADMIN_TOKEN: string
  AI: any
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: [
    'https://image.cheatppf.xyz',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
  maxAge: 86400,
}))

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return next()
  }
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

app.get('/i/:key', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.IMAGE_BUCKET.get(key)
  if (!object) return c.text('Not found', 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)

  return new Response(object.body, { headers })
})

app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400)
  }
  
  const ext = file.name.split('.').pop()
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}.${ext}`
  
  const arrayBuffer = await file.arrayBuffer()
  let tags = 'None';
  try {
    const aiResponse = await c.env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
        prompt: "You are an image classifier. Classify the image into exactly 1-3 generic tags from this list: [截图, 照片, 表情包, 文档, 风景, 代码, 人像, UI界面]. Only output the tags, separated by commas. No other text. You must output in Chinese.",
        image: [...new Uint8Array(arrayBuffer)]
    });
    if (aiResponse && aiResponse.description) {
        tags = aiResponse.description.trim();
    }
  } catch(e) {
    console.error("AI Error:", e);
  }

  await c.env.IMAGE_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { tags }
  })
  
  const url = new URL(c.req.url)
  const imageUrl = `${url.origin}/i/${key}`
  
  return c.json({ success: true, key, url: imageUrl, tags })
})

app.get('/api/images', async (c) => {
  const list = await c.env.IMAGE_BUCKET.list({ include: ['customMetadata'] })
  const url = new URL(c.req.url)
  const images = list.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `${url.origin}/i/${obj.key}`,
    tags: obj.customMetadata?.tags || 'None'
  }))
  images.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime())
  return c.json({ images })
})

app.delete('/api/images/:key', async (c) => {
  const key = c.req.param('key')
  await c.env.IMAGE_BUCKET.delete(key)
  return c.json({ success: true })
})

export default app
