import star from './star.svg';

// star is { id, viewBox, url, content }; url is "#icon-star" in inline mode.
document.getElementById('app').innerHTML = `
  <h1>rspack-plugin-svg-sprite</h1>
  <svg width="48" height="48" viewBox="${star.viewBox}" fill="#7c3aed">
    <use href="${star.url}" />
  </svg>
  <pre>${JSON.stringify({ id: star.id, viewBox: star.viewBox, url: star.url }, null, 2)}</pre>
`;
