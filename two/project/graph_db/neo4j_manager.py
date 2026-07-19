import os
from langchain_community.graphs import Neo4jGraph

# 实例化并导出全局的 graph 对象
# 以后在别的代码里，直接：from neo4j.neo4j_manager import graph
# 它的底层已经处理了连接池，并且提供了强大的 AI Schema 抽取能力
graph = Neo4jGraph(
    url=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
    username=os.getenv("NEO4J_USER", "neo4j"),
    password=os.getenv("NEO4J_PASSWORD", "12345678")
)

# ================= 使用方式 (仅作测试) =================
if __name__ == "__main__":
    try:
        print("🎉 Neo4j 图谱连接成功！")
        
        # 1. 基础查询测试：使用 graph.query()
        print("\n--- 测试查询：珍珠奶茶的配方 ---")
        result = graph.query(
            "MATCH (p:Product {name: '珍珠奶茶'})-[r]->(i) RETURN p.name AS product, type(r) AS relation, i.name AS ingredient"
        )
        import pprint
        pprint.pprint(result)
        
        # 2. GraphRAG 核心能力：让大模型知道你有哪些节点和关系
        print("\n--- 自动获取图谱 Schema 结构 ---")
        graph.refresh_schema()
        print(graph.schema)

    except Exception as e:
        print(f"❌ 连接或查询失败: {e}")
