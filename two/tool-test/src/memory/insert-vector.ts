// 直接把对话存到向量数据库

import { CONVER_COLLECTION_NAME, VECTOR_DIM } from "@/config.js";
import { DataType, IndexType, MetricType } from "@zilliz/milvus2-sdk-node";
import { createMilvusClient } from "@/model.js";
import { getVector } from "@/utils.js";



async function main() {
    try {
        const client = createMilvusClient()
        await client.connectPromise
        await client.dropCollection({ collection_name: CONVER_COLLECTION_NAME })

        await client.createCollection({
            collection_name: CONVER_COLLECTION_NAME,
            fields: [
                { name: 'id', data_type: DataType.VarChar, max_length: 50, is_primary_key: true },
                { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM },
                { name: 'content', data_type: DataType.VarChar, max_length: 5000 },
                { name: 'round', data_type: DataType.Int64 },
                { name: 'timestamp', data_type: DataType.VarChar, max_length: 100 }
            ]
        })
        console.log('集合创建完成!');

        await client.createIndex({
            collection_name: CONVER_COLLECTION_NAME,
            field_name: 'vector',          // 对应 fields 里的向量字段名
            index_name: 'vector_index',    // 自定义索引名称（字符串）
            index_type: IndexType.IVF_FLAT,
            metric_type: MetricType.COSINE,
            params: { nlist: 128 }
        })
        console.log('索引创建完成!');

        await client.loadCollection({
            collection_name: CONVER_COLLECTION_NAME,
        })
        console.log('集合加载完成!');

        // 模拟对话数据
        const conversations = [
            {
                id: 'conv_001',
                content: '用户：我叫赵六，是一名数据科学家\n助手：很高兴认识你，赵六！数据科学是一个很有趣的领域，你主要研究哪个方向呢？',
                round: 1,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_002',
                content: '用户：我最近在研究机器学习算法\n助手：机器学习确实很有意思，你在研究哪些算法呢？',
                round: 2,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_003',
                content: '用户：我喜欢打篮球和看电影\n助手：运动和文化娱乐都是很好的爱好！',
                round: 3,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_004',
                content: '用户：我周末经常去电影院\n助手：看电影是很好的放松方式。',
                round: 4,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_005',
                content: '用户：我的职业是软件工程师\n助手：软件工程师是个很有前景的职业！',
                round: 5,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_006',
                content: '用户：我住在上海，喜欢这里的节奏\n助手：上海是个充满活力的城市，生活节奏快，机会也很多！',
                round: 6,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_007',
                content: '用户：我最喜欢的编程语言是 Python\n助手：Python 确实非常流行，尤其在数据科学和 AI 领域！',
                round: 7,
                timestamp: new Date().toISOString()
            },
            {
                id: 'conv_008',
                content: '用户：我今年 28 岁\n助手：28 岁正是事业发展的黄金时期，加油！',
                round: 8,
                timestamp: new Date().toISOString()
            }
        ];

        // 为每条对话生成向量并插入
        const insertData = []
        for (const conv of conversations) {
            const vector = await getVector(conv.content)
            insertData.push({
                ...conv,
                vector
            })
        }

        await client.insert({
            collection_name: CONVER_COLLECTION_NAME,
            data: insertData
        })
        console.log(`成功插入 ${insertData.length} 条对话数据!`);

    } catch (error) {
        console.log('报错了')
        console.log(error)
    }
}

main()