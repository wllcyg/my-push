import { model } from "@/model.js";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { log } from "node:console";


const prompt = ChatPromptTemplate.fromMessages([
    [
        'system',
        `你是一个简洁的中文助手,会用 1-2 句话回答用户的问题,重点给出明确有用的信息`
    ],
    new MessagesPlaceholder('history'),
    ['human', '{question}']

])

const simpleChain = prompt.pipe(model).pipe(new StringOutputParser()) // 流式输出

const messageHistory = new Map()

const getHistory = async (sessioId: string) => {
    if (!messageHistory.has(sessioId)) {
        messageHistory.set(sessioId, new InMemoryChatMessageHistory());
    }
    return messageHistory.get(sessioId);
}

const chain = new RunnableWithMessageHistory({
    runnable: simpleChain,
    getMessageHistory: (sessionId: string) => getHistory(sessionId),
    inputMessagesKey: 'question',
    historyMessagesKey: 'history',
})


async function runMain() {
    console.log('第一次对话!!!!');

    const result1 = await chain.invoke(
        {
            question: '我的名字叫张三'
        },
        {
            configurable: {
                sessionId: 'user_01'
            }
        }
    )
    console.log(result1);

    const result2 = await chain.invoke(
        {
            question: '我叫什么名字'
        },
        {
            configurable: {
                sessionId: 'user_01'
            }
        }
    )
    console.log(result2);
}

runMain()