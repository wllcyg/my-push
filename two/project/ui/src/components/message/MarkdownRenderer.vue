<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { renderMarkdown, attachCodeCopyHandlers } from '../../utils/markdown'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{
  content: string
  isStreaming?: boolean
  message: ChatMessage
}>()

const containerRef = ref<HTMLElement | null>(null)

const renderedHtml = computed(() => renderMarkdown(props.content))

// Re-attach copy handlers whenever HTML changes
watch(renderedHtml, async () => {
  await nextTick()
  if (containerRef.value) {
    attachCodeCopyHandlers(containerRef.value)
  }
})

onMounted(async () => {
  await nextTick()
  if (containerRef.value) {
    attachCodeCopyHandlers(containerRef.value)
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="prose markdown-renderer"
    :class="{ 'is-streaming': isStreaming }"
    v-html="renderedHtml"
  />
</template>

<style scoped lang="scss">
.markdown-renderer {
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;

  // Typing cursor at end of last text node during streaming
  &.is-streaming :deep(p:last-child),
  &.is-streaming :deep(li:last-child),
  &.is-streaming :deep(h1:last-child),
  &.is-streaming :deep(h2:last-child),
  &.is-streaming :deep(h3:last-child) {
    &::after {
      content: '▋';
      display: inline-block;
      animation: typingCursor 0.8s ease-in-out infinite;
      color: var(--color-primary);
      margin-left: 1px;
      font-size: 0.85em;
      vertical-align: baseline;
    }
  }
}

@keyframes typingCursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
