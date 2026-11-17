// The whole video as a pure function of time: window.renderAt(t) sets every style from t (seconds).
// No CSS animations or transitions, no Date.now, no Math.random. render.mjs calls renderAt(t) for each
// frame and takes a screenshot. window.DATA (data.js) holds the real numbers from the build.
(() => {
  const D = window.DATA;
  const stage = document.getElementById('stage');

  // ---------------------------------------------------------------- helpers
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eOut = (p) => 1 - Math.pow(1 - p, 3);
  const eIn = (p) => p * p * p;
  const eInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const eBack = (p) => {
    const c1 = 1.2;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';

  function h(tag, parent, cls, css, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  // Only touch the DOM when a value changed.
  function set(e, opacity, transform) {
    const key = opacity + '|' + (transform || '');
    if (e._k === key) return;
    e._k = key;
    e.style.opacity = opacity;
    e.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible';
    if (transform != null) e.style.transform = transform;
  }
  function setHtml(e, html) {
    if (e._h !== html) {
      e._h = html;
      e.innerHTML = html;
    }
  }
  // segs = [[class, text], ...]; reveal the first n characters (typing effect).
  function reveal(segs, n) {
    let out = '';
    for (const [c, tx] of segs) {
      if (n <= 0) break;
      out += `<span class="${c}">${esc(tx.slice(0, n))}</span>`;
      n -= tx.length;
    }
    return out;
  }
  const segLen = (segs) => segs.reduce((n, s) => n + s[1].length, 0);
  const cursor = (t) => (Math.floor(t * 2) % 2 === 0 ? '<span class="cursor"></span>' : '');

  function flag(parent, code, w, h_, x, y) {
    const f = h('div', parent, 'flag', `width:${w}px;height:${h_}px;left:${x}px;top:${y}px`);
    f.innerHTML = `<svg aria-hidden="true"><use href="sprite.svg#flag-${code}"></use></svg>`;
    return f;
  }

  function panel(parent, x, y, w, hh, title) {
    const p = h('div', parent, 'panel', `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`);
    const bar = h('div', p, 'bar', null, title);
    for (let i = 0; i < 3; i++) h('i', bar, null, `left:${28 + i * 34}px`);
    const body = h(
      'div',
      p,
      null,
      `position:absolute;left:0;top:66px;right:0;bottom:0;overflow:hidden`,
    );
    return { p, body };
  }

  // A scroll list: slots rows, item j is "added" when x passes j; x is continuous.
  function makePool(parent, slots, rowH, fill) {
    const rows = [];
    for (let k = 0; k <= slots + 1; k++)
      rows.push(h('div', parent, 'row', `top:0;height:${rowH}px;line-height:${rowH}px`));
    return (x) => {
      const top = Math.floor(x);
      rows.forEach((r, k) => {
        const j = top - k;
        if (j < 0 || j >= D.files.length) {
          set(r, 0, '');
          return;
        }
        const slot = slots - 1 - (x - (j + 1));
        const alpha = clamp(1 - (slot - (slots - 1)), 0, 1) * clamp(slot + 1, 0, 1);
        fill(r, j);
        set(r, alpha, `translateY(${slot * rowH}px)`);
      });
    };
  }

  // ---------------------------------------------------------------- scenes
  const ch = D.chapters;
  // The scenes are timed on a 43-second source timeline (SRC: the start of each scene, then the end).
  // chapters.json gives where each scene starts in the final video; renderAt maps final time to source
  // time scene by scene, so a scene plays faster when its chapter is shorter.
  const SRC = [0, 4, 10, 17, 26, 34, 39, 43];
  const OUT = [...ch.map((c) => c.t), D.duration];
  if (SRC.length !== OUT.length)
    throw new Error('chapters.json and SRC disagree on the scene count');
  const toSource = (t) => {
    let i = 0;
    while (i < OUT.length - 2 && t >= OUT[i + 1]) i++;
    return SRC[i] + ((t - OUT[i]) / (OUT[i + 1] - OUT[i])) * (SRC[i + 1] - SRC[i]);
  };
  const scenes = ch.map((c, i) => ({
    a: SRC[i],
    b: SRC[i + 1],
    caption: c.caption,
    first: i === 0,
    last: i === ch.length - 1,
    root: h('div', stage, 'scene'),
  }));
  scenes.forEach((s) => {
    s.captionEl = null;
    if (s.caption) {
      const html = esc(s.caption).replace(/`([^`]+)`/g, '<code>$1</code>');
      s.captionEl = h('div', s.root, 'caption', null, html);
    }
  });

  const GRID = { x: 70, y: 190, cols: 19, cw: 54, ch: 44 };
  const gridPos = (i) => ({
    x: GRID.x + (i % GRID.cols) * GRID.cw,
    y: GRID.y + Math.floor(i / GRID.cols) * GRID.ch,
  });
  const files = D.files;
  const SIDE = { x: 1140, w: 710 };

  // ---- 1. Title
  const s1 = scenes[0];
  const title = h(
    'div',
    s1.root,
    'mono',
    'position:absolute;left:0;top:430px;width:1920px;text-align:left;box-sizing:border-box;padding-left:211px;font-size:104px;font-weight:700;white-space:pre;letter-spacing:-0.02em',
  );
  const titleSegs = [['n', D.pkg]];
  const bgFlags = [];
  for (let i = 0; i < 16; i++) {
    const code = D.order[[11, 0, 2, 18, 20, 22, 24, 28, 4, 12, 6, 8, 16, 26, 30, 1][i]];
    const x = 100 + (i % 8) * 220;
    const y = i < 8 ? 120 : 650;
    const f = flag(s1.root, code, 180, 120, x, y);
    bgFlags.push({ el: f, start: 0.3 + ((i * 5) % 16) * 0.16 });
  }
  title.style.zIndex = 2;

  // ---- 2. The problem
  const s2 = scenes[1];
  h(
    'div',
    s2.root,
    'mono',
    `position:absolute;left:${GRID.x}px;top:96px;font-size:52px;color:var(--muted)`,
    'flags/',
  );
  const cnt2 = h(
    'div',
    s2.root,
    null,
    'position:absolute;left:420px;top:90px;font-size:64px;font-weight:700;white-space:pre',
  );
  const tiles2 = files.map((f, i) => h('div', s2.root, 'tile', null, esc(f.code)));
  const net = panel(s2.root, SIDE.x, 90, SIDE.w, 716, 'Network');
  const netHead = h(
    'div',
    net.body,
    null,
    'position:absolute;left:0;top:0;right:0;height:56px;border-bottom:2px solid var(--border);padding:0 24px;box-sizing:border-box;font-size:30px;line-height:56px;font-weight:700;color:var(--red)',
  );
  const netBody = h(
    'div',
    net.body,
    null,
    'position:absolute;left:0;top:58px;right:0;height:640px;overflow:hidden',
  );
  const NET_SLOTS = 16;
  const netPool = makePool(netBody, NET_SLOTS, 40, (r, j) => {
    if (r._j === j) return;
    r._j = j;
    r.innerHTML = `<span style="position:absolute;left:24px">${esc(files[j].code)}.svg</span><span style="position:absolute;left:300px;color:var(--green)">200</span><span style="position:absolute;right:24px;color:var(--muted)">${(files[j].bytes / 1024).toFixed(1)} KB</span>`;
  });

  // ---- 3. Import
  const s3 = scenes[2];
  const code3 = panel(s3.root, 200, 130, 1520, 700, 'app.js');
  const imp = [
    ['k', 'import'],
    ['n', ' jp '],
    ['k', 'from'],
    ['n', ' '],
    ['s', "'@flags/JP.svg'"],
    ['n', ';'],
  ];
  const R = D.importResult;
  const objLines = [
    [['n', '{']],
    [
      ['n', '  '],
      ['p', 'id'],
      ['n', ': '],
      ['s', JSON.stringify(R.id)],
      ['n', ','],
    ],
    [
      ['n', '  '],
      ['p', 'viewBox'],
      ['n', ': '],
      ['s', JSON.stringify(R.viewBox)],
      ['n', ','],
    ],
    [
      ['n', '  '],
      ['p', 'url'],
      ['n', ': '],
      ['s', JSON.stringify(R.url)],
      ['n', ','],
    ],
    [['n', '}']],
  ];
  const LH3 = 74;
  const mkLine = (parent, i, extra) =>
    h(
      'div',
      parent,
      'mono',
      `position:absolute;left:56px;top:${36 + i * LH3}px;font-size:46px;line-height:${LH3}px;white-space:pre;${extra || ''}`,
    );
  const impEl = mkLine(code3.body, 0);
  const cmtEl = mkLine(code3.body, 2);
  setHtml(cmtEl, '<span class="c">// jp is the result of the import:</span>');
  const objEls = objLines.map((segs, i) => {
    const e = mkLine(code3.body, 3 + i);
    e.innerHTML = reveal(segs, 999);
    return e;
  });

  // ---- 4. Build
  const s4 = scenes[3];
  const tiles4 = files.map((f) => h('div', s4.root, 'tile', null, esc(f.code)));
  const files265 = h(
    'div',
    s4.root,
    null,
    `position:absolute;left:${GRID.x}px;top:90px;font-size:64px;font-weight:700;white-space:pre`,
  );
  const box = panel(s4.root, SIDE.x, 90, SIDE.w, 640, 'sprite.svg');
  const boxBody = h(
    'div',
    box.body,
    null,
    'position:absolute;left:0;top:12px;right:0;height:560px;overflow:hidden',
  );
  const BOX_SLOTS = 15;
  const symPool = makePool(boxBody, BOX_SLOTS, 36, (r, j) => {
    if (r._j === j) return;
    r._j = j;
    const sym = D.sprite.symbols.find((x) => x.includes(`id="flag-${files[j].code}"`));
    const id = /id="([^"]+)"/.exec(sym)[1];
    const vb = /viewBox="([^"]+)"/.exec(sym)[1];
    r.style.fontSize = '22px';
    r.innerHTML = `<span class="t">&lt;symbol</span> <span class="p">id</span>=<span class="s">"${esc(id)}"</span> <span class="p">viewBox</span>=<span class="s">"${esc(vb)}"</span><span class="t">&gt;</span>`;
  });
  const statRows = [
    ['265 files', kb(D.filesTotalBytes), 'var(--muted)'],
    ['1 sprite.svg', kb(D.sprite.bytes), 'var(--text)'],
    ['gzipped', kb(D.sprite.gzipBytes), 'var(--green)'],
  ].map(([label, val, color], i) =>
    h(
      'div',
      s4.root,
      null,
      `position:absolute;left:${GRID.x + 60}px;top:${330 + i * 120}px;width:880px;font-size:64px;line-height:100px;color:${color};white-space:pre`,
      `<span style="font-weight:500">${label}</span><span style="position:absolute;right:0;font-weight:700">${val}</span>`,
    ),
  );

  // ---- 5. Use
  const s5 = scenes[4];
  const useCode = panel(s5.root, 80, 200, 940, 400, 'index.html');
  const useSegs = [
    [[['t', '<svg>']]],
    [
      [
        ['n', '  '],
        ['t', '<use'],
        ['n', ' '],
        ['p', 'href'],
        ['n', '='],
        ['s', `"sprite.svg#flag-JP"`],
        ['t', ' />'],
      ],
    ],
    [[['t', '</svg>']]],
  ].map((x) => x[0]);
  const useEls = useSegs.map((segs, i) =>
    h(
      'div',
      useCode.body,
      'mono',
      `position:absolute;left:44px;top:${28 + i * 84}px;font-size:40px;line-height:84px;white-space:pre`,
    ),
  );
  const bigFlag = flag(s5.root, 'JP', 780, 520, 1060, 160);
  bigFlag.style.borderRadius = '18px';
  bigFlag.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.14), 0 30px 80px rgba(0,0,0,0.5)';
  const WALL = { cols: 23, x: 90, y: 190, px: 1740 / 23, py: 56, w: 70, h: 46 };
  const wall = D.order.map((code, i) => {
    const x = WALL.x + (i % WALL.cols) * WALL.px;
    const y = WALL.y + Math.floor(i / WALL.cols) * WALL.py;
    const f = flag(s5.root, code, WALL.w, WALL.h, x, y);
    f.style.borderRadius = '5px';
    return { el: f, x, y };
  });
  const badge = h(
    'div',
    s5.root,
    'pill',
    'left:90px;top:58px;height:90px;padding:0 44px;background:rgba(63,185,80,0.16);border:3px solid var(--green);color:var(--green);font-size:52px;line-height:84px;white-space:pre',
    '1 request',
  );
  const reqRow = h(
    'div',
    s5.root,
    'mono',
    'position:absolute;left:480px;top:70px;font-size:34px;line-height:66px;white-space:pre;color:var(--muted)',
    `sprite.svg   <span style="color:var(--green)">200</span>   ${kb(D.sprite.gzipBytes)} gzipped`,
  );

  // ---- 6. Migrate
  const s6 = scenes[5];
  const mig = panel(s6.root, 140, 130, 1640, 610, 'rspack.config.js');
  const migLines = [
    [
      '-',
      [
        ['k', 'const'],
        ['n', ' SpriteLoaderPlugin = '],
        ['f', 'require'],
        ['n', '('],
        ['s', "'svg-sprite-loader/plugin'"],
        ['n', ');'],
      ],
    ],
    [
      '+',
      [
        ['k', 'const'],
        ['n', ' { SvgSpritePlugin } = '],
        ['f', 'require'],
        ['n', '('],
        ['s', `'${D.pkg}'`],
        ['n', ');'],
      ],
    ],
    [
      ' ',
      [
        ['n', '    '],
        ['p', 'test'],
        ['n', ': '],
        ['s', '/\\.svg$/'],
        ['n', ','],
      ],
    ],
    [
      '-',
      [
        ['n', '    '],
        ['p', 'loader'],
        ['n', ': '],
        ['s', "'svg-sprite-loader'"],
        ['n', ','],
      ],
    ],
    [
      '+',
      [
        ['n', '    '],
        ['p', 'loader'],
        ['n', ': '],
        ['s', `'${D.loader}'`],
        ['n', ','],
      ],
    ],
    [
      '-',
      [
        ['n', '    '],
        ['k', 'new'],
        ['n', ' '],
        ['f', 'SpriteLoaderPlugin'],
        ['n', '(),'],
      ],
    ],
    [
      '+',
      [
        ['n', '    '],
        ['k', 'new'],
        ['n', ' '],
        ['f', 'SvgSpritePlugin'],
        ['n', '(),'],
      ],
    ],
  ];
  const MLH = 70;
  const migEls = migLines.map(([sign, segs], i) => {
    const color =
      sign === '-' ? 'rgba(248,81,73,0.16)' : sign === '+' ? 'rgba(63,185,80,0.16)' : 'transparent';
    const row = h(
      'div',
      mig.body,
      null,
      `position:absolute;left:0;right:0;top:${30 + i * MLH}px;height:${MLH}px;background:${color}`,
    );
    const sg = h(
      'div',
      row,
      'mono',
      `position:absolute;left:24px;top:0;font-size:38px;line-height:${MLH}px;width:40px;color:${sign === '-' ? 'var(--red)' : 'var(--green)'}`,
      sign === ' ' ? '' : sign,
    );
    const tx = h(
      'div',
      row,
      'mono',
      `position:absolute;left:76px;top:0;font-size:36px;line-height:${MLH}px;white-space:pre`,
      reveal(segs, 999),
    );
    return { row, sg, tx };
  });

  // ---- 7. Install
  const s7 = scenes[6];
  const endFlags = [];
  const endCodes = ['JP', 'DE', 'BR', 'US', 'IN', 'FR', 'GB', 'KR', 'CA'];
  endCodes.forEach((code, i) => {
    const x = 165 + i * 180;
    const f = flag(s7.root, code, 150, 100, x, 150);
    f.style.borderRadius = '10px';
    endFlags.push({ el: f, x });
  });
  const inst = panel(s7.root, 140, 380, 1640, 190, '');
  inst.p.firstChild.style.display = 'none';
  inst.body.style.top = '0';
  const instEl = h(
    'div',
    inst.body,
    'mono',
    'position:absolute;left:52px;top:0;font-size:62px;line-height:188px;white-space:pre',
  );
  const installSegs = [
    ['c', '$ '],
    ['f', 'npm'],
    ['n', ' install '],
    ['p', '-D'],
    ['n', ' ' + D.pkg],
  ];
  const docsEl = h(
    'div',
    s7.root,
    'mono',
    'position:absolute;left:0;top:660px;width:1920px;text-align:center;font-size:44px;color:var(--blue)',
    esc(D.docs),
  );
  const tagsEl = h(
    'div',
    s7.root,
    null,
    'position:absolute;left:0;top:760px;width:1920px;text-align:center;font-size:44px;font-weight:600;color:var(--muted)',
    'Rspack  ·  Rsbuild  ·  webpack 5',
  );

  // ---------------------------------------------------------------- per-frame drawing
  function drawScene1(t, lt) {
    const typed = Math.floor(prog(lt, 0.2, 1.1) * D.pkg.length);
    setHtml(
      title,
      reveal(titleSegs, typed) +
        (typed < D.pkg.length || lt < 2.4 ? cursor(t) : '') +
        `<span style="visibility:hidden">${esc(D.pkg.slice(typed))}</span>`,
    );
    bgFlags.forEach((b, i) => {
      const p = eOut(prog(lt, b.start, b.start + 0.7));
      const settle = lerp(1, 0.6, eInOut(prog(lt, b.start + 0.7, b.start + 1.8)));
      set(b.el, 0.85 * p * settle, `translateY(${(1 - p) * 24}px) scale(${0.9 + 0.1 * p})`);
    });
  }

  function drawScene2(t, lt) {
    let landed = 0;
    tiles2.forEach((el, i) => {
      const a = 0.3 + i * 0.0085;
      const p = eOut(prog(lt, a, a + 0.8));
      if (prog(lt, a, a + 0.8) >= 1) landed++;
      const g = gridPos(i);
      const x = lerp(GRID.x + 40, g.x, p);
      const y = lerp(100, g.y, p) - Math.sin(Math.PI * p) * 36;
      set(el, clamp(p * 5), `translate(${x}px,${y}px) scale(${lerp(0.5, 1, p)})`);
    });
    setHtml(cnt2, `${landed} <span style="color:var(--muted);font-weight:500">files</span>`);
    const x = 265 * eInOut(prog(lt, 2.4, 5.4));
    netPool(x);
    const reqs = Math.floor(x);
    setHtml(netHead, `${reqs} <span style="font-weight:500">requests</span>`);
  }

  function drawScene3(t, lt) {
    const total = segLen(imp);
    const typed = Math.floor(prog(lt, 0.5, 2.6) * total);
    setHtml(impEl, reveal(imp, typed) + (lt < 3.4 ? cursor(t) : ''));
    set(cmtEl, eOut(prog(lt, 3.1, 3.7)), `translateY(${(1 - eOut(prog(lt, 3.1, 3.7))) * 14}px)`);
    objEls.forEach((e, i) => {
      const a = 3.7 + i * 0.7;
      const p = eOut(prog(lt, a, a + 0.6));
      set(e, p, `translateX(${(1 - p) * 40}px)`);
    });
  }

  function drawScene4(t, lt) {
    let landed = 0;
    tiles4.forEach((el, i) => {
      const a = 0.5 + i * 0.0105;
      const raw = prog(lt, a, a + 0.9);
      const p = eInOut(raw);
      if (raw >= 1) landed++;
      const g = gridPos(i);
      const tx = SIDE.x + SIDE.w / 2 - 24;
      const ty = 90 + 320;
      const x = lerp(g.x, tx, p);
      const y = lerp(g.y, ty, p);
      set(
        el,
        raw >= 1 ? 0 : 1 - eIn(prog(raw, 0.75, 1)) * 0.9,
        `translate(${x}px,${y}px) scale(${lerp(1, 0.35, p)})`,
      );
    });
    const a1 = prog(lt, 3.6, 4.3);
    setHtml(
      files265,
      `<span style="opacity:${lerp(1, 0.55, eOut(a1))}">${D.files.length} files</span><span style="color:var(--muted);font-weight:500">  →  </span><span style="color:var(--blue);opacity:${eOut(a1)}">1 file</span>`,
    );
    symPool(landed);
    statRows.forEach((e, i) => {
      const sp = eOut(prog(lt, 4.3 + i * 0.5, 4.9 + i * 0.5));
      set(e, sp, `translateY(${(1 - sp) * 18}px)`);
    });
  }

  function drawScene5(t, lt) {
    // Part A: the code and one flag.
    const partA = 1 - eInOut(prog(lt, 3.5, 4.1));
    const mid = prog(lt, 0.4, 0.8);
    set(useCode.p, eOut(mid) * partA, `translateX(${-(1 - partA) * 60}px)`);
    useEls.forEach((e, i) => {
      const total = segLen(useSegs[i]);
      const typed = Math.floor(prog(lt, 0.4 + i * 0.3, 0.9 + i * 0.3) * total);
      setHtml(e, reveal(useSegs[i], typed));
    });
    const fp = eOut(prog(lt, 1.1, 1.6));
    set(
      bigFlag,
      clamp(prog(lt, 1.1, 1.5)) * partA,
      `scale(${lerp(0.94, 1, fp) * (0.96 + 0.04 * partA)})`,
    );
    // Part B: the wall.
    wall.forEach((w, i) => {
      const a = 4.0 + i * 0.007;
      const raw = prog(lt, a, a + 0.5);
      const p = eBack(raw);
      set(w.el, clamp(raw * 3), `scale(${lerp(0.6, 1, p)})`);
    });
    const bp = eOut(prog(lt, 4.4, 5.1));
    set(badge, bp, `translateY(${(1 - bp) * -16}px) scale(${lerp(0.94, 1, bp)})`);
    set(reqRow, eOut(prog(lt, 4.9, 5.5)), 'translateY(0px)');
  }

  function drawScene6(t, lt) {
    const order = [0, 1, 2, 3, 4, 5, 6];
    const starts = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1];
    set(mig.p, eOut(prog(lt, 0, 0.5)), `translateY(${(1 - eOut(prog(lt, 0, 0.5))) * 24}px)`);
    order.forEach((i) => {
      const p = eOut(prog(lt, starts[i], starts[i] + 0.5));
      set(migEls[i].row, p, `translateX(${(1 - p) * 40}px)`);
    });
  }

  function drawScene7(t, lt) {
    endFlags.forEach((f, i) => {
      const p = eOut(prog(lt, 0.1 + i * 0.08, 0.7 + i * 0.08));
      set(f.el, p, `translateY(${(1 - p) * 20}px)`);
    });
    const ip = eOut(prog(lt, 0.2, 0.7));
    set(inst.p, ip, `translateY(${(1 - ip) * 24}px)`);
    const total = segLen(installSegs);
    const typed = Math.floor(prog(lt, 0.7, 2.2) * total);
    setHtml(instEl, reveal(installSegs, typed) + (typed < total || lt < 3.0 ? cursor(t) : ''));
    const dp = eOut(prog(lt, 2.3, 2.9));
    set(docsEl, dp, `translateY(${(1 - dp) * 14}px)`);
    const tp = eOut(prog(lt, 2.6, 3.2));
    set(tagsEl, tp, `translateY(${(1 - tp) * 14}px)`);
  }

  const drawers = [
    drawScene1,
    drawScene2,
    drawScene3,
    drawScene4,
    drawScene5,
    drawScene6,
    drawScene7,
  ];

  window.renderAt = (time) => {
    const t = toSource(time);
    scenes.forEach((s, i) => {
      const lt = t - s.a;
      const fadeIn = s.first ? 1 : eInOut(prog(t, s.a - 0.3, s.a + 0.3));
      const fadeOut = s.last ? 1 : 1 - eInOut(prog(t, s.b - 0.3, s.b + 0.3));
      const o = fadeIn * fadeOut;
      const visible = o > 0.001;
      s.root.style.display = visible ? 'block' : 'none';
      if (!visible) return;
      s.root.style.opacity = o;
      drawers[i](t, lt);
      if (s.captionEl) {
        const cp = eOut(prog(lt, 0.35, 1.0));
        s.captionEl.style.opacity = cp;
        s.captionEl.style.transform = `translateY(${(1 - cp) * 18}px)`;
      }
    });
  };
  window.DURATION = D.duration;
  window.renderAt(0);
})();
