import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from 'zod'
import { createModel } from "@/model.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const friendSchema = z.object({
    name: z.string().describe("姓名，不可为空"),
    gender: z.string().optional().describe("性别，如：男、女"),
    birth_date: z.string().optional().describe("出生日期，格式：YYYY-MM-DD"),
    company: z.string().optional().describe("当前就职公司名称"),
    title: z.string().optional().describe("当前职位"),
    phone: z.string().optional().describe("当前手机号"),
    wechat: z.string().optional().describe("微信号")
}).strict();


const nativeJsonSchema = zodToJsonSchema(friendSchema as any);

const model = createModel({
    modelKwargs: {
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "friend_info",
                schema: nativeJsonSchema,
                strict: true
            }
        }
    }
})

async function runMain() {


    try {
        const res = await model.invoke([
            new SystemMessage('你是一个信息助手,返回 json 数据'),
            new HumanMessage('介绍一下 faker')
        ])

        const data = JSON.parse(res.content as string)
        console.log(data);


    } catch (error) {
        console.error("解析出错:", error);
    }
}

runMain()
