import { BOOK_COLLECTION_NAME, VECTOR_DIM, CHUNK_SIZE, COLLECTION_NAME, } from '@/config.js'
import { createMilvusClient } from '@/model.js'
import { parse } from 'path';
// @ts-ignore
import { EPubLoader } from "@langchain/community/document_loaders/fs/epub";
import { DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getVector } from '@/utils.js';

const EPUB_FILE = './src/milvus/长安的荔枝.epub';

const BOOK_NAME = parse(EPUB_FILE).name // 获取书名



const client = createMilvusClient()

// 创建图书集合

async function createCollection(bookId: string) {

  try {
    const isHasCollection = await client.hasCollection({ collection_name: BOOK_COLLECTION_NAME })
    console.log(isHasCollection, 'hasCollection')
    if (isHasCollection.value) {
      console.log(`${BOOK_COLLECTION_NAME} 集合已经存在，无需创建`)
      return
    }
    await client.createCollection({
      collection_name: BOOK_COLLECTION_NAME,
      fields: [
        { name: 'id', data_type: DataType.VarChar, max_length: 100, is_primary_key: true },
        { name: 'book_id', data_type: DataType.VarChar, max_length: 100 },
        { name: 'book_name', data_type: DataType.VarChar, max_length: 200 },
        { name: 'chapter_num', data_type: DataType.Int32 },
        { name: 'index', data_type: DataType.Int32 },
        { name: 'content', data_type: DataType.VarChar, max_length: 10000 },
        { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM }
      ],
    })

    // 常见索引
    await client.createIndex({
      collection_name: BOOK_COLLECTION_NAME,
      field_name: 'vector',
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
      params: { nlist: 1024 }
    });

    try {
      await client.loadCollection({
        collection_name: BOOK_COLLECTION_NAME,
      })
      console.log('加载集合成功');
    } catch (err) {
      console.log('加载集合失败', err);

    }

    console.log('集合创建成功并加载成功！')
  } catch (err) {
    console.log('集合创建失败', err);

  }

}

// 批量插入milvus
async function insertChunks(chunks: any[], bookId: string, chapterNum: number) {
  try {
    if (chunks.length === 0) {
      return
    }
    const insertData = await Promise.all(chunks.map(async (chunk, chunkIndex) => {
      return {
        id: `${bookId}-${chapterNum}-${chunkIndex}`,
        book_id: bookId,
        book_name: BOOK_NAME,
        chapter_num: chapterNum,
        index: chunkIndex,
        content: chunk,
        vector: await getVector(chunk as unknown as string),
      }
    }))

    const insertResult = await client.insert({
      collection_name: BOOK_COLLECTION_NAME,
      data: insertData
    })
    return Number(insertResult.insert_cnt) || 0;
  } catch (error) {
    console.error(`插入章节 ${chapterNum} 的数据时出错:`, error);
    console.error('错误详情:', error);
    throw error;
  }
}

// 对获取的数据拆分
async function loadEpub(bookId: string) {
  try {

    const loader = new EPubLoader(
      EPUB_FILE,
      {
        splitChapters: true
      }
    )

    const docs = await loader.load() // 拿到文档
    console.log(docs.length, 'docs.length')
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: 100, // 重叠 100 个字符，保持上下文连贯性
    });

    let totalInserted = 0;

    for (let chapterIndex = 0; chapterIndex < docs.length; chapterIndex++) {

      const chapter = docs[chapterIndex];
      const chapterContent = chapter.pageContent;
      const chunks = await textSplitter.splitText(chapterContent);

      if (chunks.length === 0) {
        continue;
      }

      const insertedCount = await insertChunks(chunks, bookId, chapterIndex + 1);
      totalInserted += insertedCount || 0;

    }
    return totalInserted;

  } catch (error) {
    console.log(error);

  }

}

async function run() {
  try {
    await client.connectPromise;
    console.log('连接 milvus 成功');
    const bookId = '1';
    // await createCollection(bookId);
    await loadEpub(bookId)


  } catch (err) {
    console.error('运行过程中发生错误:', err);
  }
}

run();