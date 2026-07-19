import asyncio
import os
import sys
from datetime import datetime
from pymilvus import (
    connections,
    utility,
    FieldSchema,
    CollectionSchema,
    DataType,
    Collection,
)

# 确保能正确引入项目的 modules 包
root_dir = os.path.dirname(os.path.abspath(__file__))
if root_dir not in sys.path:
    sys.path.append(root_dir)

from modules.config.settings import get_settings
from modules.elasticsearch.es_service import es_service
from modules.core.llm import create_embeddings  # 假设你在这个模块里封装了 embeddings，如果没有则下面我们会手写

INDEX_NAME = 'life_notes'
DOC_TEXT = 'doc_text'
EMBEDDING = 'embedding'

ROWS = [
    {
        "id": 'life_01',
        "note_title": '周末煲汤小备忘',
        "note_body": '排骨冷水下锅焯一下，加姜片料酒；换了砂锅小火炖一小时，最后放盐和白胡椒，海带要提前泡发切条。',
        "tags": ['下厨', '周末'],
        "mood": '馋',
        "priority": 2,
    },
    {
        "id": 'life_02',
        "note_title": '晚饭后遛狗路线',
        "note_body": '小区东门出去沿河岸走一圈大概四十分钟，记得带拾便袋和水壶；下雨天改地下停车场那层绕两圈也行。',
        "tags": ['宠物', '散步'],
        "mood": '放松',
        "priority": 3,
    },
    {
        "id": 'life_03',
        "note_title": '阳台绿植浇水频率',
        "note_body": '绿萝见干再浇，龟背竹叶面可以偶尔喷水；夏天蒸发快早上看一眼土表，冬天少浇防止烂根。',
        "tags": ['家务', '植物'],
        "mood": '碎碎念',
        "priority": 1,
    },
    {
        "id": 'life_04',
        "note_title": '路由器偶尔断流排查笔记',
        "note_body": '先重启光猫再重启路由；信道改成自动或固定 36；固件升级到官网最新版；还不行就还原出厂单独测网线。',
        "tags": ['数码', '折腾'],
        "mood": '烦躁',
        "priority": 2,
    },
    {
        "id": 'life_05',
        "note_title": '净水器滤芯更换记录',
        "note_body": '官网登记的机身序列 SN-MILO-77821；上次换的是第三代 RO 复合滤芯，配件订单号 PO-20250409-K9；下次提醒换前置 PP 棉。',
        "tags": ['家务', '维保'],
        "mood": '琐事',
        "priority": 1,
    },
    {
        "id": 'life_06',
        "note_title": '梧州龟苓膏粉冲泡比例',
        "note_body": '双钱牌粉一包兑常温凉水先搅匀再小火搅拌到冒小泡；千万别用滚烫开水直接冲容易结块；可加少量桂花蜜。',
        "tags": ['下厨', '甜品'],
        "mood": '解馋',
        "priority": 1,
    },
    {
        "id": 'life_07',
        "note_title": '租房合同划的重点句',
        "note_body": '第八条写的是押一付三提前三十日书面通知；手写补充了一句「甲方不得以不正当理由扣减退房押金」记得双方都签了字。',
        "tags": ['租房', '法律'],
        "mood": '谨慎',
        "priority": 3,
    },
    {
        "id": 'life_08',
        "note_title": '肉汤熬久了反而涩',
        "note_body": '大块骨肉要先焯掉浮沫，文火咕嘟太久胶质出来了汤会发黏发涩；觉得不清爽可以中途打掉一层油，起锅前再调味。',
        "tags": ['下厨', '技巧'],
        "mood": '琢磨',
        "priority": 2,
    },
    {
        "id": 'life_09',
        "note_title": '半夜趴窗台透气',
        "note_body": '脑子停不下来就一直复盘白天在会上说的话，越想越清醒；干脆开窗吹两分钟冷风，把手机扔到客厅充电再回屋。',
        "tags": ['情绪', '失眠'],
        "mood": '飘',
        "priority": 2,
    },
    {
        "id": 'life_10',
        "note_title": '出差酒店网速玄学',
        "note_body": '同一个SSID走廊尽头满格会议室里假信号；连手机热点写周报反而稳；视频会议尽量靠窗座位别躲在最里间死角。',
        "tags": ['差旅', '办公'],
        "mood": '无奈',
        "priority": 2,
    },
]

