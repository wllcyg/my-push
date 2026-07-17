<script setup lang="ts">
defineEmits<{
  newChat: []
}>()
</script>

<template>
  <div class="chat-empty-state">
    <div class="chat-empty-state__icon" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h8" />
        <path d="M8 14h4" />
      </svg>
    </div>
    <h2 class="chat-empty-state__title">How can I help you today?</h2>
    <p class="chat-empty-state__subtitle">
      Ask anything — I can write code, answer questions, and use tools to get things done.
    </p>
    <div class="chat-empty-state__suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.text"
        class="chat-empty-state__chip"
        @click="$emit('newChat')"
      >
        <span class="chat-empty-state__chip-icon" aria-hidden="true">{{ suggestion.icon }}</span>
        {{ suggestion.text }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
const suggestions = [
  { icon: '💡', text: 'Explain a complex concept' },
  { icon: '🔧', text: 'Help debug my code' },
  { icon: '✍️', text: 'Write something creative' },
  { icon: '🔍', text: 'Research a topic' },
]
</script>

<style scoped lang="scss">
.chat-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-16) var(--space-8);
  gap: var(--space-5);
  height: 100%;
  animation: fadeInUp var(--duration-slow) var(--ease-out) both;

  &__icon {
    width: 68px;
    height: 68px;
    border-radius: var(--radius-2xl);
    background: linear-gradient(
      135deg,
      var(--color-primary-light),
      rgba(59, 130, 246, 0.08)
    );
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  &__title {
    font-size: var(--text-2xl);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
    line-height: var(--leading-tight);
  }

  &__subtitle {
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    line-height: var(--leading-relaxed);
    max-width: 400px;
  }

  &__suggestions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-top: var(--space-2);
    width: 100%;
    max-width: 480px;
  }

  &__chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    cursor: pointer;
    text-align: left;
    transition: all var(--duration-base) var(--ease-out);

    &:hover {
      background: var(--color-bg-muted);
      border-color: var(--color-primary);
      color: var(--color-text-primary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    &:active {
      transform: translateY(0);
    }
  }

  &__chip-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
