export interface FewShotExample {
  id: string;
  category: 'echarts' | 'knowledge_rag' | 'general';
  scenario: string;
  keywords: string[];
  userQuery: string;
  assistantOutput: string;
}

/**
 * 预置高品质 Semantic Few-Shot 少样本范例库
 */
export const PRESET_FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    id: 'echarts_bar_chart',
    category: 'echarts',
    scenario: '用户要求生成柱状图/数据对比图表/可视化',
    keywords: ['柱状图', '对比', '数据图表', '柱形图', '占比', '销量'],
    userQuery: '请帮我对比分析一下过去四个季度的销售额数据并画个图',
    assistantOutput: `根据您提供的数据，以下是四个季度的销售额对比分析：

\`\`\`json:echarts
{
  "title": {
    "text": "季度销售额对比图",
    "left": "center"
  },
  "tooltip": {
    "trigger": "axis"
  },
  "xAxis": {
    "type": "category",
    "data": ["Q1", "Q2", "Q3", "Q4"]
  },
  "yAxis": {
    "type": "value",
    "name": "销售额 (万元)"
  },
  "series": [
    {
      "name": "销售额",
      "type": "bar",
      "data": [120, 200, 150, 280],
      "itemStyle": {
        "color": "#5470c6"
      }
    }
  ]
}
\`\`\`

从趋势来看，Q4 季度的销售额达到了峰值（280万元），较 Q1 增长了约 133%。`,
  },
  {
    id: 'echarts_line_chart',
    category: 'echarts',
    scenario: '用户要求展示趋势图/折线图/变化曲线',
    keywords: ['趋势图', '折线图', '变化曲线', '走势', '增长趋势'],
    userQuery: '分析一下近一周系统的活跃用户数变化趋势并绘制折线图',
    assistantOutput: `近一周系统日活跃用户数 (DAU) 呈现稳步上升趋势，具体可视化图表如下：

\`\`\`json:echarts
{
  "title": {
    "text": "近一周系统 DAU 变化趋势",
    "left": "center"
  },
  "tooltip": {
    "trigger": "axis"
  },
  "xAxis": {
    "type": "category",
    "data": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
  },
  "yAxis": {
    "type": "value"
  },
  "series": [
    {
      "name": "活跃用户数",
      "type": "line",
      "smooth": true,
      "data": [1200, 1350, 1280, 1420, 1600, 1850, 1920],
      "areaStyle": {}
    }
  ]
}
\`\`\`

周末用户活跃度达到高点，提示系统在周末承担了更高的访问流量。`,
  },
  {
    id: 'knowledge_rag_citation',
    category: 'knowledge_rag',
    scenario: '基于本地知识库问答并带有参考文档规范引用角标',
    keywords: ['规范', '制度', '员工手册', '报销', '知识库', '文档'],
    userQuery: '公司差旅报销的标准和流程是什么？',
    assistantOutput: `根据企业内部规章制度，差旅报销的标准和流程如下：

1. **住宿与交通标准**：一线城市住宿标准为 500 元/天，二线城市为 350 元/天 [1]。市内交通优先推荐公共交通，计程车报销需附带行程明细 [2]。
2. **报销申请流程**：出差结束后 5 个工作日内，需在 OA 系统提交《差旅费报销单》，附带机票电子行程单、发票及行程审批件 [1][2]。

---
*参考出处：*
* [1] 《企业员工差旅管理制度 v2.0》
* [2] 《财务费用报销审批流程细则》`,
  },
];
