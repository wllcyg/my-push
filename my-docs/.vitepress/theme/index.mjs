import DefaultTheme from 'vitepress/theme'
import { inBrowser } from 'vitepress'
import { onMounted } from 'vue'

export default {
  extends: DefaultTheme,
  setup() {
    if (inBrowser) {
      onMounted(() => {
        import('oh-my-live2d').then((module) => {
          const { loadOml2d } = module;
          loadOml2d({
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
          });
        });
      });
    }
  }
}
