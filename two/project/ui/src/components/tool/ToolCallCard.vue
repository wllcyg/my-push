<script setup lang="ts">
import { ref, computed } from 'vue'
import ToolRunning from './ToolRunning.vue'
import ToolResult from './ToolResult.vue'
import type { ToolInvocation, ToolResult as IToolResult } from '../../types/chat'

const props = defineProps<{
  invocation: ToolInvocation
  result: IToolResult | undefined
}>()

const isExpanded = ref(false)
const isDone = computed(() => !!props.result)

function formatArgs(args: Record<string, unknown>): string {
  return JSON.stringify(args, null, 2)
}
</script>

<template>
  <div
    class="tool-card"
    :class="{ 'tool-card--done': isDone, 'tool-card--running': !isDone }"
  >
    <!-- Card Header -->
    <button
      class="tool-card__header"
      :aria-expanded="isExpanded"
      :aria-label="`${isDone ? 'Tool completed' : 'Tool running'}: ${invocation.toolName}`"
      @click="isExpanded = !isExpanded"
    >
      <div class="tool-card__status">
        <span v-if="!isDone" class="tool-card__dot tool-card__dot--running" />
        <span v-else class="tool-card__dot tool-card__dot--done">✓</span>
      </div>
      <div class="tool-card__info">
        <span class="tool-card__name">{{ invocation.toolName }}</span>
        <span class="tool-card__state">{{ isDone ? 'completed' : 'running…' }}</span>
      </div>
      <svg
        class="tool-card__chevron"
        :class="{ 'tool-card__chevron--open': isExpanded }"
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- Expandable Body -->
    <Transition name="expand">
      <div v-if="isExpanded" class="tool-card__body">
        <!-- Running animation -->
        <ToolRunning v-if="!isDone" :tool-name="invocation.toolName" />

        <!-- Arguments -->
        <div class="tool-card__section">
          <span class="tool-card__section-label">Arguments</span>
          <pre class="tool-card__json"><code>{{ formatArgs(invocation.args) }}</code></pre>
        </div>

        <!-- Result -->
        <ToolResult v-if="result" :result="result" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.tool-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-tool-card);
  margin-top: 8px;
  transition: border-color var(--duration-base);

  &--running {
    border-color: rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.03);
  }

  &--done {
    border-color: rgba(16, 185, 129, 0.25);
  }

  &__header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast);

    &:hover {
      background: var(--color-bg-muted);
    }
  }

  &__status {
    flex-shrink: 0;
  }

  &__dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: var(--weight-bold);

    &--running {
      background: rgba(139, 92, 246, 0.12);
      position: relative;

      &::after {
        content: '';
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: var(--color-tool-running);
        animation: spin 0.8s linear infinite;
      }
    }

    &--done {
      background: var(--color-success-bg);
      color: var(--color-success);
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  &__name {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text-primary);
    truncate: true;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform var(--duration-base) var(--ease-out);

    &--open {
      transform: rotate(180deg);
    }
  }

  &__body {
    padding: 0 12px 12px;
    overflow: hidden;
  }

  &__section {
    margin-top: 8px;
  }

  &__section-label {
    display: block;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-weight: var(--weight-medium);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  &__json {
    background: var(--color-bg-code);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    overflow-x: auto;
    border: 1px solid var(--color-border-subtle);
    margin: 0;

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
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 600px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
