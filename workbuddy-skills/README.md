# WorkBuddy 备课技能包套装

> 适配 WorkBuddy / OpenClaw 生态，专为教师备课场景设计。

---

## 📦 技能包列表

| 技能包 | 功能描述 | 触发关键词示例 |
|---|---|---|
| 🔍 `lesson-material-collector` | 多平台并行搜集备课素材，整理成带链接汇总表 | "搜集备课资料"、"找教学设计" |
| 📝 `lesson-plan-generator` | 分析素材亮点，生成完整教学设计 Word | "生成教案"、"分析备课素材" |
| 📁 `lesson-folder-builder` | 自动创建标准化备课目录结构 | "建备课文件夹"、"创建备课目录" |
| 📊 `ppt-notes-generator` | 生成带演讲备注的说课 PPT（.pptx 可编辑） | "生成说课PPT"、"做PPT" |
| 📈 `student-data-analyzer` | 成绩数据分析，生成学情报告（隐私保护） | "学情分析"、"成绩统计" |
| 🎵 `audio-script-maker` | 生成朗读/听写音频脚本（TTS 友好格式） | "生成听写音频"、"朗读音频" |

---

## 🚀 安装方式

### 方式一：上传 ZIP（推荐）

1. 下载对应技能包的 `.zip` 文件
2. 在 WorkBuddy 中点击：**专家 → 技能 → 上传技能**
3. 选择 ZIP 文件（⚠️ **不要解压**）
4. 验证：在对话框输入 `"你现在有哪些技能？"` 确认安装成功

### 方式二：本地文件夹导入

将技能包文件夹放入 WorkBuddy 技能目录后重启应用。

---

## 📋 推荐使用顺序（完整备课流程）

```
第一步：lesson-folder-builder  → 建立备课目录结构
第二步：lesson-material-collector → 搜集多平台素材
第三步：lesson-plan-generator  → 分析亮点 + 生成教案
第四步：ppt-notes-generator    → 生成说课PPT
第五步：audio-script-maker     → 生成配套音频脚本
第六步：student-data-analyzer  → 考后学情分析（可选）
```

---

## ⚠️ 重要原则

1. **AI 执行，人类决策**：教学主线和亮点组合必须由老师拍板
2. **防幻觉机制**：所有内容来自素材，缺失标"[待补充]"，禁止编造
3. **数据安全**：学生数据使用代号，不传递真实姓名和敏感信息
4. **先规划后执行**：文件操作类技能必须先展示规划，确认后才执行

---

## 📁 目录结构

```
workbuddy-skills/
├── README.md                          ← 本文件
├── lesson-material-collector/
│   ├── SKILL.md
│   └── references/
│       └── search-keywords-template.md
├── lesson-plan-generator/
│   └── SKILL.md
├── lesson-folder-builder/
│   └── SKILL.md
├── ppt-notes-generator/
│   └── SKILL.md
├── student-data-analyzer/
│   └── SKILL.md
└── audio-script-maker/
    └── SKILL.md
```

---

*由 AI 辅助生成，基于 WorkBuddy SKILL.md 规范编写*
