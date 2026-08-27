const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const docsDir = path.join(baseDir, 'docs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveFile(src, dest) {
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    fs.renameSync(src, dest);
    console.log(`Moved: ${path.relative(baseDir, src)} -> ${path.relative(baseDir, dest)}`);
  }
}

// 1. AI 目录迁移
const aiDir = path.join(docsDir, 'ai');
const aiPlan = {
  '01-foundations': [
    '01-agent-learning.md',
    '02-mcp-learning.md',
    '04-memory-management.md',
    '05-output-parsers.md',
    '07-prompt-engineering.md',
    '08-lcel-chains.md',
    '09-agent-mcp-learning.md',
    '28-ts-vs-python-typing.md'
  ],
  '02-agent-framework': [
    '06-mini-cursor-agent.md',
    '12-langgraph-multi-agent-python.md',
    '16-langgraph-deepagents-python-architecture.md',
    '17-langgraph-agent-infrastructure-skills-rbac-subagent.md',
    '18-deep-agents-overview.md',
    '19-deep-agents-core-api.md',
    '20-deep-agents-middlewares.md',
    '21-deep-agents-research-handbook.md',
    '23-agent-middleware.md'
  ],
  '03-rag-retrieval': [
    '03-rag-learning.md',
    '13-advanced-rag-multihop.md',
    '14-elasticsearch-hybrid-retrieval.md',
    '15-graphrag-agent.md',
    '15-rag-evaluation-langsmith.md',
    '24-rabbitmq-rag-pipeline.md',
    '25-rag-pipeline-architecture.md',
    '26-elasticsearch-dual-pipeline-ingestion.md',
    '27-knowledge-graph-extraction-and-ingestion.md',
    '29-document-review-flow.md',
    '30-RAG 评测.md'
  ],
  '04-infra-backend': [
    '10-cron-job-learning.md',
    '11-ai-stream-protocol.md',
    '22-redis-agent-short-memory.md',
    '31-redis_distributed_lock_guide.md',
    '32-user_auth_guide.md'
  ]
};

// 移动 00_system_architecture_and_business_logic.md
const oldGateway = path.join(aiDir, '00_system_architecture_and_business_logic.md');
const newGateway = path.join(aiDir, '04-infra-backend', 'Cloudflare边缘网关与鉴权架构.md');
moveFile(oldGateway, newGateway);

for (const [subDir, files] of Object.entries(aiPlan)) {
  const targetSubDir = path.join(aiDir, subDir);
  ensureDir(targetSubDir);
  for (const file of files) {
    const src = path.join(aiDir, file);
    const dest = path.join(targetSubDir, file);
    moveFile(src, dest);
  }
}

// 2. Flutter 目录迁移
const flutterDir = path.join(docsDir, 'flutter');
if (fs.existsSync(flutterDir)) {
  const allFlutterFiles = fs.readdirSync(flutterDir).filter(f => {
    return fs.statSync(path.join(flutterDir, f)).isFile();
  });

  for (const f of allFlutterFiles) {
    let sub = null;
    if (f.startsWith('learning-')) {
      sub = '00-roadmap';
    } else if (/^day-0[1-9]|^day-10/.test(f)) {
      sub = '01-basics-core';
    } else if (/^day-(1[1-9]|2[0-1])/.test(f)) {
      sub = '02-ui-components';
    } else if (/^day-(2[2-9]|30)/.test(f)) {
      sub = '03-platform-system';
    } else if (/^day-(3[1-9]|4[0-9])/.test(f)) {
      sub = '04-ecosystem-libs';
    }

    if (sub) {
      const src = path.join(flutterDir, f);
      const dest = path.join(flutterDir, sub, f);
      moveFile(src, dest);
    }
  }
}

// 3. 鸿蒙 Harmony 目录迁移
const harmonyDir = path.join(docsDir, 'harmony');
ensureDir(harmonyDir);
const harmonyFiles = {
  'harmony-app-matrix.md': 'app-matrix.md',
  'mvp.md': 'id-photo-mvp.md',
  'id-photo-workshop-plan.md': 'id-photo-workshop-plan.md',
  'harmony-calculator-suite.md': 'calculator-suite.md',
  'harmony-image-toolkit.md': 'image-toolkit.md',
  'harmony-reference-tools.md': 'reference-tools.md'
};

for (const [srcName, destName] of Object.entries(harmonyFiles)) {
  const src = path.join(baseDir, srcName);
  const dest = path.join(harmonyDir, destName);
  moveFile(src, dest);
}

// 4. 随笔目录更名 why -> essays
const whyDir = path.join(docsDir, 'why');
const essaysDir = path.join(docsDir, 'essays');
if (fs.existsSync(whyDir)) {
  ensureDir(essaysDir);
  const files = fs.readdirSync(whyDir);
  for (const f of files) {
    moveFile(path.join(whyDir, f), path.join(essaysDir, f));
  }
  try {
    fs.rmdirSync(whyDir);
    console.log('Removed empty why dir');
  } catch (e) {}
}

console.log('--- All documents reorganized successfully! ---');
