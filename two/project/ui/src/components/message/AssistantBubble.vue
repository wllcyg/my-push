<script setup lang="ts">
import { computed } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import MessageTimestamp from './MessageTimestamp.vue'
import ToolCallCard from '../tool/ToolCallCard.vue'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{
  message: ChatMessage
}>()

const hasContent = computed(() => props.message.content.length > 0)
const isThinking = computed(
  () => props.message.isStreaming && !hasContent.value && props.message.toolInvocations.length === 0,
)
</script>

<template>
  <div class="assistant-bubble">
    <!-- Avatar -->
    <div class="assistant-bubble__avatar" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
        <path d="M17 11v1a5 5 0 0 1-10 0v-1" />
        <circle cx="9" cy="18" r="1" />
        <circle cx="15" cy="18" r="1" />
        <path d="M12 19v3" />
      </svg>
    </div>

    <!-- Content area -->
    <div class="assistant-bubble__main">
      <!-- Thinking animation -->
      <div v-if="isThinking" class="assistant-bubble__thinking" aria-label="AI is thinking">
        <div class="thinking-dots">
          <span /><span /><span />
        </div>
      </div>

      <!-- Message card -->
      <div v-else class="assistant-bubble__card">
        <MarkdownRenderer
          v-if="hasContent"
          :content="message.content"
          :is-streaming="message.isStreaming"
          :message="message"
        />

        <!-- Tool invocations -->
        <div v-if="message.toolInvocations.length > 0" class="assistant-bubble__tools">
          <ToolCallCard
            v-for="invocation in message.toolInvocations"
            :key="invocation.toolCallId"
            :invocation="invocation"
            :result="message.toolResults.get(invocation.toolCallId)"
          />
        </div>
      </div>

      <MessageTimestamp
        class="assistant-bubble__time"
        :timestamp="message.createdAt"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.assistant-bubble {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
  animation: slideInLeft var(--duration-slow) var(--ease-out) both;

  &__avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary-gradient-from), var(--color-primary-gradient-to));
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: var(--shadow-sm);
    margin-top: 2px;
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__thinking {
    display: flex;
    align-items: center;
    background: var(--color-bg-assistant-bubble);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs);
    padding: 12px 16px;
    box-shadow: var(--shadow-bubble);
  }

  &__card {
    background: var(--color-bg-assistant-bubble);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs);
    padding: 14px 16px;
    box-shadow: var(--shadow-bubble);
    min-width: 0;
    overflow: hidden;
  }

  &__tools {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__time {
    margin-left: 4px;
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
