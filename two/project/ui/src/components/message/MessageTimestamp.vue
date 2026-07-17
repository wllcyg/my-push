<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timestamp: string
  class?: string
}>()

const formatted = computed(() => {
  const date = new Date(props.timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
})

const fullDate = computed(() => {
  return new Date(props.timestamp).toLocaleString()
})
</script>

<template>
  <time
    class="message-timestamp"
    :datetime="timestamp"
    :title="fullDate"
  >
    {{ formatted }}
  </time>
</template>

<style scoped lang="scss">
.message-timestamp {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  user-select: none;
  letter-spacing: 0.01em;
}
</style>
