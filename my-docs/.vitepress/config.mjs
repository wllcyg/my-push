import { defineConfig } from 'vitepress'

export default defineConfig({
  ignoreDeadLinks: true,
  title: "Notes",
  description: "A developer's notebook for Flutter projects, tooling, and the occasional deep dive.",
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }]
  ],
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Flutter', link: '/docs/flutter/learning-guide' },
      { text: 'AI & Agent', link: '/docs/ai/01-agent-learning' },
      { text: 'Tiptap Editor 在线体验', link: 'https://editor.cheatppf.xyz/' }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wllcyg' }
    ],
    sidebar: {
      '/docs/ai/': [
        {
        "text": "AI & Agent 学习实战",
        "items": [
          {
            "text": "Agent 核心原理解析",
            "link": "/docs/ai/01-agent-learning"
          },
          {
            "text": "MCP 协议实战篇",
            "link": "/docs/ai/02-mcp-learning"
          },
          {
            "text": "RAG 检索增强实现",
            "link": "/docs/ai/03-rag-learning"
          },
          {
            "text": "Agent 记忆管理与多轮对话实战总结",
            "link": "/docs/ai/04-memory-management"
          },
          {
            "text": "Agent 结构化输出与流式解析实战总结",
            "link": "/docs/ai/05-output-parsers"
          }
        ]
      }],
      '/docs/flutter/': [
      {
        "text": "学习路线与指南",
        "items": [
          {
            "text": "Flutter 2026 现代化实战",
            "link": "/docs/flutter/learning-guide"
          },
          {
            "text": "Flutter 2026 现代化实战",
            "link": "/docs/flutter/learning-plan"
          },
          {
            "text": "Flutter 进阶学习路线大纲 (Day 19 ~ Day 31)",
            "link": "/docs/flutter/learning-roadmap"
          }
        ]
      },
      {
        "text": "Flutter 每日打卡",
        "items": [
          {
            "text": "Day 1: 环境搭建与项目“大扫除”",
            "link": "/docs/flutter/day-01"
          },
          {
            "text": "Day 2: 布局思维转换与 Hooks 革命",
            "link": "/docs/flutter/day-02"
          },
          {
            "text": "Day 3: 弃暗投明？从 CloudBase 到 Supabase 的大迁移",
            "link": "/docs/flutter/day-03"
          },
          {
            "text": "Day 4: 搭积木",
            "link": "/docs/flutter/day-04"
          },
          {
            "text": "Day 5: 通知推送与深色模式",
            "link": "/docs/flutter/day-05"
          },
          {
            "text": "Day 6: Vue 视角下的路由重构 (GoRouter)",
            "link": "/docs/flutter/day-06"
          },
          {
            "text": "Day 7: 状态管理深度剖析 (Riverpod vs Pinia)",
            "link": "/docs/flutter/day-07"
          },
          {
            "text": "Day 8: CSS 肌肉记忆矫正",
            "link": "/docs/flutter/day-08"
          },
          {
            "text": "Day 8 (番外): 打破 CSS 直觉",
            "link": "/docs/flutter/day-08-extra"
          },
          {
            "text": "Day 9: 动画系统深度解析",
            "link": "/docs/flutter/day-09"
          },
          {
            "text": "Day 10.2: 实战",
            "link": "/docs/flutter/day-10-2-repository-usage"
          },
          {
            "text": "Day 10 (番外): 网络层封装",
            "link": "/docs/flutter/day-10-extra-network-layer"
          },
          {
            "text": "Day 10: 架构升级",
            "link": "/docs/flutter/day-10-repository-pattern"
          },
          {
            "text": "Day 11: 组件封装之基础篇",
            "link": "/docs/flutter/day-11-1-component-basics"
          },
          {
            "text": "Day 11: 组件进阶",
            "link": "/docs/flutter/day-11-2-component-advanced"
          },
          {
            "text": "Day 11: 组件封装核心",
            "link": "/docs/flutter/day-11-3-component-builder"
          },
          {
            "text": "Day 12: 数据持久化与离线缓存 (从 localStorage 到 Isar)",
            "link": "/docs/flutter/day-16"
          },
          {
            "text": "Day 12: 数据持久化与离线缓存",
            "link": "/docs/flutter/day-16-wechat"
          },
          {
            "text": "Day 13: 存储抽象层与 Offline First 架构",
            "link": "/docs/flutter/day-17"
          },
          {
            "text": "Day 13: 存储抽象层与 Offline First 架构",
            "link": "/docs/flutter/day-17-wechat"
          },
          {
            "text": "Day 18: 表单机制与校验",
            "link": "/docs/flutter/day-18-form-validation"
          },
          {
            "text": "Day 19 (上): 列表性能优化",
            "link": "/docs/flutter/day-19-list-optimization"
          },
          {
            "text": "Day 19 (下): Sliver 组合布局",
            "link": "/docs/flutter/day-19-list-optimization-part2"
          },
          {
            "text": "Day 20: 国际化 (i18n) 与多语言",
            "link": "/docs/flutter/day-20-i18n"
          },
          {
            "text": "Day 21: 图片处理",
            "link": "/docs/flutter/day-21-image-processing"
          },
          {
            "text": "Day 22: 地图与定位",
            "link": "/docs/flutter/day-22-flutter-map"
          },
          {
            "text": "Day 23: 生物识别",
            "link": "/docs/flutter/day-23-biometric"
          },
          {
            "text": "Day 24: 平台通道 (Platform Channel)",
            "link": "/docs/flutter/day-24-platform-channel"
          },
          {
            "text": "Day 25: App 生命周期与后台任务 ️",
            "link": "/docs/flutter/day-25-lifecycle"
          },
          {
            "text": "Day 26: CI/CD、多环境配置与应用发布",
            "link": "/docs/flutter/day-26-cicd"
          },
          {
            "text": "Day 27: WebSocket 与实时通信",
            "link": "/docs/flutter/day-27-websocket"
          },
          {
            "text": "Day 28: 性能调优 (DevTools) ️",
            "link": "/docs/flutter/day-28-performance"
          },
          {
            "text": "Day 29: WebView 深度实战",
            "link": "/docs/flutter/day-29-webview"
          },
          {
            "text": "Day 30: 高级 UI",
            "link": "/docs/flutter/day-30-custom-painter"
          },
          {
            "text": "Day 31: Freezed 代码生成",
            "link": "/docs/flutter/day-31-freezed"
          },
          {
            "text": "Day 32: Retrofit 声明式 API 请求",
            "link": "/docs/flutter/day-32-retrofit"
          },
          {
            "text": "Day 33: 推送通知",
            "link": "/docs/flutter/day-33-push-notifications"
          },
          {
            "text": "Flutter 图表可视化实战：用 fl_chart 让数据\"活\"起来！",
            "link": "/docs/flutter/day-34-chart-visualization"
          },
          {
            "text": "使用 url_launcher 唤起手机默认地图 App",
            "link": "/docs/flutter/day-35-deep-link-maps"
          },
          {
            "text": "Lottie 动画与骨架屏加载过渡",
            "link": "/docs/flutter/day-36-lottie-shimmer"
          },
          {
            "text": "Day 37: 常用工具包 (一)",
            "link": "/docs/flutter/day-37-tools"
          },
          {
            "text": "Day 38: 常用工具包 (二)",
            "link": "/docs/flutter/day-38-tools"
          },
          {
            "text": "Day 39: 列表侧滑操作",
            "link": "/docs/flutter/day-39-flutter-slidable"
          },
          {
            "text": "Day 40 (上): 为什么 GridView 做不了小红书？",
            "link": "/docs/flutter/day-40-part1-staggered-grid"
          },
          {
            "text": "Day 40 (下): 手撸小红书图片墙",
            "link": "/docs/flutter/day-40-part2-staggered-grid"
          },
          {
            "text": "Day 41: Toast 轻量级提示 (Part 1)",
            "link": "/docs/flutter/day-41-part1-toast"
          },
          {
            "text": "Day 41: Badge 角标提示 (Part 2)",
            "link": "/docs/flutter/day-41-part2-badge"
          }
        ]
      }
    ]
    }
  }
})
