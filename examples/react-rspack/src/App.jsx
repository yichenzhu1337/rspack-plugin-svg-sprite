import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';

import homeIcon from './icons/home.svg';
import searchIcon from './icons/search.svg';
import userIcon from './icons/user.svg';
import settingsIcon from './icons/settings.svg';
import mailIcon from './icons/mail.svg';
import heartIcon from './icons/heart.svg';
import bellIcon from './icons/bell.svg';
import starIcon from './icons/star.svg';
import closeIcon from './icons/close.svg';
import checkIcon from './icons/check.svg';
import downloadIcon from './icons/download.svg';
import codeIcon from './icons/code.svg';
import globeIcon from './icons/globe.svg';
import lockIcon from './icons/lock.svg';
import BaseIcon from './components/BaseIcon';

const icons = [
  { symbol: homeIcon, name: 'home' },
  { symbol: searchIcon, name: 'search' },
  { symbol: userIcon, name: 'user' },
  { symbol: settingsIcon, name: 'settings' },
  { symbol: mailIcon, name: 'mail' },
  { symbol: heartIcon, name: 'heart' },
  { symbol: bellIcon, name: 'bell' },
  { symbol: starIcon, name: 'star' },
  { symbol: closeIcon, name: 'close' },
  { symbol: checkIcon, name: 'check' },
  { symbol: downloadIcon, name: 'download' },
  { symbol: codeIcon, name: 'code' },
  { symbol: globeIcon, name: 'globe' },
  { symbol: lockIcon, name: 'lock' },
];

const configCode = `// rspack.config.js
const { SvgSpritePlugin } = require('rspack-plugin-svg-sprite');

module.exports = {
  module: {
    rules: [
      {
        test: /\\.svg$/,
        type: 'javascript/auto',
        loader: 'rspack-plugin-svg-sprite/loader',
        options: {
          extract: true,
          symbolId: 'icon-[name]',
          spriteFilename: 'sprite.svg',
        },
      },
    ],
  },
  plugins: [
    new SvgSpritePlugin({
      plainSprite: true,
      spriteAttrs: { id: 'svg-sprite' },
    }),
  ],
};`;

const usageCode = `import homeIcon from './icons/home.svg';

// Each import returns { id, viewBox, url }
homeIcon.id;      // "icon-home"
homeIcon.viewBox; // "0 0 24 24"
homeIcon.url;     // "sprite.svg#icon-home"

// Render with <use> — one HTTP request for all icons
<svg viewBox={homeIcon.viewBox}>
  <use href={homeIcon.url} />
</svg>`;

function Code({ code }) {
  const html = Prism.highlight(code, Prism.languages.javascript, 'javascript');
  return <pre className="code-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>🧩 rspack-plugin-svg-sprite</h1>
        <p>
          Drop-in <code>svg-sprite-loader</code> replacement for Rspack. SVGs are compiled into a
          single sprite sheet and referenced via <code>&lt;use&gt;</code>.
        </p>
      </header>

      <section>
        <h2>Icons from sprite</h2>
        <div className="icon-grid">
          {icons.map(({ symbol, name }) => (
            <div className="icon-card" key={name}>
              <BaseIcon icon={symbol} size={28} />
              <span>{name}</span>
            </div>
          ))}
        </div>
        <div className="sprite-url">
          Combined Icons in a single sprite.svg File:{' '}
          <a href={homeIcon.url.replace(/#.*/, '')} target="_blank" rel="noreferrer">
            <code>{new URL(homeIcon.url.replace(/#.*/, ''), window.location.href).href}</code>
          </a>
        </div>
      </section>

      <section>
        <h2>
          <a
            href="https://github.com/yichenzhu1337/rspack-plugin-svg-sprite?tab=readme-ov-file#configure-inline-mode"
            target="_blank"
            rel="noreferrer"
          >
            Combine Icons into a single sprite.svg File!
          </a>
        </h2>
        <Code code={configCode} />
      </section>

      <section>
        <h2>Watch it magically work!</h2>
        <Code code={usageCode} />
      </section>

      <footer>
        <a
          href="https://github.com/yichenzhu1337/rspack-plugin-svg-sprite"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <span className="sep">&middot;</span>
        <a
          href="https://www.npmjs.com/package/rspack-plugin-svg-sprite"
          target="_blank"
          rel="noreferrer"
        >
          npm
        </a>
      </footer>
    </div>
  );
}
