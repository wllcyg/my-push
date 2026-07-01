import 'dotenv/config'
import { createModel, createMilvusClient } from '@/model.js'
import { VECTOR_DIM, COLLECTION_NAME } from '@/config.js'
import { DataType, IndexType, MetricType } from '@zilliz/milvus2-sdk-node'
import { getVector } from '@/utils.js'
import mockData from './data.json' with { type: 'json' }

const model = createModel({
  temperature: 0.7
});

const client = createMilvusClient()



// 创建及生成基础数据
async function init() {
  try {
    const health = await client.checkHealth()
    console.log(health, '当前的连接状态')
    await client.connectPromise;// 连接远端数据库
    console.log('连接远端数据库成功')
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: 'id', data_type: DataType.VarChar, max_length: 50, is_primary_key: true },
        { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM },
        { name: 'content', data_type: DataType.VarChar, max_length: 5000 },
        { name: 'date', data_type: DataType.VarChar, max_length: 50 },
        { name: 'mood', data_type: DataType.VarChar, max_length: 50 },
        { name: 'tags', data_type: DataType.Array, element_type: DataType.VarChar, max_capacity: 10, max_length: 50 }
      ],
    })
    console.log('创建集合成功')
    // 创建索引
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: IndexType.IVF_FLAT,//索引类型
      metric_type: MetricType.COSINE,//距离计算方法
      params: { nlist: 1024 } // 聚类中心数量

    })
    console.log('创建索引成功')
    const libraryData = await Promise.all(
      mockData.map(async (item) => {
        return {
          ...item,
          vector: await getVector(item.content),
        }
      })
    )
    console.log('向量生成成功!!');

    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: libraryData
    })
    console.log(`✓ Inserted ${insertResult.insert_cnt} records\n`);
  } catch (error) {
    console.error('执行过程中发生错误:', error);
  }
}

// 搜索数据 search,将问题向量化之后进行搜搜

async function search(question: string, limit: number = 2) {
  await client.connectPromise;// 连接远端数据库
  console.log('连接远端数据库成功')
  const vector = await getVector(question)
  const searchResult = await client.search({
    collection_name: COLLECTION_NAME,
    vector,
    limit,
    output_fields: ['content', 'date', 'mood', 'tags'],
  })
  return searchResult.results
}

// search()

async function runRag(question: string) {
  try {
    const searchResult = await search(question, 2)

    if (searchResult.length === 0) {
      return '暂时未找到相关的游记，请尝试换一种问法'
    }

    const context = searchResult.map((item, i) => {
      return `
      [日记${i + 1}]
      日期: ${item.date}
      心情: ${item.mood}
      标签: ${item.tags.join(', ')}
      内容: ${item.content}
      `
    }).join('\n\n━━━━━\n\n')

    const prompt = `
    你是一个温暖贴心的 AI 日记助手。基于用户的日记内容回答问题，用亲切自然的语言。
    
    背景知识：
    你拥有一份往日日记的上下文，其中包含日期、情绪、标签和内容。
    
    用户的问题：
    ${question}
    
    上下文信息：
    ${context}
    
      任务：
      1. 使用上下文信息回答用户的问题
      2. 严禁胡编乱造，如果上下文信息中确实不包含相关信息，请回答“抱歉，我暂时无法回答这个问题，因为我没有找到足够的上下文信息。”
      3. 请保持简洁和专业，不要添加额外的解释或说明
      
      输出格式：
      请直接回答问题，不要添加任何多余的格式或标记。

      AI 助手的回答:
    `
    const result = await model.invoke(prompt)
    console.log(result.content, 'result.content')


  } catch (error) {

  }
}

runRag('我对青海的回忆')
