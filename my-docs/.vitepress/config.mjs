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
      { text: 'Flutter', link: '/docs/flutter/00-roadmap/learning-guide' },
      { text: 'AI & Agent', link: '/docs/ai/01-foundations/01-agent-learning' },
      { text: 'HarmonyOS', link: '/docs/harmony/app-matrix' },
      { text: '随笔杂谈', link: '/docs/essays/在忘忧AI的第两百一十九天' },
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
      },
      {
        documentRootPath: '/',
        scanStartPath: 'docs/harmony', 
        resolvePath: '/docs/harmony/',
        useTitleFromFileHeading: true,
        useTitleFromFrontmatter: true,
        sortMenusOrderByDescending: false,
        rootGroupText: 'HarmonyOS 鸿蒙专栏',
        collapsed: false
      },
      {
        documentRootPath: '/',
        scanStartPath: 'docs/essays', 
        resolvePath: '/docs/essays/',
        useTitleFromFileHeading: true,
        useTitleFromFrontmatter: true,
        sortMenusOrderByDescending: false,
        rootGroupText: '随笔杂谈',
        collapsed: false
      }
    ])
  }
})
