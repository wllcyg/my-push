// ai 总结聊天

import { model } from "@/model.js";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, AIMessage, getBufferString, SystemMessage } from "@langchain/core/messages";


// 总结历史对话消息

async function summarizeHistory(messages: any[]) {

    if (messages.length == 0) {
        return ''
    }

    const conversationText = getBufferString(messages, '用户', '助手')
    const summaryPrompt = `
    请总结以下对话的核心内容,保留重要信息

    ${conversationText}

    总结:
    `
    const summaryResponse = await model.invoke([new SystemMessage(summaryPrompt)])
    return summaryResponse.content
}


async function summarizationMemoeyDemo() {

    const history = new InMemoryChatMessageHistory();
    const maxMessages = 6;
    const messages = [
        { type: 'human', content: '我想学做红烧肉，你能教我吗？' },
        { type: 'ai', content: '当然可以！红烧肉是一道经典的中式菜肴。首先需要准备五花肉、冰糖、生抽、老抽、料酒、葱姜蒜和八角等香料。' },
        { type: 'human', content: '五花肉需要切多大块？' },
        { type: 'ai', content: '建议切成3-4厘米见方的块，这样既容易入味，口感也更好。切好后可以用冷水下锅焯水，加点料酒去腥。' },
        { type: 'human', content: '炒糖色的时候有什么技巧吗？' },
        { type: 'ai', content: '炒糖色是关键步骤。锅中放少许油，放入冰糖，用小火慢慢熬化。等糖浆变成枣红色并开始冒密集的小泡时，立刻下入肉块翻炒上色。' },
        { type: 'human', content: '如果我不小心把糖色炒糊了怎么办？' },
        { type: 'ai', content: '如果不小心炒糊了会发苦，建议倒掉重新炒。宁可炒得浅一点，也不要炒过头。' },
        { type: 'human', content: '肉上色之后加水有什么讲究？' },
        { type: 'ai', content: '一定要加开水，而且水量要一次性加足，最好没过肉块。如果加冷水会让肉质收缩变柴。' },
        { type: 'human', content: '需要炖多长时间？' },
        { type: 'ai', content: '一般需要炖40-60分钟，用小火慢炖，直到肉变得软糯入味。可以用筷子戳一下，能轻松扎透说明火候差不多了。' },
        { type: 'human', content: '什么时候加盐比较好？' },
        { type: 'ai', content: '建议在出锅前15分钟左右加盐。如果加得太早，肉也会变紧实，不容易炖烂。' },
        { type: 'human', content: '最后收汁的时候要注意什么？' },
        { type: 'ai', content: '收汁时要开大火，并且不断翻动，让浓稠的汤汁均匀地包裹在肉块上。看到颜色红亮诱人就可以关火了。' },
        { type: 'human', content: '我可以加点土豆或者鹌鹑蛋吗？' },
        { type: 'ai', content: '非常好的主意！土豆或者煮熟剥皮的鹌鹑蛋可以在炖煮的后半程（大约剩20分钟时）加入，它们吸满肉汁后会非常美味。' },
        { type: 'human', content: '太棒了，我这就去试试。谢谢你的指导！' },
        { type: 'ai', content: '不客气！祝你做出美味的红烧肉。如果烹饪过程中遇到任何问题，随时来问我。期待你的大作！' }
    ];

    for (const msg of messages) {
        if (msg.type === 'human') {
            await history.addMessage(new HumanMessage(msg.content))
        } else {
            await history.addMessage(new AIMessage(msg.content))
        }
    }

    let allMessage = await history.getMessages()

    if (allMessage.length >= maxMessages) {

        const keepRecent = 2

        const recent = allMessage.slice(-keepRecent) // 保留的消息
        const messagesToSummarize = allMessage.slice(0, -keepRecent) // 需要总结的消息

        const summary = await summarizeHistory(messagesToSummarize) // 总结后的消息
        console.log(`这是历史消息:${summary}`);

        await history.clear()
        await history.addMessage(new SystemMessage(summary))

    }
}


summarizationMemoeyDemo()



// =====================================================
// 按照 Token 大小触发总结的版本
// =====================================================

import { getEncoding } from "js-tiktoken";

// 计算消息数组的总 Token 数
function countTokens(messages: any[]): number {
    const enc = getEncoding("cl100k_base");
    let total = 0;
    for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        total += enc.encode(content).length;
    }
    return total;
}

