<script setup lang="ts">
defineProps<{
  toolName: string
}>()
</script>

<template>
  <div class="tool-running">
    <div class="tool-running__spinner" aria-hidden="true" />
    <span class="tool-running__label">
      Calling <code class="tool-running__name">{{ toolName }}</code>
    </span>
  </div>
</template>

<style scoped lang="scss">
.tool-running {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-tool-running);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  &__label {
    font-size: var(--text-xs);
    color: var(--color-tool-running);
    font-family: var(--font-mono);
  }

  &__name {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    background: rgba(139, 92, 246, 0.1);
    color: var(--color-tool-running);
    padding: 1px 5px;
    border-radius: var(--radius-xs);
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
