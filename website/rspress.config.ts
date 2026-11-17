import * as path from 'node:path';
import { defineConfig } from '@rspress/core';

const ORIGIN = 'https://yichenzhu1337.github.io';
const REPO = 'https://github.com/yichenzhu1337/rspack-plugin-svg-sprite';
// The docs live under /docs/ of the project site; the demo app stays at the site root.
// Override with DOCS_BASE to host them elsewhere.
const base = process.env.DOCS_BASE || '/rspack-plugin-svg-sprite/docs/';
const description =
  'SVG sprite loader and plugin for Rspack, Rsbuild and webpack 5: a drop-in replacement for svg-sprite-loader with inline and extract modes.';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base,
  title: 'rspack-plugin-svg-sprite',
  description,
  icon: '/favicon.svg',
  logo: '/favicon.svg',
  outDir: 'doc_build',
  // Emit llms.txt, llms-full.txt and a .md twin of every page for AI agents.
  llms: true,
  markdown: {
    link: { checkDeadLinks: true },
  },
  themeConfig: {
    darkMode: true,
    // Copy-as-Markdown and open-in-ChatGPT/Claude actions below each page title.
    llmsUI: true,
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Options', link: '/options' },
      { text: 'Migrating', link: '/migrating' },
      { text: 'FAQ', link: '/faq' },
      { text: 'Live demo', link: `${ORIGIN}/rspack-plugin-svg-sprite/` },
    ],
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
