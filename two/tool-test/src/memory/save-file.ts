// 将会话存到本地

import { model } from "@/model.js";
import { writeFileTool } from "@/tools/tools.js";
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import path from "node:path";

async function main() {

    const modelWidthTool = model.bindTools([writeFileTool])
    const filePath = path.join(process.cwd(), "chat_history.json")
    const sessionId = 'user_session_001'

    // 系统提示词
    const systemMessage = new SystemMessage('你是一个计算机助手,喜欢分享知识')
    console.log('第一轮会话!!!!');


    // 创建文件系统历史记录
    const history = new FileSystemChatMessageHistory({ filePath, sessionId })

    const user_message1 = new HumanMessage('你好,介绍一下c#语言')
    await history.addMessage(user_message1)
    const message1 = [systemMessage, ...(await history.getMessages())]

    const response1 = await model.invoke(message1)
    await history.addMessage(response1)

    const user_message2 = new HumanMessage('javascript和c#有什么区别')
    await history.addMessage(user_message2)

    const message2 = [systemMessage, ...(await history.getMessages())]
    const response2 = await model.invoke(message2)
    await history.addMessage(response2)
}

main()