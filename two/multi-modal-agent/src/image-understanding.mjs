/**
 * 图像理解 — qwen-vl-plus
 * DashScope OpenAI 兼容接口 + ChatOpenAI
 */
import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'qwen-vl-plus',
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

const response = await model.invoke([
    new HumanMessage({
        content: [
            { type: 'text', text: '详细描述这张图片的内容' },
            {
                type: 'image_url',
                image_url: {
                    url: 'https://image-dev.cheatppf.xyz/aaa/bbb/test_cat_1785072444172.png',
                },
            },
        ],
    }),
]);

console.log('model: qwen-vl-plus');
console.log(response.content);