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
      <img src="/avatars/ai-avatar.png" alt="AI Avatar" class="avatar-img" />
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
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    margin-top: 2px;
    border: 1.5px solid var(--color-border-subtle, rgba(255, 255, 255, 0.15));

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.05);
      display: block;
    }
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
