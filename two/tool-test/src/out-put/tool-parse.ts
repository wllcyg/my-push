import { model } from "@/model.js";
import { athleteSchema } from "@/schemas/athlete.js";

async function runMain() {

    const modelWidthTools = model.bindTools([
        {
            name: 'get_user_info',
            description: '提取和结构化获取的详细信息',
            schema: athleteSchema
        }
    ])

    const response = await modelWidthTools.invoke('计算一下 55 开')
    console.log(response);

}

runMain()