import homeIcon from './icons/home.svg';
import searchIcon from './icons/search.svg';
import userIcon from './icons/user.svg';
import settingsIcon from './icons/settings.svg';
import mailIcon from './icons/mail.svg';
import heartIcon from './icons/heart.svg';
import bellIcon from './icons/bell.svg';
import starIcon from './icons/star.svg';
import closeIcon from './icons/close.svg';

import IconGallery from './components/IconGallery';
import Sidebar from './components/Sidebar';
import Buttons from './components/Buttons';
import Notifications from './components/Notifications';

const allIcons = [
  { symbol: homeIcon, name: 'home' },
  { symbol: searchIcon, name: 'search' },
  { symbol: userIcon, name: 'user' },
  { symbol: settingsIcon, name: 'settings' },
  { symbol: mailIcon, name: 'mail' },
  { symbol: heartIcon, name: 'heart' },
  { symbol: bellIcon, name: 'bell' },
  { symbol: starIcon, name: 'star' },
];

const navItems = [
  { symbol: homeIcon, label: 'Dashboard' },
  { symbol: searchIcon, label: 'Search' },
  { symbol: mailIcon, label: 'Messages' },
  { symbol: bellIcon, label: 'Notifications' },
  { symbol: userIcon, label: 'Profile' },
  { symbol: settingsIcon, label: 'Settings' },
];

const iconMap = {
  home: homeIcon,
  search: searchIcon,
  user: userIcon,
  settings: settingsIcon,
  mail: mailIcon,
  heart: heartIcon,
  bell: bellIcon,
  star: starIcon,
  close: closeIcon,
};

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>
          rspack-plugin-svg-sprite <span className="badge">React + extract mode</span>
        </h1>
        <p>A React app consuming the SVG sprite plugin with Rspack</p>
      </header>

      <IconGallery icons={allIcons} />
      <Sidebar navItems={navItems} brandIcon={starIcon} />
      <Buttons searchIcon={searchIcon} settingsIcon={settingsIcon} heartIcon={heartIcon} />
      <Notifications iconMap={iconMap} dismissIcon={closeIcon} />

      <section className="section">
        <h2>How It Works</h2>
        <div className="code-block">
          <span className="cmt">
            {'// 1. Import SVGs — the loader turns them into sprite symbols'}
          </span>
          <br />
          <span className="kw">import</span> homeIcon <span className="kw">from</span>{' '}
          <span className="str">'./icons/home.svg'</span>;<br />
          <br />
          <span className="cmt">{'// 2. Each import gives you { id, viewBox, url }'}</span>
          <br />
          homeIcon.id;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span className="cmt">{'// "icon-home"'}</span>
          <br />
          homeIcon.viewBox; <span className="cmt">{'// "0 0 24 24"'}</span>
          <br />
          homeIcon.url;&nbsp;&nbsp;&nbsp;&nbsp;{' '}
          <span className="cmt">{'// "sprite.svg#icon-home"'}</span>
          <br />
          <br />
          <span className="cmt">{'// 3. Use the BaseIcon component'}</span>
          <br />
          {'<'}
          <span className="fn">BaseIcon</span> <span className="fn">icon</span>={'{'}homeIcon{'}'}{' '}
          <span className="fn">size</span>={'{'}24{'}'} {'/>'}
        </div>
      </section>
    </div>
  );
}
