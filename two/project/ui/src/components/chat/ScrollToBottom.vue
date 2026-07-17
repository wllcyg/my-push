<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="scroll-to-bottom"
    aria-label="Scroll to bottom"
    @click="$emit('click')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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
</template>

<style scoped lang="scss">
.scroll-to-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  animation: scaleIn var(--duration-base) var(--ease-out) both;

  &:hover {
    background: var(--color-bg-muted);
    color: var(--color-text-primary);
    transform: translateY(1px);
    box-shadow: var(--shadow-sm);
  }

  &:active {
    transform: translateY(2px);
  }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
</style>
