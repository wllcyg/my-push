/** Agent 依赖注入 Token 常量定义文件（避免 Module 与 Service 循环依赖） */
export const AGENT_TOOLS = Symbol('AGENT_TOOLS');

/**
 * 统一的大模型名称与默认配置管理中心
 */
export const AGENT_MODEL_CONFIG = {
  /** 主推理模型名称 (默认采用全功能强推理模型) */
  MAIN_MODEL_NAME: 'qwen3.6-plus',

  /** 极速推理模型名称 (用于画图 ECharts 与快速直答场景，吞吐速度提升 3~5 倍) */
  FAST_MODEL_NAME: 'qwen-turbo',

  /** 意图路由分类模型名称 (轻量低延迟) */
  CLASSIFIER_MODEL_NAME: 'qwen-turbo',

  /** 文本重排 Rerank 模型名称 */
  RERANK_MODEL_NAME: 'qwen3-vl-rerank',

  /** 向量维度规范 */
  VECTOR_DIM: 1024,
};

