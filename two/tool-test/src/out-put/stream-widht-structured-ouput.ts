import { model } from "@/model.js";
import { athleteSchema } from "./output-zod.js";

/**
 * ⚠️ 注意：这不是真正的流式输出
 *
 * 原因：withStructuredOutput 底层使用 Tool Calling 实现结构化输出。
 * Tool Calling 要求模型必须生成完整的 JSON 才能触发工具调用，
 * 因此模型在内部会等待整个响应生成完毕后，才将数据返回。
 *
 * 虽然调用了 .stream()，但实际上：
 *  - 每个 chunk 都是一个"累积合并"后的完整对象快照（而非增量文本片段）
 *  - 最后一个 chunk 才是完整数据，前面的 chunk 只是中间状态
 *  - 用户体验上依然是等待 → 一次性得到结果，没有逐字输出的效果
 *
 * 如需真流式输出，应使用 model.stream() 直接流式获取文本，
 * 而不是 withStructuredOutput().stream()。
 */
async function runMain() {
    const structuredModel = model.withStructuredOutput(athleteSchema)
    const result = await structuredModel.stream(`介绍一下 faker`)


    let fullContent = 0
    let response = null

    for await (const chunk of result) {

        fullContent++
        response = chunk
    }
    console.log(`一共接收了${fullContent}个数据块`);

    if (response) {
        console.log(JSON.stringify(response, null, 2));

    }

}

runMain()