<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { marked } from 'marked'
import AgentStepCard, { type AgentStep } from './AgentStepCard.vue'

interface ReportFile {
  name: string
  relative_path: string
  size: number
  updated_at: number
}

// ── State ───────────────────────────────────────────────────
const queryInput = ref('')
const isRunning = ref(false)
const statusMessage = ref('等待提交调研目标...')
const steps = ref<AgentStep[]>([])
const streamLogs = ref('')
const reportMarkdown = ref('')
const reportList = ref<ReportFile[]>([])
const selectedReportName = ref<string>('')
const activeTab = ref<'flow' | 'log'>('flow')

const logContainerRef = ref<HTMLElement | null>(null)
const reportContainerRef = ref<HTMLElement | null>(null)

const apiBase = import.meta.env.VITE_API_BASE || ''

// 渲染 Markdown 为 HTML
const renderedReportHtml = computed(() => {
  if (!reportMarkdown.value) return ''
  try {
    return marked.parse(reportMarkdown.value)
  } catch (e) {
    return reportMarkdown.value
  }
})

// 自动滚动到底部
watch([streamLogs, steps], () => {
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
})

function formatTime(): string {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

// ── 加载报告列表与读取特定报告 ──────────────────────────────
async function fetchReports(selectLatest = false) {
  try {
    const res = await fetch(`${apiBase}/api/agent/reports`)
    if (res.ok) {
      const data = await res.json()
      reportList.value = data.reports || []
      if (selectLatest && reportList.value.length > 0) {
        selectedReportName.value = reportList.value[0].name
        await loadSelectedReport(reportList.value[0].name)
      }
    }
  } catch (err) {
    console.error('获取报告列表失败:', err)
  }
}

async function loadSelectedReport(filename: string) {
  if (!filename) return
  try {
    const res = await fetch(`${apiBase}/api/agent/reports/${encodeURIComponent(filename)}`)
    if (res.ok) {
      const data = await res.json()
      reportMarkdown.value = data.content || ''
      selectedReportName.value = filename
    }
  } catch (err) {
    console.error('加载报告详情失败:', err)
  }
}

onMounted(() => {
  fetchReports(true)
})

// ── Start Deep Research Stream ───────────────────────────────
async function startResearch() {
  const query = queryInput.value.trim()
  if (!query || isRunning.value) return

  isRunning.value = true
  statusMessage.value = '正在启动 Deep Research Agent 调度中心...'
  steps.value = []
  streamLogs.value = ''
  reportMarkdown.value = ''

  try {
    const response = await fetch(`${apiBase}/api/agent/stream_research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, recursion_limit: 100 })
    })

    if (!response.body) {
      throw new Error('服务器未返回数据流')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        
        try {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue
          const event = JSON.parse(jsonStr)
          handleAgentEvent(event)
        } catch (err) {
          console.warn('[Parse Event Warning]', err, line)
        }
      }
    }
  } catch (err: any) {
    statusMessage.value = `执行过程发生错误: ${err.message || err}`
  } finally {
    isRunning.value = false
    // 完成后自动更新列表并拉取最新报告
    await fetchReports(true)
  }
}

// 处理后端发来的事件
function handleAgentEvent(event: { event_type: string; data: any }) {
  const type = event.event_type
  const data = event.data

  switch (type) {
    case 'status_change':
      statusMessage.value = data.message
      if (data.status === 'completed') {
        fetchReports(true)
      }
      break

    case 'subagent_delegate':
      steps.value.push({
        id: `subagent-${Date.now()}-${Math.random()}`,
        type: 'subagent',
        role: data.subagent_type,
        title: `委派 ${data.subagent_type}：${data.subtask}`,
        input: { subagent: data.subagent_type, task: data.subtask, target_file: data.target_file },
        status: data.status === 'active' ? 'running' : 'completed',
        timestamp: formatTime()
      })
      break

    case 'tool_call':
      if (data.status === 'start') {
        steps.value.push({
          id: `tool-${Date.now()}-${Math.random()}`,
          type: 'tool',
          title: `调用工具：${data.tool_name}`,
          input: data.input,
          status: 'running',
          timestamp: formatTime()
        })
      } else if (data.status === 'end') {
        const lastToolStep = [...steps.value].reverse().find(s => s.type === 'tool' && s.status === 'running')
        if (lastToolStep) {
          lastToolStep.status = 'completed'
          lastToolStep.output = data.output_summary
        }
      }
      break

    case 'text_stream':
      streamLogs.value += data.delta
      break

    case 'report_update':
      reportMarkdown.value = data.content
      selectedReportName.value = data.file_name
      statusMessage.value = `深度报告已刷新 (${data.file_name})`
      break
  }
}

// 复制报告全文
function copyReport() {
  if (!reportMarkdown.value) return
  navigator.clipboard.writeText(reportMarkdown.value)
  alert('报告已成功复制到剪贴板！')
}

// 下载 Markdown 文件
function downloadReport() {
  if (!reportMarkdown.value) return
  const blob = new Blob([reportMarkdown.value], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = selectedReportName.value || `Deep_Research_Report_${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="deep-research-viewer">
    <!-- Top Header -->
    <header class="viewer-header">
      <div class="header-info">
        <h2>🔬 深度调研 Agent 调度面板</h2>
        <span class="status-tag" :class="{ active: isRunning }">
          {{ isRunning ? '⚡ 正在深入调研与分析中...' : '🟢 就绪' }}
        </span>
      </div>

      <div class="search-box">
        <input
          v-model="queryInput"
          type="text"
          placeholder="请输入您想深度调研的课题 (例如：调研 LangGraph 多 Agent 架构...)"
          :disabled="isRunning"
          @keyup.enter="startResearch"
        />
        <button class="start-btn" :disabled="isRunning || !queryInput.trim()" @click="startResearch">
          {{ isRunning ? '调研中...' : '发起深度调研' }}
        </button>
      </div>
    </header>

    <!-- Main Workspace (Dual Pane Layout) -->
    <div class="viewer-body">
      <!-- Left Pane: Agent Execution & Steps -->
      <div class="pane left-pane">
        <div class="pane-header">
          <div class="tabs">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'flow' }"
              @click="activeTab = 'flow'"
            >
              📋 执行步骤 & 委派图 ({{ steps.length }})
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'log' }"
              @click="activeTab = 'log'"
            >
              💻 实时 LLM 日志
            </button>
          </div>
          <span class="status-msg">{{ statusMessage }}</span>
        </div>

        <div class="pane-content" ref="logContainerRef">
          <!-- Tab 1: Steps & Tool Cards -->
          <div v-if="activeTab === 'flow'" class="steps-list">
            <div v-if="steps.length === 0" class="empty-state">
              暂无执行步骤，请输入课题并点击「发起深度调研」。
            </div>
            <AgentStepCard
              v-for="step in steps"
              :key="step.id"
              :step="step"
            />
          </div>

          <!-- Tab 2: Raw Streaming Logs -->
          <div v-else class="logs-wrapper">
            <pre class="raw-log">{{ streamLogs || '暂无实时日志流...' }}</pre>
          </div>
        </div>
      </div>

      <!-- Right Pane: Markdown Report Output -->
      <div class="pane right-pane">
        <div class="pane-header">
          <div class="report-selector">
            <h3>📄 深度调研报告 preview</h3>
            <select
              v-if="reportList.length > 0"
              class="report-select"
              v-model="selectedReportName"
              @change="loadSelectedReport(selectedReportName)"
            >
              <option v-for="r in reportList" :key="r.name" :value="r.name">
                📑 {{ r.name }} ({{ (r.size / 1024).toFixed(1) }} KB)
              </option>
            </select>
          </div>

          <div v-if="reportMarkdown" class="actions">
            <button class="action-btn" @click="copyReport">📋 复制 MD</button>
            <button class="action-btn primary" @click="downloadReport">⬇️ 下载 MD</button>
          </div>
        </div>

        <div class="pane-content report-content" ref="reportContainerRef">
          <div v-if="renderedReportHtml" class="markdown-body" v-html="renderedReportHtml"></div>
          <div v-else class="report-empty">
            <div class="empty-icon">📝</div>
            <p>调研完成后，最终的 Markdown 报告将在此处实时生成与渲染展示。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.deep-research-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-base, #f8fafc);
  color: var(--color-text-primary, #0f172a);
}

.viewer-header {
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid var(--color-border-subtle, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    .status-tag {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      background: #f1f5f9;
      color: #64748b;

      &.active {
        background: #e0f2fe;
        color: #0369a1;
        font-weight: 600;
      }
    }
  }

  .search-box {
    display: flex;
    gap: 8px;
    flex: 1;
    max-width: 600px;

    input {
      flex: 1;
      padding: 8px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
    }

    .start-btn {
      padding: 8px 18px;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      &:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }
    }
  }
}

.viewer-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 16px;
  gap: 16px;
}

.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;

  .pane-header {
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .pane-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
}

.left-pane {
  .tabs {
    display: flex;
    gap: 6px;

    .tab-btn {
      padding: 6px 12px;
      border: none;
      background: none;
      border-radius: 6px;
      font-size: 13px;
      color: #64748b;
      cursor: pointer;
      &.active {
        background: #ffffff;
        color: #2563eb;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }
    }
  }

  .status-msg {
    font-size: 12px;
    color: #64748b;
    max-width: 240px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 40px 0;
    font-size: 14px;
  }

  .raw-log {
    font-family: monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
    color: #334155;
  }
}

.right-pane {
  .report-selector {
    display: flex;
    align-items: center;
    gap: 10px;

    .report-select {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
      color: #334155;
      background: #ffffff;
      outline: none;
    }
  }

  .actions {
    display: flex;
    gap: 8px;

    .action-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      border-radius: 6px;
      cursor: pointer;
      &.primary {
        background: #059669;
        color: #ffffff;
        border-color: #059669;
      }
    }
  }

  .report-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    text-align: center;

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
  }

  .markdown-body {
    font-size: 14px;
    line-height: 1.7;
    color: #1e293b;
    :deep(h1) { font-size: 22px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    :deep(h2) { font-size: 18px; margin-top: 20px; }
    :deep(pre) { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 8px; }
  }
}
</style>
