import os
import sys
from pathlib import Path
from modules.core.vector_store import get_embeddings

# 将项目根目录添加到 sys.path，以便能够导入 modules 模块
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from modules.config.settings import get_settings
from pymilvus import MilvusClient, DataType
from langchain_text_splitters import RecursiveCharacterTextSplitter

def load_chunks(data_dir="./data"):
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"数据目录不存在: {data_dir}")
    
    files = [f for f in data_path.iterdir() if f.is_file() and f.suffix.lower() in [".txt", ".md"]]
    if not files:
        raise FileNotFoundError(f"目录内无 .txt/.md 文件: {data_dir}")

    docs = []
    for f in files:
        content = f.read_text(encoding="utf-8")
        docs.append({"page_content": content, "metadata": {"source": f.name}})

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )
    
    chunks = splitter.create_documents(
        texts=[doc["page_content"] for doc in docs],
        metadatas=[doc["metadata"] for doc in docs]
    )
    return chunks

def main():
    settings = get_settings()
    
    COLLECTION_NAME = "rag_docs"
    
    # 1. 使用我们项目封装好的向量化模块
    embeddings = get_embeddings()

    print("Connecting to Milvus (Zilliz Cloud)...")
    # 2. 连接我们在 settings.py 中配置的 Zilliz (Milvus) 云端
    client = MilvusClient(
        uri=settings.zilliz_endpoint,
        token=settings.zilliz_api_key
    )
    print("✓ Connected\n")

    # 修改为获取当前脚本所在目录下的 data 文件夹
    data_dir = Path(__file__).parent / "data"
    chunks = load_chunks(data_dir)

    if client.has_collection(collection_name=COLLECTION_NAME):
        client.drop_collection(collection_name=COLLECTION_NAME)
        print(f"Dropped collection: {COLLECTION_NAME}\n")

    print("Generating embeddings...")
    texts = [chunk.page_content for chunk in chunks]
    vectors = embeddings.embed_documents(texts)
    dim = len(vectors[0])

    print("Creating collection...")
    schema = MilvusClient.create_schema(auto_id=True, enable_dynamic_field=False)
    schema.add_field(field_name="langchain_primaryid", datatype=DataType.INT64, is_primary=True, auto_id=True)
    schema.add_field(field_name="langchain_vector", datatype=DataType.FLOAT_VECTOR, dim=dim)
    schema.add_field(field_name="langchain_text", datatype=DataType.VARCHAR, max_length=8000)
    schema.add_field(field_name="source", datatype=DataType.VARCHAR, max_length=256)
    
    index_params = client.prepare_index_params()
    index_params.add_index(
        field_name="langchain_vector",
        index_type="IVF_FLAT",
        metric_type="L2",
        params={"nlist": 128}
    )

    client.create_collection(
        collection_name=COLLECTION_NAME,
        schema=schema,
        index_params=index_params
    )
    print("Collection created and indexed")
    
    client.load_collection(collection_name=COLLECTION_NAME)
    print("Collection loaded")
    
    print("\nInserting...")
    data = []
    for i, chunk in enumerate(chunks):
        data.append({
            "langchain_text": chunk.page_content,
            "langchain_vector": vectors[i],
            "source": chunk.metadata["source"]
        })
    
    res = client.insert(
        collection_name=COLLECTION_NAME,
        data=data
    )
    print(f"✓ Inserted {res.get('insert_count', len(data))} records\n")

if __name__ == "__main__":
    main()