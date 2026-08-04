# ECharts 常见图表类型 JSON 模板参考

本文档包含在实际业务中常见的几种 ECharts 额外图表模版，供 Agent 快速参考生成。

---

## 1. 漏斗图 (Funnel Chart) — 转化率分析

```json
{
  "title": { "text": "知识库文档解析与向量化全流程转化率" },
  "tooltip": { "trigger": "item", "formatter": "{a} <br/>{b} : {c}%" },
  "series": [
    {
      "name": "转化阶段",
      "type": "funnel",
      "left": "10%",
      "top": 60,
      "bottom": 60,
      "width": "80%",
      "min": 0,
      "max": 100,
      "minSize": "0%",
      "maxSize": "100%",
      "sort": "descending",
      "gap": 2,
      "label": { "show": true, "position": "inside" },
      "data": [
        { "value": 100, "name": "文件上传入库" },
        { "value": 92, "name": "异步 Markdown 解析" },
        { "value": 88, "name": "文本切片 Chunking" },
        { "value": 85, "name": "pgvector 向量化存储" }
      ]
    }
  ]
}
```

---

## 2. 雷达图 (Radar Chart) — 多维度评估分析

```json
{
  "title": { "text": "AI Agent 系统架构综合能力维度打分" },
  "tooltip": {},
  "radar": {
    "indicator": [
      { "name": "检索准确率 (Precision)", "max": 100 },
      { "name": "首字响应速度 (TTFT)", "max": 100 },
      { "name": "意图路由分类准确度", "max": 100 },
      { "name": "多工具协作能力 (Tool Call)", "max": 100 },
      { "name": "系统容灾与鲁棒性", "max": 100 }
    ]
  },
  "series": [
    {
      "name": "能力指标",
      "type": "radar",
      "data": [
        {
          "value": [90, 95, 98, 92, 96],
          "name": "当前系统评估"
        }
      ]
    }
  ]
}
```
