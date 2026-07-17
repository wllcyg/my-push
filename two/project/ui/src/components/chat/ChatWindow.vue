<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  computed,
} from 'vue'
import MessageBubble from '../message/MessageBubble.vue'
import ChatEmptyState from './ChatEmptyState.vue'
import ScrollToBottom from './ScrollToBottom.vue'
import { createScrollController } from '../../utils/scroll'
import type { ChatMessage } from '../../types/chat'

const props = defineProps<{
  messages: ChatMessage[]
  isLoading: boolean
}>()

defineEmits<{
  newChat: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const showScrollButton = ref(false)
const scrollCtrl = createScrollController()

const isEmpty = computed(() => props.messages.length === 0)

// Watch for new message content to trigger auto-scroll
watch(
  () => props.messages.map(m => m.content + m.toolInvocations.length),
  () => {
    scrollCtrl.onContentUpdate()
    showScrollButton.value = scrollCtrl.isUserScrolled
  },
)

// Scroll to bottom when messages are added
watch(
  () => props.messages.length,
  () => {
    scrollCtrl.scrollToBottom()
    showScrollButton.value = false
  },
)

function onScrollButtonClick(): void {
  scrollCtrl.scrollToBottom()
  showScrollButton.value = false
}

// Update scroll button visibility on user scroll
function onContainerScroll(): void {
  showScrollButton.value = scrollCtrl.isUserScrolled
}

onMounted(() => {
  if (containerRef.value) {
    scrollCtrl.attach(containerRef.value)
    containerRef.value.addEventListener('scroll', onContainerScroll, { passive: true })
  }
})

onUnmounted(() => {
  scrollCtrl.detach()
  containerRef.value?.removeEventListener('scroll', onContainerScroll)
})
</script>

<template>
  <div class="chat-window">
    <!-- Message list -->
    <div ref="containerRef" class="chat-window__scroll">
      <div class="chat-window__inner">
        <!-- Empty state -->
        <ChatEmptyState v-if="isEmpty" @new-chat="$emit('newChat')" />

        <!-- Messages -->
        <TransitionGroup v-else tag="div" name="message" class="chat-window__messages">
          <MessageBubble
            v-for="message in messages"
            :key="message.id"
            :message="message"
          />
        </TransitionGroup>

        <!-- Bottom anchor for padding -->
        <div class="chat-window__bottom-pad" />
      </div>
    </div>

    <!-- Scroll to bottom FAB -->
    <Transition name="fade">
      <div v-if="showScrollButton" class="chat-window__scroll-fab">
        <ScrollToBottom @click="onScrollButtonClick" />
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.chat-window {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__scroll {
    flex: 1;
    overflow-y: auto;
    scroll-behavior: smooth;
  }

  &__inner {
    width: 100%;
    max-width: var(--chat-max-width);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  &__messages {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    flex: 1;
  }

  &__bottom-pad {
    height: var(--space-8);
    flex-shrink: 0;
  }

  &__scroll-fab {
    position: absolute;
    bottom: var(--space-5);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-above);
  }
}

// TransitionGroup classes
.message-enter-active {
  animation: msgIn var(--duration-slow) var(--ease-out) both;
}

.message-leave-active {
  animation: msgIn var(--duration-fast) var(--ease-out) reverse both;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-in-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
