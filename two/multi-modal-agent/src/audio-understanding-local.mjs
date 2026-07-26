/**
 * 本地 10s 音频理解 — qwen3.5-omni-flash
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

// 1. 读取本地生成的 10 秒 WAV 音频文件并转为 Base64
const audioPath = path.resolve('test_audio.wav');
const audioBuffer = fs.readFileSync(audioPath);
const base64Audio = audioBuffer.toString('base64');

// 2. 初始化模型
const model = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'qwen3.5-omni-flash',
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

// 3. 发送本地 Base64 音频给大模型
const response = await model.invoke([
    new HumanMessage({
        content: [
            { type: 'text', text: '请准确转写并总结这段音频里说的内容。' },
            {
                type: 'input_audio',
                input_audio: {
                    data: `data:audio/wav;base64,${base64Audio}`,
                    format: 'wav',
                },
            },
        ],
    }),
]);

console.log('model: qwen3.5-omni-flash');
console.log('识别结果：\n', response.content);
