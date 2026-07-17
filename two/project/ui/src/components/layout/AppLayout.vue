<script setup lang="ts">
import { useChatStore } from '../../stores/chatStore'

defineEmits<{
  newChat: []
  toggleSidebar: []
  selectConversation: [id: string]
}>()

const chatStore = useChatStore()
</script>

<template>
  <div
    class="app-layout"
    :class="{ 'app-layout--sidebar-open': chatStore.isSidebarOpen }"
  >
    <!-- Sidebar -->
    <Transition name="sidebar">
      <slot v-if="chatStore.isSidebarOpen" name="sidebar" />
    </Transition>

    <!-- Main content -->
    <div class="app-layout__main">
      <slot name="header" />
      <slot name="content" />
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-layout {
  display: flex;
  height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: var(--color-bg-base);

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
}

// Sidebar transition
.sidebar-enter-active,
.sidebar-leave-active {
  transition: all var(--duration-slow) var(--ease-out);
  overflow: hidden;
  width: var(--sidebar-width);
}

.sidebar-enter-from,
.sidebar-leave-to {
  width: 0;
  opacity: 0;
}
</style>