async def seed_elasticsearch(index_name: str, rows: list):
    print("\n[Elasticsearch]")
    settings = get_settings()
    await es_service.connect(settings.es_host)

    # 删除旧索引
    if await es_service.client.indices.exists(index=index_name):
        print("删除已有索引...")
        await es_service.client.indices.delete(index=index_name)
        print("✓ 已删除")

    print("创建索引与 mapping...")
    mappings = {
        "properties": {
            "note_title": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
            "note_body": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
            "tags": {"type": "keyword"},
            "mood": {"type": "keyword"},
            "priority": {"type": "integer"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
        }
    }
    await es_service.create_index_if_not_exists(index_name, mappings)

    now = datetime.utcnow().isoformat()
    print(f"写入 {len(rows)} 条文档...")
    
    es_docs = []
    for row in rows:
        # 深拷贝以防修改原数据
        doc = dict(row)
        # 用 id 字段作为 _id 传入
        doc["_id"] = doc.pop("id")
        doc["created_at"] = now
        doc["updated_at"] = now
        es_docs.append(doc)

    await es_service.bulk_insert(index_name, es_docs)
    print("✓ ES 写入完成")
    await es_service.close()


def seed_milvus(collection_name: str, rows: list):
    print("\n[Milvus]")
    settings = get_settings()

    # 直接使用封装好的 create_embeddings
    from modules.core.llm import create_embeddings
    embeddings = create_embeddings()

    texts = [f"{row['note_title']}\n{row['note_body']}" for row in rows]
    
    print("生成向量嵌入...")
    vectors = embeddings.embed_documents(texts)
    dim = len(vectors[0])

    print("连接 Milvus...")
    uri = settings.zilliz_endpoint
    token = settings.zilliz_api_key
    if not uri:
        # 回退到本地默认端口
        uri = "http://localhost:19530"

    # PyMilvus 连接
    connections.connect("default", uri=uri, token=token)
    print("✓ 已连接")

    if utility.has_collection(collection_name):
        print("删除已有集合...")
        utility.drop_collection(collection_name)
        print("✓ 已删除")

    print("创建集合...")
    fields = [
        FieldSchema(name="langchain_primaryid", dtype=DataType.INT64, is_primary=True, auto_id=True),
        FieldSchema(name="id", dtype=DataType.VARCHAR, max_length=100),
        FieldSchema(name="note_title", dtype=DataType.VARCHAR, max_length=512),
        FieldSchema(name="note_body", dtype=DataType.VARCHAR, max_length=4096),
        FieldSchema(name="mood", dtype=DataType.VARCHAR, max_length=64),
        FieldSchema(name="priority", dtype=DataType.VARCHAR, max_length=16),
        FieldSchema(name="tags", dtype=DataType.VARCHAR, max_length=256),
        FieldSchema(name=DOC_TEXT, dtype=DataType.VARCHAR, max_length=10000),
        FieldSchema(name=EMBEDDING, dtype=DataType.FLOAT_VECTOR, dim=dim),
    ]
    schema = CollectionSchema(fields=fields, description="Life Notes Collection")
    collection = Collection(name=collection_name, schema=schema)
    print("✓ 集合创建成功")

    print("创建向量索引...")
    index_params = {
        "metric_type": "L2",
        "index_type": "HNSW",
        "params": {"M": 8, "efConstruction": 64},
    }
    collection.create_index(field_name=EMBEDDING, index_params=index_params)
    print("✓ 索引创建成功")

    collection.load()
    print("✓ 集合已加载")

    print(f"插入 {len(rows)} 条...")
    # PyMilvus 要求传入数据格式为 list of lists (按列传入) 或者 list of dicts（版本 >= 2.3 支持直接传 dict 数组）
    insert_data = []
    for i, row in enumerate(rows):
        insert_data.append({
            "id": row["id"],
            "note_title": row["note_title"],
            "note_body": row["note_body"],
            "mood": row["mood"],
            "priority": str(row["priority"]),
            "tags": ",".join(row["tags"]),
            DOC_TEXT: texts[i],
            EMBEDDING: vectors[i],
        })

    collection.insert(insert_data)
    collection.flush()
    print(f"✓ Milvus 写入完成（插入 {len(rows)} 条）")


async def main():
    try:
        # ES 是完全异步客户端，需要 await
        await seed_elasticsearch(INDEX_NAME, ROWS)
        # PyMilvus 当前版本是以同步阻塞为主
        seed_milvus(INDEX_NAME, ROWS)
    except Exception as e:
        import traceback
        print(f"\n❌ 错误: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
