import approvedIcon from './icons/approved.svg';
import closeIcon from './icons/close.svg';
import commentIcon from './icons/comment.svg';
import deleteIcon from './icons/delete.svg';
import filterIcon from './icons/filter.svg';
import helpIcon from './icons/help.svg';
import saveIcon from './icons/save.svg';
import userIcon from './icons/user.svg';

import IconGallery from './components/IconGallery';
import Sidebar from './components/Sidebar';
import Buttons from './components/Buttons';
import Notifications from './components/Notifications';

const allIcons = [
  { symbol: approvedIcon, name: 'approved' },
  { symbol: closeIcon, name: 'close' },
  { symbol: commentIcon, name: 'comment' },
  { symbol: deleteIcon, name: 'delete' },
  { symbol: filterIcon, name: 'filter' },
  { symbol: helpIcon, name: 'help' },
  { symbol: saveIcon, name: 'save' },
  { symbol: userIcon, name: 'user' },
];

const navItems = [
  { symbol: approvedIcon, label: 'Approvals' },
  { symbol: commentIcon, label: 'Comments' },
  { symbol: filterIcon, label: 'Filters' },
  { symbol: userIcon, label: 'Profile' },
  { symbol: helpIcon, label: 'Help' },
];

const iconMap = {
  approved: approvedIcon,
  close: closeIcon,
  comment: commentIcon,
  delete: deleteIcon,
  filter: filterIcon,
  help: helpIcon,
  save: saveIcon,
  user: userIcon,
};

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>
          svg-sprite-loader <span className="badge">React + Webpack</span>
        </h1>
        <p>A React app using the original svg-sprite-loader with Webpack 5</p>
      </header>

      <IconGallery icons={allIcons} />
      <Sidebar navItems={navItems} brandIcon={approvedIcon} />
      <Buttons filterIcon={filterIcon} saveIcon={saveIcon} deleteIcon={deleteIcon} />
      <Notifications iconMap={iconMap} dismissIcon={closeIcon} />

      <section className="section">
        <h2>How It Works</h2>
        <div className="code-block">
          <span className="cmt">
            {'// 1. Import SVGs — svg-sprite-loader turns them into sprite symbols'}
          </span>
          <br />
          <span className="kw">import</span> approvedIcon <span className="kw">from</span>{' '}
          <span className="str">'./icons/approved.svg'</span>;<br />
          <br />
          <span className="cmt">{'// 2. Each import gives you { id, viewBox, url }'}</span>
          <br />
          approvedIcon.id;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{' '}
          <span className="cmt">{'// "approved"'}</span>
          <br />
          approvedIcon.viewBox; <span className="cmt">{'// "0 0 24 24"'}</span>
          <br />
          approvedIcon.url;&nbsp;&nbsp;&nbsp;&nbsp;{' '}
          <span className="cmt">{'// "sprite.svg#approved"'}</span>
          <br />
          <br />
          <span className="cmt">{'// 3. Use the BaseIcon component'}</span>
          <br />
          {'<'}
          <span className="fn">BaseIcon</span> <span className="fn">icon</span>={'{'}approvedIcon
          {'}'} <span className="fn">size</span>={'{'}24{'}'} {'/>'}
        </div>
      </section>
    </div>
  );
}
