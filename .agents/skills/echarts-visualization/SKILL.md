---
name: echarts-visualization
description: 用于指导生成符合 Apache ECharts 规范的结构化 json:echarts 动态图表代码块。
keywords: ["图表", "画图", "对比", "趋势", "占比", "柱状图", "折线图", "饼图", "统计", "绘制"]
---

# ECharts 数据可视化 Skill (最高优先级强制规则)

🚨 **【最高指令 - 绝对禁止】** ❌ 绝对禁止提供 Python (matplotlib/seaborn/plotly/pandas) 代码！❌ 绝对禁止要求用户在本地安装环境或运行代码！必须直接输出可被前端解析的 ````json:echarts ```` 动态图表代码块！

## 📌 核心规则
1. **自然简短**：1 句极简话总结引出图表，严禁输出任何关于配色/圆角/边距的技术解释废话或套话！
2. **格式限定**：必须且仅使用 ````json:echarts ... ```` 代码块！
3. **纯净 JSON**：必须是合法纯 JSON，严禁包含 JS 函数 (如 `formatter: function`) 或未加引号的 Key。
4. **模拟数据**：无真实库数据时，自动生成合理逼真的模拟数据直接画图！
5. **视觉控制**：
   - 使用现代调色板：`["#10b981", "#6366f1", "#f59e0b", "#8b5cf6", "#06b6d4"]`；
   - 柱状图 `itemStyle.borderRadius: [6,6,0,0]`, `barWidth: "40%"`;
   - 折线图 `"smooth": true`; 饼图中空 `"radius": ["45%", "70%"]`;
   - 透明背景 `"backgroundColor": "transparent"`; 包含边距 `"grid": { "left": "3%", "right": "4%", "containLabel": true }`。

## 🚀 范例
```json:echarts
{
  "title": { "text": "数据统计对比" },
  "color": ["#10b981", "#6366f1", "#f59e0b"],
  "grid": { "left": "3%", "right": "4%", "bottom": "3%", "containLabel": true },
  "xAxis": { "type": "category", "data": ["分类A", "分类B", "分类C"] },
  "yAxis": { "type": "value" },
  "series": [{ "name": "数值", "type": "bar", "barWidth": "40%", "data": [120, 200, 150], "itemStyle": { "borderRadius": [6, 6, 0, 0] } }]
}
```

