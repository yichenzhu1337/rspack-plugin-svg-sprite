import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function IconGallery({ icons }) {
  const [selected, setSelected] = useState(null);

  return (
    <section className="section">
      <h2>Icon Gallery</h2>
      <div className="icon-grid">
        {icons.map(({ symbol, name }) => (
          <div
            key={name}
            className={`icon-card ${selected === name ? 'selected' : ''}`}
            onClick={() => setSelected(selected === name ? null : name)}
          >
            <BaseIcon icon={symbol} size={32} />
            <span>{name}</span>
          </div>
        ))}
      </div>
      {selected && (
        <div className="selection-info">
          Selected: <code>{selected}</code> — URL: <code>{icons.find(i => i.name === selected)?.symbol.url}</code>
        </div>
      )}
    </section>
  );
}
