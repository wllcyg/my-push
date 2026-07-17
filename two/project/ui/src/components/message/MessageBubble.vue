<script setup lang="ts">
import UserBubble from './UserBubble.vue'
import AssistantBubble from './AssistantBubble.vue'
import type { ChatMessage } from '../../types/chat'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div
    class="message-bubble"
    :class="`message-bubble--${message.role}`"
    :data-message-id="message.id"
  >
    <UserBubble v-if="message.role === 'user'" :message="message" />
    <AssistantBubble v-else :message="message" />
  </div>
</template>

<style scoped lang="scss">
.message-bubble {
  width: 100%;
}
</style>
