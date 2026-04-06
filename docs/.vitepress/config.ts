import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Web Haptic Engine",
  description:
    "Cross-platform haptic feedback library for web apps — works with React, Next.js, Vue, and vanilla JS.",
  base: "/web-haptic-engine/docs/",
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📳</text></svg>",
      },
    ],
  ],
  themeConfig: {
    logo: undefined,
    siteTitle: "Web Haptic Engine",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Frameworks", link: "/frameworks/react" },
      { text: "API", link: "/api/" },
      {
        text: "Demo",
        link: "https://sumitsahoo.github.io/web-haptic-engine/",
      },
      {
        text: "GitHub",
        link: "https://github.com/sumitsahoo/web-haptic-engine",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Presets", link: "/guide/presets" },
          { text: "Platform Support", link: "/guide/platform-support" },
        ],
      },
      {
        text: "Framework Guides",
        items: [
          { text: "React", link: "/frameworks/react" },
          { text: "Next.js", link: "/frameworks/nextjs" },
          { text: "Vue", link: "/frameworks/vue" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "HapticEngine", link: "/api/" },
          { text: "DragHaptics", link: "/api/drag-haptics" },
          { text: "Types", link: "/api/types" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/sumitsahoo/web-haptic-engine",
      },
      { icon: "npm", link: "https://www.npmjs.com/package/web-haptic-engine" },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Sumit Sahoo",
    },
    search: {
      provider: "local",
    },
    outline: "deep",
  },
});
