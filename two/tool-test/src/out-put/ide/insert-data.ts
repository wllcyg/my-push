import { model } from "@/model.js";
import { z } from "zod";

import { insertFriends } from "./index.js";

const friendSchema = z.object({
    name: z.string().describe("姓名，不可为空"),
    gender: z.string().optional().describe("性别，如：男、女"),
    birth_date: z.string().optional().describe("出生日期，格式：YYYY-MM-DD"),
    company: z.string().optional().describe("当前就职公司名称"),
    title: z.string().optional().describe("当前职位"),
    phone: z.string().optional().describe("当前手机号"),
    wechat: z.string().optional().describe("微信号")
});


const friendsArrarySchema = z.array(friendSchema).describe('好友信息数组')

async function run(content: string) {
    const modelWithOutput = model.withStructuredOutput(friendsArrarySchema)

    const prompt = `
    请从以下文本中提取所有好友信息，文本中可能包含一个或多个人的信息。请将每个人的信息分别提取出来，返回一个数组。

${content}

要求：
1. 如果文本中包含多个人，请为每个人创建一个对象
2. 每个对象包含以下字段：
   - 姓名：提取文本中的人名
   - 性别：提取性别信息（男/女）
   - 出生日期：如果能找到具体日期最好，否则根据年龄描述估算（格式：YYYY-MM-DD）
   - 公司：提取公司名称
   - 职位：提取职位/头衔信息
   - 手机号：提取手机号码
   - 微信号：提取微信号
3. 如果某个字段在文本中找不到，请返回 null
4. 返回格式必须是一个数组，即使只有一个人也要放在数组中
    `
    const result = await modelWithOutput.invoke(prompt)

    if (result.length === 0) {
        console.log('没有提取到数据');
        return { count: 0, insertIds: [] }
    }

    // 将 AI 提取的结构化对象转换为 insertFriends 需要的二维数组
    const dataArray = result.map(friend => {
        // 如果大模型返回了字符串 "null"，需要转成真正的 JS null，否则数据库会报错
        const parseNull = (val: string | undefined | null) => (!val || val === "null" || val === "NULL" ? null : val);
        
        return [
            friend.name,
            parseNull(friend.gender),
            parseNull(friend.birth_date),
            parseNull(friend.company),
            parseNull(friend.title),
            parseNull(friend.phone),
            parseNull(friend.wechat)
        ];
    });

    console.log(`成功提取 ${dataArray.length} 条数据，准备插入数据库...`);
    const insertIds = await insertFriends(dataArray);

    return { count: result.length, insertIds };
}

// 随便拿段话测试一下
run('昨天我认识了新朋友李四，他是阿里云的高级开发工程师，你可以加他的微信 lisi_aliyun 或者打电话 13988889999 找他。').catch((err) => {
    console.error(err)
})

