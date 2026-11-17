import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

const ORIGIN = 'https://yichenzhu1337.github.io';
const REPO = 'https://github.com/yichenzhu1337/rspack-plugin-svg-sprite';
// The docs live under /docs/ of the project site; the demo app stays at the site root.
// Override with DOCS_BASE to host them elsewhere.
const base = process.env.DOCS_BASE || '/rspack-plugin-svg-sprite/docs/';
const OG_IMAGE = `${ORIGIN}/rspack-plugin-svg-sprite/og.png`;
const pageUrl = (routePath: string) => `${ORIGIN}${base.replace(/\/$/, '')}${routePath}`;
const description =
  'SVG sprite loader and plugin for Rspack, Rsbuild and webpack 5: a drop-in replacement for svg-sprite-loader with inline and extract modes.';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base,
  title: 'rspack-plugin-svg-sprite',
  description,
  // Absolute URLs in sitemap.xml (relative <loc> entries are invalid and ignored by search engines).
  siteOrigin: ORIGIN,
  icon: '/favicon.svg',
  logo: '/favicon.svg',
  logoText: 'rspack-plugin-svg-sprite',
  outDir: 'doc_build',
  globalStyles: path.join(__dirname, 'theme/styles.css'),
  // Emit llms.txt, llms-full.txt and a .md twin of every page for AI agents.
  llms: true,
  markdown: {
    link: { checkDeadLinks: true },
  },
  // Per page: canonical URL, og:url, the shared social image and a large Twitter card.
  head: [
    (route) =>
      route.routePath === '/404'
        ? ['meta', { name: 'robots', content: 'noindex' }]
        : ['link', { rel: 'canonical', href: pageUrl(route.routePath) }],
    (route) =>
      route.routePath === '/404'
        ? undefined
        : ['meta', { property: 'og:url', content: pageUrl(route.routePath) }],
    ['meta', { property: 'og:site_name', content: 'rspack-plugin-svg-sprite' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'rspack-plugin-svg-sprite: every flag in the world, one SVG sprite',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
  ],
  themeConfig: {
    darkMode: true,
    // Laravel-style layout: a short top bar, every page in a grouped left sidebar.
    nav: [{ text: 'Demo', link: `${ORIGIN}/rspack-plugin-svg-sprite/` }],
    sidebar: {
      '/': [
        {
          text: 'Getting started',
          collapsible: false,
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Installation', link: '/getting-started' },
            { text: 'Migrating', link: '/migrating' },
          ],
        },
        {
          text: 'Guides',
          collapsible: false,
          items: [
            { text: 'Inline vs extract', link: '/modes' },
            { text: 'Frameworks', link: '/frameworks' },
          ],
        },
        {
          text: 'Reference',
          collapsible: false,
          items: [
            { text: 'Options', link: '/options' },
            { text: 'Troubleshooting', link: '/faq' },
            { text: 'Guarantees', link: '/guarantees' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', mode: 'link', content: REPO },
      {
        icon: 'npm',
        mode: 'link',
        content: 'https://www.npmjs.com/package/rspack-plugin-svg-sprite',
      },
    ],
    editLink: { docRepoBaseUrl: `${REPO}/tree/main/website/docs` },
  },
});
