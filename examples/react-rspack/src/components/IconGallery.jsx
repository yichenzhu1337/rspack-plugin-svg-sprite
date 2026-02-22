import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function IconGallery({ icons }) {
  const [selected, setSelected] = useState(null);

  const toggle = (name) => setSelected(selected === name ? null : name);

  return (
    <section className="section">
      <h2>Icon Gallery</h2>
      <div className="icon-grid" role="listbox" aria-label="Available icons">
        {icons.map(({ symbol, name }) => (
          <div
            key={name}
            role="option"
            aria-selected={selected === name}
            tabIndex={0}
            className={`icon-card ${selected === name ? 'selected' : ''}`}
            onClick={() => toggle(name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(name);
              }
            }}
          >
            <BaseIcon icon={symbol} size={32} />
            <span>{name}</span>
          </div>
        ))}
      </div>
      {selected && (
        <div className="selection-info" aria-live="polite">
          Selected: <code>{selected}</code> — URL:{' '}
          <code>{icons.find((i) => i.name === selected)?.symbol.url}</code>
        </div>
      )}
    </section>
  );
}
