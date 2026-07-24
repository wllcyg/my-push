<script setup lang="ts">
import { ref } from 'vue'

export interface AgentStep {
  id: string
  type: 'subagent' | 'tool' | 'node' | 'text'
  role?: string // orchestrator, researcher, analyst, editor
  title: string
  status?: 'running' | 'completed' | 'failed'
  input?: any
  output?: string
  timestamp: string
}

defineProps<{
  step: AgentStep
}>()

const isExpanded = ref(true)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function getRoleBadgeClass(role?: string) {
  switch (role) {
    case 'researcher':
      return 'badge-researcher'
    case 'analyst':
      return 'badge-analyst'
    case 'editor':
      return 'badge-editor'
    default:
      return 'badge-orchestrator'
  }
}

function getRoleName(role?: string) {
  switch (role) {
    case 'researcher':
      return '调研员 (Researcher)'
    case 'analyst':
      return '数据分析师 (Analyst)'
    case 'editor':
      return '审阅编辑 (Editor)'
    default:
      return '编排主 Agent (Orchestrator)'
  }
}
</script>

<template>
  <div class="agent-step-card" :class="[step.type, step.status]">
    <!-- Card Header -->
    <div class="step-header" @click="toggleExpand">
      <div class="header-left">
        <!-- Status indicator icon -->
        <span class="status-indicator">
          <span v-if="step.status === 'running'" class="spinner"></span>
          <span v-else-if="step.status === 'completed'" class="icon-check">✓</span>
          <span v-else class="icon-dot">•</span>
        </span>

        <!-- Badge -->
        <span v-if="step.role" class="role-badge" :class="getRoleBadgeClass(step.role)">
          {{ getRoleName(step.role) }}
        </span>

        <!-- Title -->
        <span class="step-title">{{ step.title }}</span>
      </div>

      <div class="header-right">
        <span class="timestamp">{{ step.timestamp }}</span>
        <button class="expand-btn" type="button">
          {{ isExpanded ? '▲' : '▼' }}
        </button>
      </div>
    </div>

    <!-- Card Content -->
    <div v-if="isExpanded" class="step-body">
      <!-- Input Arguments -->
      <div v-if="step.input" class="detail-block">
        <div class="block-label">输入参数 / Task</div>
        <pre class="json-code">{{ typeof step.input === 'object' ? JSON.stringify(step.input, null, 2) : step.input }}</pre>
      </div>

      <!-- Output Summary -->
      <div v-if="step.output" class="detail-block">
        <div class="block-label">执行结果 / 观察摘要</div>
        <div class="output-text">{{ step.output }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.agent-step-card {
  background: var(--color-bg-elevated, #ffffff);
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.2s ease;

  &.subagent {
    border-left: 4px solid #3b82f6;
  }
  &.tool {
    border-left: 4px solid #8b5cf6;
  }
  &.running {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.02);
    cursor: pointer;
    user-select: none;

    &:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 12px;

    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(59, 130, 246, 0.3);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .icon-check {
      color: #10b981;
      font-weight: bold;
    }
    .icon-dot {
      color: #9ca3af;
    }
  }

  .role-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;

    &.badge-orchestrator {
      background: #eff6ff;
      color: #1d4ed8;
    }
    &.badge-researcher {
      background: #f0fdf4;
      color: #15803d;
    }
    &.badge-analyst {
      background: #fefce8;
      color: #a16207;
    }
    &.badge-editor {
      background: #faf5ff;
      color: #7e22ce;
    }
  }

  .step-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary, #1f2937);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .timestamp {
      font-size: 11px;
      color: #9ca3af;
    }
    .expand-btn {
      background: none;
      border: none;
      font-size: 10px;
      color: #6b7280;
      cursor: pointer;
    }
  }

  .step-body {
    padding: 12px 14px;
    border-top: 1px solid var(--color-border-subtle, #f3f4f6);
    background: #fafafa;
  }

  .detail-block {
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }

    .block-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .json-code {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 8px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .output-text {
      font-size: 12px;
      line-height: 1.5;
      color: #374151;
      background: #ffffff;
      padding: 8px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      white-space: pre-wrap;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
