import { useMemo, useState } from 'react';
import { flags } from './flags';

const INITIAL = 40;

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const index = flags.map((f) => ({ ...f, key: fold(`${f.name} ${f.code}`) }));

function initialFlag() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return flags.find((f) => f.code === region) || flags[0];
  } catch (e) {
    return flags[0];
  }
}

function Flag({ symbol, className }) {
  return (
    <svg className={className} viewBox={symbol.viewBox} aria-hidden="true">
      <use href={symbol.url} />
    </svg>
  );
}

function inspectorCode(flag) {
  const { id, viewBox, url } = flag.symbol;
  return `import flag from '@flags/${flag.code}.svg';

flag.id // "${id}"
flag.viewBox // "${viewBox}"
flag.url // "${url}"

<svg viewBox={flag.viewBox}>
  <use href={flag.url} />
</svg>`;
}

function Inspector({ flag }) {
  const [status, setStatus] = useState('');
  const code = inspectorCode(flag);
  const canCopy = Boolean(navigator.clipboard);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus('Copied');
    } catch (e) {
      setStatus('Copy failed');
    }
    setTimeout(() => setStatus(''), 2000);
  }

  return (
    <aside className="inspector" aria-label="Selected flag">
      <div className="inspector-head">
        <Flag symbol={flag.symbol} className="flag-big" />
        <div>
          <h3>{flag.name}</h3>
          <p className="inspector-code">{flag.code}</p>
        </div>
      </div>
      <div className="codebox">
        <pre tabIndex={0}>
          <code className="language-js">{code}</code>
        </pre>
      </div>
      {canCopy && (
        <button type="button" className="copy-btn" onClick={copy}>
          <svg className="icon" aria-hidden="true">
            <use href={`sprite.svg#icon-${status === 'Copied' ? 'check' : 'copy'}`} />
          </svg>
          {status === 'Copied' ? 'Copied' : 'Copy code'}
        </button>
      )}
      <span className="sr-only" role="status">
        {status}
      </span>
      <p className="inspector-note">
        <code>@flags</code> points to <code>country-flag-icons/3x2</code> (alias in
        rspack.config.js).
      </p>
    </aside>
  );
}

export default function FlagWall() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(initialFlag);

  const q = fold(query.trim());
  const matches = useMemo(() => (q ? index.filter((f) => f.key.includes(q)) : index), [q]);
  const shown = q || expanded ? matches : matches.slice(0, INITIAL);

  let summary;
  if (matches.length === 0) summary = `No flag matches “${query.trim()}”`;
  else if (q) summary = `${matches.length} ${matches.length === 1 ? 'flag' : 'flags'}`;
  else summary = `${shown.length} of ${matches.length} flags`;

  return (
    <div className="wall">
      <Inspector flag={selected} />
      <div>
        <label className="search">
          <span className="label">Filter flags</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Country or code, e.g. Japan or JP"
            autoComplete="off"
          />
        </label>
        <p className="count" role="status">
          {summary}
        </p>
        <ul className="flag-grid" id="flag-grid">
          {shown.map((f) => (
            <li key={f.code}>
              <button
                type="button"
                aria-pressed={f.code === selected.code}
                onClick={() => setSelected(f)}
              >
                <Flag symbol={f.symbol} className="flag" />
                <span className="flag-name">{f.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {!q && !expanded && (
          <button
            type="button"
            className="show-all"
            aria-expanded="false"
            aria-controls="flag-grid"
            onClick={() => setExpanded(true)}
          >
            Show all {matches.length} flags
          </button>
        )}
      </div>
    </div>
  );
}
