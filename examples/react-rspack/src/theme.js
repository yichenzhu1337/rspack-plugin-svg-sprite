// Theme toggle and the install-command copy button. Plain DOM:
// the page is static HTML, React only renders the flag wall.
const root = document.documentElement;
const query = window.matchMedia('(prefers-color-scheme: dark)');
const toggle = document.getElementById('theme-toggle');

function stored() {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch (e) {
    return null;
  }
}

function effective() {
  return stored() || (query.matches ? 'dark' : 'light');
}

function save(theme) {
  try {
    if (theme === (query.matches ? 'dark' : 'light')) {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', theme);
    }
  } catch (e) {
    // Storage blocked: the choice lasts for this page only.
  }
}

function render() {
  const dark = effective() === 'dark';
  if (!stored()) delete root.dataset.theme;
  toggle.setAttribute('aria-label', dark ? 'Use light theme' : 'Use dark theme');
  toggle.querySelector('use').setAttribute('href', `sprite.svg#icon-${dark ? 'sun' : 'moon'}`);
}

if (toggle) {
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    save(next);
    render();
  });
  query.addEventListener('change', render);
  render();
}

const copy = document.getElementById('install-copy');
const status = document.getElementById('install-status');
if (copy && navigator.clipboard) {
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById('install-cmd').textContent);
      status.textContent = 'Copied';
    } catch (e) {
      status.textContent = 'Copy failed';
    }
  });
}
