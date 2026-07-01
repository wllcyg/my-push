import { model } from "@/model.js";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

async function main() {

    const history = new InMemoryChatMessageHistory()

    const systemMessage = new SystemMessage('你是一个友好的计算机助手,喜欢分享计算机语言相关的技术')

    console.log('我们的第一次对话');

    const userMessage1 = new HumanMessage('你好,给我说一下 c 语言')
    await history.addMessage(userMessage1)

    const message1 = [systemMessage, ...(await history.getMessages())]
    const response1 = await model.invoke(message1)
    await history.addMessage(response1)

    console.log('开始第二次对话!!!!!');

    const userMessage2 = new HumanMessage('C 语言有什么注意事项吗')
    await history.addMessage(userMessage2)
    const message2 = [systemMessage, ...(await history.getMessages())]
    const response2 = await model.invoke(message2)
    await history.addMessage(response2)

    // 展示所有的信息
    console.log(await history.getMessages());
}
main();