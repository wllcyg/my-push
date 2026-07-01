import { model } from "@/model.js";
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import path from "node:path";

async function main() {
    const filePath = path.join(process.cwd(), "chat_history.json");
    const sessionId = "user_session_001";

    const systemMessage = new SystemMessage("你是一个计算机助手,喜欢分享知识");

    const restoreHistory = new FileSystemChatMessageHistory({
        filePath,
        sessionId,
    });

    const restoreMessages = await restoreHistory.getMessages();
    console.log("恢复的会话历史", restoreMessages.length);

    const userMessage3 = new HumanMessage("c# 的应用");
    await restoreHistory.addMessage(userMessage3);

    const restoreMessages2 = [
        systemMessage,
        ...(await restoreHistory.getMessages()),
    ];

    const response3 = await model.invoke(restoreMessages2);
    console.log("response3", response3.content);
}

main();