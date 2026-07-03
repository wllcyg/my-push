import DefaultTheme from 'vitepress/theme'
import { inBrowser } from 'vitepress'
import { nextTick, onMounted } from 'vue'

// 单例标记，防止路由切换时重复初始化
let live2dLoaded = false

function initLive2d() {
  if (live2dLoaded) return
  live2dLoaded = true

  import('oh-my-live2d')
    .then((module) => {
      const { loadOml2d } = module
      loadOml2d({
        mobileDisplay: false,
        // 加载失败时静默降级，不抛错误到控制台
        onError: () => {},
        models: [
          {
            path: 'https://assets.cheatppf.xyz/live2d/cat-black/model.json',
            scale: 0.15,
            position: [0, 20],
            stageStyle: { width: 250 }
          },
          {
            path: 'https://assets.cheatppf.xyz/live2d/shizuku_pajama/index.json',
            scale: 0.15,
            position: [0, 20],
            stageStyle: { width: 250 }
          },
          {
            path: 'https://assets.cheatppf.xyz/live2d/Senko_Normals/senko.model3.json',
            scale: 0.1,
            position: [0, 30],
            stageStyle: { width: 250 }
          },
          {
            path: 'https://assets.cheatppf.xyz/live2d/umaru/model.json',
            scale: 0.15,
            position: [0, 20],
            stageStyle: { width: 250 }
          }
        ]
      })
    })
    .catch((err) => {
      // oh-my-live2d 加载失败时重置标记，下次刷新可重试
      live2dLoaded = false
      console.warn('[Live2D] 初始化失败，已跳过：', err?.message || err)
    })
}

export default {
  extends: DefaultTheme,
  setup() {
    if (!inBrowser) return

    onMounted(() => {
      // nextTick 确保 DOM 完全稳定后再挂载 Live2D
      nextTick(() => {
        initLive2d()
      })
    })
  }
}