async function summarizationByTokenDemo() {

    const history = new InMemoryChatMessageHistory();

    // 触发总结的 Token 上限（超过这个数量就压缩历史）
    const maxTokens = 200;

    // 每次触发总结时，保留最近的几条消息不参与总结（保留上下文连贯性）
    const keepRecentCount = 2;

    const messages = [
        { type: 'human', content: '我想学做红烧肉，你能教我吗？' },
        { type: 'ai', content: '当然可以！红烧肉是一道经典的中式菜肴。首先需要准备五花肉、冰糖、生抽、老抽、料酒、葱姜蒜和八角等香料。' },
        { type: 'human', content: '五花肉需要切多大块？' },
        { type: 'ai', content: '建议切成3-4厘米见方的块，这样既容易入味，口感也更好。切好后可以用冷水下锅焯水，加点料酒去腥。' },
        { type: 'human', content: '炒糖色的时候有什么技巧吗？' },
        { type: 'ai', content: '炒糖色是关键步骤。锅中放少许油，放入冰糖，用小火慢慢熬化。等糖浆变成枣红色并开始冒密集的小泡时，立刻下入肉块翻炒上色。' },
        { type: 'human', content: '如果我不小心把糖色炒糊了怎么办？' },
        { type: 'ai', content: '如果不小心炒糊了会发苦，建议倒掉重新炒。宁可炒得浅一点，也不要炒过头。' },
        { type: 'human', content: '肉上色之后加水有什么讲究？' },
        { type: 'ai', content: '一定要加开水，而且水量要一次性加足，最好没过肉块。如果加冷水会让肉质收缩变柴。' },
        { type: 'human', content: '需要炖多长时间？' },
        { type: 'ai', content: '一般需要炖40-60分钟，用小火慢炖，直到肉变得软糯入味。可以用筷子戳一下，能轻松扎透说明火候差不多了。' },
        { type: 'human', content: '什么时候加盐比较好？' },
        { type: 'ai', content: '建议在出锅前15分钟左右加盐。如果加得太早，肉也会变紧实，不容易炖烂。' },
        { type: 'human', content: '最后收汁的时候要注意什么？' },
        { type: 'ai', content: '收汁时要开大火，并且不断翻动，让浓稠的汤汁均匀地包裹在肉块上。看到颜色红亮诱人就可以关火了。' },
        { type: 'human', content: '我可以加点土豆或者鹌鹑蛋吗？' },
        { type: 'ai', content: '非常好的主意！土豆或者煮熟剥皮的鹌鹑蛋可以在炖煮的后半程（大约剩20分钟时）加入，它们吸满肉汁后会非常美味。' },
        { type: 'human', content: '太棒了，我这就去试试。谢谢你的指导！' },
        { type: 'ai', content: '不客气！祝你做出美味的红烧肉。如果烹饪过程中遇到任何问题，随时来问我。期待你的大作！' }
    ];

    for (const msg of messages) {
        if (msg.type === 'human') {
            await history.addMessage(new HumanMessage(msg.content));
        } else {
            await history.addMessage(new AIMessage(msg.content));
        }
    }

    let allMessage = await history.getMessages();

    // 精确计算历史消息的总 Token 数
    const totalTokens = countTokens(allMessage);
    console.log(`当前历史消息总 Token 数: ${totalTokens}，上限: ${maxTokens}`);

    if (totalTokens > maxTokens) {
        console.log('Token 超出预算，开始触发总结压缩...');

        const recent = allMessage.slice(-keepRecentCount);          // 保留最近 N 条消息
        const messagesToSummarize = allMessage.slice(0, -keepRecentCount); // 其余旧消息送去总结

        const tokensToSummarize = countTokens(messagesToSummarize);
        console.log(`将对 ${messagesToSummarize.length} 条消息（共 ${tokensToSummarize} tokens）进行总结...`);

        // 调用 AI 总结旧消息
        const summary = await summarizeHistory(messagesToSummarize);
        console.log(`\n总结结果:\n${summary}\n`);

        // 清空历史，将总结摘要作为 SystemMessage，再追加最近的消息
        await history.clear();
        await history.addMessage(new SystemMessage(`以下是之前对话的摘要:\n${summary}`));
        for (const msg of recent) {
            await history.addMessage(msg);
        }

        const afterMessages = await history.getMessages();
        const afterTokens = countTokens(afterMessages);
        console.log(`压缩完成！历史消息从 ${totalTokens} tokens 压缩到 ${afterTokens} tokens`);
        console.log(`当前历史消息数量: ${afterMessages.length} 条`);
    }
}


// summarizationByTokenDemo()
