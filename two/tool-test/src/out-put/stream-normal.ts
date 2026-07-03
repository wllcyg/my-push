import { model } from "@/model.js";
import { athleteSchema } from "./output-zod.js";

async function runMain() {
    const prompt = `介绍一下 faker`

    try {

        const stream = await model.stream(prompt)

        let fullContent = ''
        let chunkCount = 0

        for await (const chunk of stream) {
            if (chunk.content) {
                fullContent += chunk.content
                chunkCount++;
                process.stdout.write(chunk.content as string || "")

            }
        }
        console.log(`完整的数据块${chunkCount}个`);
    } catch (e) {
        console.error(e)
    }

}

runMain()