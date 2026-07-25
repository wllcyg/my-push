<script setup lang="ts">
import MessageTimestamp from './MessageTimestamp.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div class="user-bubble">
    <div class="user-bubble__main">
      <div class="user-bubble__content">
        <p class="user-bubble__text">{{ message.content }}</p>
      </div>
      <MessageTimestamp
        class="user-bubble__time"
        :timestamp="message.createdAt"
      />
    </div>
    <div class="user-bubble__avatar">
      <img src="/avatars/user-avatar.png" alt="User Avatar" class="avatar-img" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-bubble {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 10px;
  max-width: 80%;
  margin-left: auto;
  animation: slideInRight var(--duration-slow) var(--ease-out) both;

  &__main {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 0;
  }

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
      transform: scale(1.18);
      display: block;
    }
  }

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
