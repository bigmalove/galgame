import { defineConfig } from 'vitepress'

export default defineConfig({
  // 站点元数据
  title: 'Galgame 界面插件',
  description: '将 SillyTavern 对话变为视觉小说体验的插件使用指南',
  lang: 'zh-CN',

  // 部署到 GitHub Pages 时的 base 路径
  // 如果仓库名是 username.github.io，设为 '/'
  // 如果是 username.github.io/repo-name，设为 '/repo-name/'
  base: '/galgame/',

  // 主题配置
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Galgame 界面插件',

    // 顶部导航
    nav: [
      { text: '使用指南', link: '/guide/introduction' },
      { text: '卡作者接入', link: '/card-author/overview' },
      { text: '标签速查', link: '/reference/tags' },
      {
        text: '相关链接',
        items: [
          { text: '酒馆助手文档', link: 'https://n0vi028.github.io/JS-Slash-Runner-Doc/' },
          { text: 'SillyTavern', link: 'https://sillytavern.app/' },
        ],
      },
    ],

    // 侧边栏
    sidebar: {
      '/guide/': sidebarGuide(),
      '/basics/': sidebarGuide(),
      '/advanced/': sidebarGuide(),
      '/resources/': sidebarGuide(),
      '/customization/': sidebarGuide(),
      '/reference/': sidebarGuide(),
      '/card-author/': sidebarCardAuthor(),
    },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/bigmalove/galgame' },
    ],

    // 页脚
    footer: {
      message: 'Galgame 界面插件 使用指南',
      copyright: '© 2026',
    },

    // 搜索
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    // 文档页脚导航文本
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    outline: { label: '页面导航', level: [2, 3] },
    lastUpdated: { text: '最后更新于' },
    editLink: {
      pattern: 'https://github.com/bigmalove/galgame/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },
  },

  // Markdown 配置
  markdown: {
    image: {
      lazyLoading: true,
    },
  },

  // 忽略死链（开发阶段先不报错）
  ignoreDeadLinks: true,
})

/* ========================================
 * 侧边栏定义
 * ======================================== */

function sidebarGuide() {
  return [
    {
      text: '起步',
      collapsed: false,
      items: [
        { text: '介绍', link: '/guide/introduction' },
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '界面总览', link: '/guide/ui-overview' },
      ],
    },
    {
      text: '基础教程',
      collapsed: false,
      items: [
        { text: '对话与文本', link: '/basics/dialogue' },
        { text: '背景与场景', link: '/basics/backgrounds' },
        { text: '角色立绘', link: '/basics/sprites' },
        { text: '选项与分支', link: '/basics/choices' },
        { text: '剧情回顾', link: '/basics/history' },
      ],
    },
    {
      text: '高级功能',
      collapsed: false,
      items: [
        { text: 'Live2D 角色模型', link: '/advanced/live2d' },
        { text: '语音合成 (TTS)', link: '/advanced/tts' },
        { text: '背景音乐 (BGM)', link: '/advanced/bgm' },
        { text: '视觉特效', link: '/advanced/effects' },
        { text: '加强模式', link: '/advanced/enhanced-mode' },
        { text: '地图系统', link: '/advanced/map' },
      ],
    },
    {
      text: '资源管理',
      collapsed: false,
      items: [
        { text: '资源管理器', link: '/resources/asset-manager' },
        { text: '内置背景图包', link: '/resources/builtin-bg-packs' },
        { text: '导入与导出', link: '/resources/import-export' },
      ],
    },
    {
      text: '个性化',
      collapsed: false,
      items: [
        { text: '界面皮肤', link: '/customization/skins' },
        { text: '设置面板详解', link: '/customization/settings' },
        { text: '状态弹窗', link: '/customization/status-popup' },
      ],
    },
    {
      text: '参考',
      collapsed: false,
      items: [
        { text: 'COT 模板', link: '/reference/cot-template' },
        { text: 'AI 输出标签速查', link: '/reference/tags' },
        { text: '控制台命令', link: '/reference/console' },
        { text: '常见问题', link: '/reference/faq' },
      ],
    },
  ]
}

function sidebarCardAuthor() {
  return [
    {
      text: '角色卡作者接入指南',
      collapsed: false,
      items: [
        { text: '接入概述', link: '/card-author/overview' },
        { text: '配置你的角色卡', link: '/card-author/setup' },
        { text: '导出角色卡', link: '/card-author/export' },
        { text: '验证与分发', link: '/card-author/verify' },
      ],
    },
    {
      text: '返回使用指南',
      items: [
        { text: '← 使用指南首页', link: '/guide/introduction' },
      ],
    },
  ]
}
