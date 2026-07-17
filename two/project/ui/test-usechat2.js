import { useChat } from '@ai-sdk/vue';
import { createServer } from 'http';

const server = createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    console.log('Received payload:', body);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1'
    });
    res.end('0:"hello"\n');
    server.close();
  });
});
server.listen(4321, () => {
  const chat = useChat({ api: 'http://localhost:4321' });
  chat.sendMessage({ role: 'user', content: 'test' });
});
