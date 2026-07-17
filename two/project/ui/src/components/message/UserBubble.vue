<script setup lang="ts">
import MessageTimestamp from './MessageTimestamp.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div class="user-bubble">
    <div class="user-bubble__content">
      <p class="user-bubble__text">{{ message.content }}</p>
    </div>
    <MessageTimestamp
      class="user-bubble__time"
      :timestamp="message.createdAt"
    />
  </div>
</template>

<style scoped lang="scss">
.user-bubble {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  max-width: 72%;
  margin-left: auto;
  animation: slideInRight var(--duration-slow) var(--ease-out) both;

  &__content {
    background: var(--color-bg-user-bubble);
    border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xs) var(--radius-xl);
    padding: 11px 16px;
    box-shadow: var(--shadow-bubble);
    position: relative;
  }

  &__text {
    color: var(--color-text-user-bubble);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }

  &__time {
    margin-right: 4px;
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
