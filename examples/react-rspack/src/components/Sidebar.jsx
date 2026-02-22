import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function Sidebar({ navItems, brandIcon }) {
  const [active, setActive] = useState(navItems[0]?.label);

  return (
    <section className="section">
      <h2>Sidebar Navigation</h2>
      <div className="sidebar-demo">
        <nav className="sidebar" aria-label="Main navigation">
          <div className="sidebar-brand">
            <BaseIcon icon={brandIcon} size={20} />
            Acme App
          </div>
          {navItems.map(({ symbol, label }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => setActive(label)}
              aria-current={active === label ? 'page' : undefined}
            >
              <BaseIcon icon={symbol} size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-content">
          <h3>{active}</h3>
          <p>
            This sidebar uses SVG sprite icons loaded via <code>rspack-plugin-svg-sprite</code> in
            extract mode. Each icon is a <code>&lt;use&gt;</code> reference to a{' '}
            <code>&lt;symbol&gt;</code> inside the extracted <code>sprite.svg</code>.
          </p>
          <p className="active-info">
            Active route: <code>{active}</code>
          </p>
        </div>
      </div>
    </section>
  );
}
