import star from './icons/star.svg';
import gradient from './icons/gradient.svg';
import multi from './icons/multi.svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Accessible patterns: a decorative icon sits beside visible text and is hidden from assistive
// technology; a meaningful icon stands alone, so it gets role="img" and a label.
function renderIcon(symbol, label) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', symbol.viewBox);
  svg.setAttribute('data-icon', symbol.id);
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', symbol.url);
  svg.appendChild(use);
  return svg;
}

function addRow(list, symbol, text, label) {
  const li = document.createElement('li');
  li.appendChild(renderIcon(symbol, label));
  if (text) li.appendChild(document.createTextNode(' ' + text));
  list.appendChild(li);
}

const root = document.getElementById('app');
const list = document.createElement('ul');
root.appendChild(list);

addRow(list, star, 'Starred', null);
addRow(list, gradient, '', 'Sunrise');
addRow(list, multi, 'Palette', null);

const button = document.createElement('button');
button.type = 'button';
button.id = 'add-icon';
button.textContent = 'Add icon';
button.addEventListener('click', async () => {
  const late = (await import('./icons/late.svg')).default;
  addRow(list, late, 'Added later', null);
});
root.appendChild(button);
