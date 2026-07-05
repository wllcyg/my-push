import "dotenv/config";
import { embeddingModel, createMilvusClient } from "@/model.js";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { Document } from "@langchain/core/documents";

const COLLECTION_NAME = "weekly_report_examples";

const examples = [
    {
        scenario: '做基础设施稳定性治理，重点在修复 Bug 和降低服务风险。',
        report_snippet:
            '- 支付链路处理线上 P1 级故障 1 起、P2 故障 2 起，全部在 SLA 内闭环；\n' +
            '- 对 5 个高风险接口补充了限流熔断策略，覆盖 80% 高峰期流量；\n' +
            '- 增加 6 条延迟抖动告警，减少漏报隐患。',
    },
    {
        scenario: '偏向对外展示成果，突出新功能上线、业务价值和跨部门分享。',
        report_snippet:
            '- 上线「实时订单看板」，提供业务核心转化漏斗的实时观测；\n' +
            '- 首次打通埋点 ➔ 数据仓库 ➔ 实时服务的闭环，支撑精细化运营；\n' +
            '- 面向产品和运营举办 2 场内部分享，反响热烈。',
    },
    {
        scenario: '主要是清理历史技术债，重构老旧模块，优化代码结构，写单测与文档。',
        report_snippet:
            '- 重构结算模块老旧的 SQL 逻辑，查询耗时由 1.2s 降至 200ms；\n' +
            '- 补齐核心结算接口单测，覆盖率从 45% 提升至 85%；\n' +
            '- 整理并输出了《结算模块架构演进文档》，方便新人快速上手。',
    },
    {
        scenario: '本期主要是大促前的性能压测、极限容量评估及限流降级演练。',
        report_snippet:
            '- 完成核心接口 5 倍峰值流量全链路压测，P99 稳定在 200ms 以内；\n' +
            '- 演练了网关层限流和下游熔断机制，验证了系统高负载下的自愈能力；\n' +
            '- 制定了大促期间的 4 级应急保障预案，保障系统不崩溃。',
    },
    {
        scenario: '团队日常行政管理、新人培训、跨部门沟通及流程优化。',
        report_snippet:
            '- 完成 2 名应届生入职培训，帮助其在本周顺利提交了首个特性代码；\n' +
            '- 与运维团队沟通并理顺了新的发布审批流程，发布效率提升 15%；\n' +
            '- 组织了团队双周技术复盘会，确定了下阶段的重构目标。',
    }
];

async function prepareMilvusData() {
    try {
        const client = createMilvusClient();
        await client.connectPromise;
        const hasColl = await client.hasCollection({ collection_name: COLLECTION_NAME });
        if (hasColl.value) {
            console.log(`[Milvus] 发现已存在集合 ${COLLECTION_NAME}，正在删除以进行重置...`);
            await client.dropCollection({ collection_name: COLLECTION_NAME });
        }

        console.log(`[Milvus] 正在利用 LangChain 写入 ${examples.length} 条示例数据到向量库中...`);
        const documents = examples.map(item => new Document({
            pageContent: item.scenario,
            metadata: {
                scenario: item.scenario,
                report_snippet: item.report_snippet
            }
        }));

        await Milvus.fromDocuments(
            documents,
            embeddingModel,
            {
                collectionName: COLLECTION_NAME,
                clientConfig: {
                    address: process.env.ZILLIZ_ENDPOINT as string,
                    token: process.env.ZILLIZ_API_KEY as string,
                },
            }
        );
        console.log(`[Milvus] 示例数据成功注入！您现在可以独立运行语义搜索测试。`);
    } catch (error) {
        console.error("[Milvus] 数据写入出错:", error);
    }
}

prepareMilvusData();
