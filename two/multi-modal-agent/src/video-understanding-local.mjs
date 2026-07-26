/**
 * 本地视频理解测试 — qwen3.5-omni-flash
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

// 1. 读取本地测试视频文件并转为 Base64 Data URL
const videoPath = path.resolve('test_video.mp4');
const videoBuffer = fs.readFileSync(videoPath);
const base64Video = videoBuffer.toString('base64');
const dataUrl = `data:video/mp4;base64,${base64Video}`;

// 2. 初始化模型
const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'qwen3.5-omni-flash',
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

// 3. 发送视频内容进行分析总结
const response = await model.invoke([
    new HumanMessage({
        content: [
            { type: 'text', text: '详细总结这个视频的主要内容和场景细节。' },
            {
                type: 'video_url',
                video_url: {
                    url: dataUrl,
                },
            },
        ],
    }),
]);

console.log('model: qwen3.5-omni-flash');
console.log('视频总结结果：\n', response.content);
