// 按照对话数量截断,按照 token 截断

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage, HumanMessage, SystemMessage, trimMessages } from "@langchain/core/messages";
import { getEncoding } from "js-tiktoken";

async function main() {


    // 按照数量截取
    const history = new InMemoryChatMessageHistory()

    const maxMessage = 4

    const messages = [
        { type: 'human', content: '我叫张三' },
        { type: 'ai', content: '你好张三，很高兴认识你！' },
        { type: 'human', content: '我今年25岁' },
        { type: 'ai', content: '25岁正是青春年华，有什么我可以帮助你的吗？' },
        { type: 'human', content: '我喜欢编程' },
        { type: 'ai', content: '编程很有趣！你主要用什么语言？' },
        { type: 'human', content: '我住在北京' },
        { type: 'ai', content: '北京是个很棒的城市！' },
        { type: 'human', content: '我的职业是软件工程师' },
        { type: 'ai', content: '软件工程师是个很有前景的职业！' }
    ]

    for (const msg of messages) {
        if (msg.type === 'human') {
            await history.addMessage(new HumanMessage(msg.content))
        } else {
            await history.addMessage(new AIMessage(msg.content))
        }
    }

    let allMessages = await history.getMessages()

    // 开始截断
    const trimmedMessage = allMessages.slice(-maxMessage)

}



// 按照 token 截断

// 计算消息数组的总 token

function countTokens(messages: any[], encoder: any) {
    let total = 0
    for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        total += encoder.encode(content).length
    }
    return total
}

async function main2() {
    const history = new InMemoryChatMessageHistory()

    const maxTokens = 50
    const enc = getEncoding("cl100k_base")

    const msgs = [
        new SystemMessage('你是一个有帮助的AI助手.'),
        new HumanMessage('今天天气怎么样?'),
        new AIMessage('我无法直接获取实时天气信息,但你可以查看天气预报应用.'),
        new HumanMessage('请列出中国的前三个城市'),
        new AIMessage('中国的前三个城市是北京,上海,广州.'),
    ]

    for (const msg of msgs) {
        await history.addMessage(msg)
    }

    let allMessage = await history.getMessages()

    const trimMsg = await trimMessages(allMessage, {
        maxTokens,
        strategy: 'last',
        tokenCounter: async (msgs) => countTokens(msgs, enc)
    })

    console.log(`\n=== 按照 Token 截断结果 ===`);
    console.log(`原始消息数: ${allMessage.length}`);
    console.log(`截断后消息数: ${trimMsg.length}`);
    console.log('截断后的消息详情:', JSON.stringify(trimMsg, null, 2));
}

main2()
