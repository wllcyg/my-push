import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

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
    sidebar: generateSidebar([
      {
        documentRootPath: '/',        
        scanStartPath: 'docs/ai',     
        resolvePath: '/docs/ai/',     
        useTitleFromFileHeading: true,
        useTitleFromFrontmatter: true,
        sortMenusOrderByDescending: false,
        rootGroupText: 'AI & Agent 学习实战',
        collapsed: false
      },
      {
        documentRootPath: '/',
        scanStartPath: 'docs/flutter', 
        resolvePath: '/docs/flutter/',
        useTitleFromFileHeading: true,
        useTitleFromFrontmatter: true,
        sortMenusOrderByDescending: false,
        rootGroupText: 'Flutter 开发指南',
        collapsed: false
      }
    ])
  }
})
