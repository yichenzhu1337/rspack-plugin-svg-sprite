// A tiny syntax highlighter for the JS, JSX and HTML snippets on this page.
// It only splits text into tokens: the text itself never changes, so the static
// HTML stays plain for readers that do not run JavaScript.
const KEYWORDS = new Set(
  'const let var function return if else new import from export default async await for of in class extends typeof instanceof this void delete throw try catch finally switch case break continue while do yield static'.split(
    ' ',
  ),
);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

// Order matters: the first rule that matches at the current position wins.
const RULES = [
  ['comment', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ['string', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
  ['template', /`(?:\\.|[^`\\])*`/y],
  ['tag', /<\/?[A-Za-z][\w.:-]*/y],
  ['number', /\b(?:0[xX][\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y],
  ['word', /[A-Za-z_$][\w$-]*/y],
  ['space', /\s+/y],
  ['punct', /[^\sA-Za-z0-9_$]/y],
];
const REGEX = /\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[a-z]*/y;
const NEXT_IS_KEY = /\s*:(?!:)/y;
const NEXT_IS_ATTR = /=/y;
const NEXT_IS_CALL = /\(/y;

function peek(re, src, at) {
  re.lastIndex = at;
  return re.test(src);
}

// Returns [{ type, text }]: type is a class suffix ('keyword', 'string', ...) or '' for plain text.
export function tokenize(src) {
  const out = [];
  let i = 0;
  let inTag = false;
  let valueBefore = false; // a regex literal cannot follow a value
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type && type === '') last.text += text;
    else out.push({ type, text });
  };

  while (i < src.length) {
    if (!valueBefore && src[i] === '/' && !inTag) {
      REGEX.lastIndex = i;
      const m = REGEX.exec(src);
      if (m) {
        push('regex', m[0]);
        i += m[0].length;
        valueBefore = true;
        continue;
      }
    }
    let hit = null;
    for (const [name, re] of RULES) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m) {
        hit = [name, m[0]];
        break;
      }
    }
    if (!hit) {
      push('', src[i]);
      i += 1;
      continue;
    }
    const [name, text] = hit;
    const end = i + text.length;
    if (name === 'tag') {
      inTag = true;
      push('tag', text);
      valueBefore = false;
    } else if (name === 'word') {
      let type = '';
      if (inTag && peek(NEXT_IS_ATTR, src, end)) type = 'attr';
      else if (!inTag && KEYWORDS.has(text)) type = 'keyword';
      else if (LITERALS.has(text)) type = 'number';
      else if (!inTag && peek(NEXT_IS_KEY, src, end)) type = 'property';
      else if (!inTag && peek(NEXT_IS_CALL, src, end)) type = 'function';
      push(type, text);
      valueBefore = type === '' || type === 'number' || type === 'function';
    } else if (name === 'space') {
      push('', text);
    } else if (name === 'punct') {
      if (text === '>') inTag = false;
      push('punct', text);
      valueBefore = text === ')' || text === ']' || text === '}';
    } else {
      push(name, text);
      valueBefore = name !== 'comment';
    }
    i = end;
  }
  return out;
}

// Replaces the text of a <code> element with highlighted spans (same text).
function highlightElement(el) {
  const fragment = document.createDocumentFragment();
  for (const { type, text } of tokenize(el.textContent)) {
    if (!type) {
      fragment.append(text);
      continue;
    }
    const span = document.createElement('span');
    span.className = `tok-${type}`;
    span.textContent = text;
    fragment.append(span);
  }
  el.replaceChildren(fragment);
}

export function highlightAll(root = document) {
  for (const el of root.querySelectorAll('pre > code[class*="language-"]')) highlightElement(el);
}
