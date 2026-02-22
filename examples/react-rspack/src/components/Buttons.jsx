import { useState } from 'react';
import BaseIcon from './BaseIcon';

export default function Buttons({ searchIcon, settingsIcon, heartIcon }) {
  const [liked, setLiked] = useState(false);

  return (
    <section className="section">
      <h2>Interactive Buttons</h2>
      <div className="button-row">
        <button className="btn btn-primary">
          <BaseIcon icon={searchIcon} size={16} /> Search
        </button>
        <button className="btn">
          <BaseIcon icon={settingsIcon} size={16} /> Settings
        </button>
        <button
          className={`btn ${liked ? 'btn-liked' : 'btn-danger'}`}
          onClick={() => setLiked(!liked)}
        >
          <BaseIcon icon={heartIcon} size={16} />
          {liked ? 'Liked!' : 'Favorite'}
        </button>
      </div>
      {liked && <p className="like-feedback">You liked this!</p>}
    </section>
  );
}
