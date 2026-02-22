import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function Sidebar({ navItems, brandIcon }) {
  const [active, setActive] = useState('Approvals');

  return (
    <section className="section">
      <h2>Sidebar Navigation</h2>
      <div className="sidebar-demo">
        <nav className="sidebar">
          <div className="sidebar-brand">
            <BaseIcon icon={brandIcon} size={20} />
            Acme App
          </div>
          {navItems.map(({ symbol, label }) => (
            <div
              key={label}
              className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => setActive(label)}
            >
              <BaseIcon icon={symbol} size={18} />
              <span>{label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-content">
          <h3>{active}</h3>
          <p>
            This sidebar uses SVG sprite icons loaded via{' '}
            <code>svg-sprite-loader</code> in extract mode.
            Each icon is a <code>&lt;use&gt;</code> reference to a{' '}
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
