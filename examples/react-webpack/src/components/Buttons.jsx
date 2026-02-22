import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function Buttons({ filterIcon, saveIcon, deleteIcon }) {
  const [saved, setSaved] = useState(false);

  return (
    <section className="section">
      <h2>Interactive Buttons</h2>
      <div className="button-row">
        <button className="btn btn-primary">
          <BaseIcon icon={filterIcon} size={16} /> Filter
        </button>
        <button className={`btn ${saved ? 'btn-liked' : ''}`} onClick={() => setSaved(!saved)}>
          <BaseIcon icon={saveIcon} size={16} />
          {saved ? 'Saved!' : 'Save'}
        </button>
        <button className="btn btn-danger">
          <BaseIcon icon={deleteIcon} size={16} /> Delete
        </button>
      </div>
      {saved && <p className="like-feedback">Item saved!</p>}
    </section>
  );
}
