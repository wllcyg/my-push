import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  IMAGE_BUCKET: R2Bucket
  ADMIN_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

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
  
  await c.env.IMAGE_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  })
  
  const url = new URL(c.req.url)
  const imageUrl = `${url.origin}/i/${key}`
  
  return c.json({ success: true, key, url: imageUrl })
})

app.get('/api/images', async (c) => {
  const list = await c.env.IMAGE_BUCKET.list()
  const url = new URL(c.req.url)
  const images = list.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `${url.origin}/i/${obj.key}`
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
