<script setup lang="ts">
import { ref } from 'vue'
import type { ToolResult } from '../../types/chat'

defineProps<{
  result: ToolResult
}>()

const isExpanded = ref(false)

function formatResult(result: unknown): string {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return result
    }
  }
  return JSON.stringify(result, null, 2)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div class="tool-result">
    <div class="tool-result__summary">
      <span class="tool-result__icon">✓</span>
      <span class="tool-result__label">Completed in {{ formatDuration(result.durationMs) }}</span>
      <button
        class="tool-result__toggle"
        :aria-expanded="isExpanded"
        aria-label="Toggle result details"
        @click="isExpanded = !isExpanded"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        {{ isExpanded ? 'Hide' : 'Show' }} result
      </button>
    </div>

    <Transition name="expand">
      <div v-if="isExpanded" class="tool-result__body">
        <pre class="tool-result__json"><code>{{ formatResult(result.result) }}</code></pre>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.tool-result {
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 8px;
  padding-top: 8px;

  &__summary {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-success-bg);
    color: var(--color-success);
    font-size: 10px;
    font-weight: var(--weight-bold);
    flex-shrink: 0;
  }

  &__label {
    font-size: var(--text-xs);
    color: var(--color-success);
    font-weight: var(--weight-medium);
    font-family: var(--font-mono);
  }

  &__toggle {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    transition: color var(--duration-fast), background var(--duration-fast);
    white-space: nowrap;

    &:hover {
      color: var(--color-text-secondary);
      background: var(--color-bg-muted);
    }
  }

  &__body {
    margin-top: 8px;
    overflow: hidden;
  }

  &__json {
    background: var(--color-bg-code);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    overflow-x: auto;
    border: 1px solid var(--color-border-subtle);

    code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.6;
      color: var(--color-text-code);
      white-space: pre;
    }
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-slow) var(--ease-out);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
