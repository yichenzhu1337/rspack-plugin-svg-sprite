import homeIcon from './icons/home.svg';
import searchIcon from './icons/search.svg';
import userIcon from './icons/user.svg';
import settingsIcon from './icons/settings.svg';
import mailIcon from './icons/mail.svg';
import heartIcon from './icons/heart.svg';
import bellIcon from './icons/bell.svg';
import starIcon from './icons/star.svg';

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
];

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>
          rspack-plugin-svg-sprite
        </h1>
        <p>
          Drop-in <code>svg-sprite-loader</code> replacement for Rspack. SVGs are compiled into a
          single sprite sheet and referenced via <code>&lt;use&gt;</code>.
        </p>
      </header>

      <div className="main">
        <section className="icons-section">
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
            Sprite URL:{' '}
            <a href={homeIcon.url.replace(/#.*/, '')} target="_blank" rel="noreferrer">
              <code>{new URL(homeIcon.url.replace(/#.*/, ''), window.location.href).href}</code>
            </a>
          </div>
        </section>

        <section className="code-section">
          <h2>How It Works</h2>
          <div className="code-block">
            <span className="cmt">{'// 1. Import — loader converts SVGs to sprite symbols'}</span>
            <br />
            <span className="kw">import</span> homeIcon <span className="kw">from</span>{' '}
            <span className="str">&apos;./icons/home.svg&apos;</span>;
            <br />
            <br />
            <span className="cmt">{'// 2. Each import returns { id, viewBox, url }'}</span>
            <br />
            {'homeIcon.id;      '}<span className="cmt">{'// "icon-home"'}</span>
            <br />
            {'homeIcon.viewBox; '}<span className="cmt">{'// "0 0 24 24"'}</span>
            <br />
            {'homeIcon.url;     '}<span className="cmt">{'// "sprite.svg#icon-home"'}</span>
            <br />
            <br />
            <span className="cmt">{'// 3. Render with <use>'}</span>
            <br />
            {'<'}<span className="fn">svg</span>{' '}<span className="fn">viewBox</span>={'="0 0 24 24">'}
            <br />
            {'  <'}<span className="fn">use</span>{' '}<span className="fn">href</span>={'={homeIcon.url} />'}
            <br />
            {'</'}<span className="fn">svg</span>{'>'}
          </div>
        </section>
      </div>

      <footer>
        <a href="https://github.com/yichenzhu1337/rspack-plugin-svg-sprite" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span className="sep">·</span>
        <a href="https://www.npmjs.com/package/rspack-plugin-svg-sprite" target="_blank" rel="noreferrer">
          npm
        </a>
      </footer>
    </div>
  );
}
