import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence legacy division warnings from dependencies
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  server: {
    proxy: {
      '/api/chat': {
        target: 'http://localhost:8521/ai/chat',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat/, ''),
      },
    },
  },
})
