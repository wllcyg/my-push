<template>
  <div class="reading-progress-bar" :style="{ width: progress + '%' }"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { inBrowser } from 'vitepress'

const progress = ref(0)

const updateProgress = () => {
  if (!inBrowser) return
  
  const scrollPosition = window.scrollY
  const documentHeight = document.documentElement.scrollHeight
  const windowHeight = window.innerHeight
  
  // 如果页面不需要滚动，进度保持为0
  if (documentHeight <= windowHeight) {
    progress.value = 0
    return
  }
  
  progress.value = (scrollPosition / (documentHeight - windowHeight)) * 100
}

onMounted(() => {
  if (inBrowser) {
    window.addEventListener('scroll', updateProgress)
    window.addEventListener('resize', updateProgress)
    updateProgress()
  }
})

onUnmounted(() => {
  if (inBrowser) {
    window.removeEventListener('scroll', updateProgress)
    window.removeEventListener('resize', updateProgress)
  }
})
</script>

<style scoped>
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background-color: var(--vp-c-brand-1); /* 使用了 VitePress 的主品牌色 */
  z-index: 99999;
  transition: width 0.1s ease-out;
}
</style>
