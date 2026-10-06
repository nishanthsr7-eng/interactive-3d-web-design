/**
 * The sketchbook — a real page-turning book of VINCI's work, sitting where the
 * hero house scrolls out (see the `#sketchbook` trigger in main.js).
 *
 * The turning leaf is not a flat panel on a hinge. It is a chain of nested
 * strips whose tangent sweeps through an arc, so the surface curves along its
 * width and the paper bends instead of pivoting like a door. Each strip
 * carries a front and back face with `backface-visibility` doing the flip,
 * plus a shading gradient and a specular wash that track the leaf's angle to
 * the light. The loupe holds a second copy of the book, scaled about whichever
 * page point sits under the glass and masked to a circle; that copy lives
 * outside the tilt transform, so leaning the book never drags the glass with
 * it, and it fades out as the glass wanders off the paper.
 *
 * Spreads are not pre-rendered PNGs of an open book. They are ordinary
 * landscape renders in mixed aspect ratios, with written notes facing them,
 * so every page is composited to a canvas at
 * boot — uniform page size, real Inter typography, one image per left page and
 * its note opposite. Everything downstream sees a plain image URL per page and
 * is unchanged.
 *
 * To swap content: edit SPREADS below. Images live in assets/sketchbook/.
 */

import { ScrollTrigger } from '../core/scroll.js';

/* ── Content ───────────────────────────────────────────────────────────── */

const DIR = 'assets/sketchbook/';
const SPREADS = [
  {
    img: 'project-1.jpeg',
    title: 'Concept to envelope',
    place: 'Massing study',
    note: 'The drawing and the building are the same object seen twice. We resolve the envelope in three dimensions first, so the thing that gets built is the thing that was agreed.',
  },
  {
    img: 'project-2.jpeg',
    title: 'Street to skyline',
    place: 'Context fit',
    note: 'A house answers to its street before it answers to anything else. Setbacks, sightlines and the roofline of the neighbour are drawn in before the first internal wall is placed.',
  },
  {
    img: 'project-3.jpeg',
    title: 'Systems in section',
    place: 'Assembly detail',
    note: 'Roof build-up, ventilation cavity, insulation line, fixing detail. Every layer is specified and costed at drawing stage, which is why the programme holds on site.',
  },
  {
    img: 'project-4.jpeg',
    title: 'Ground and canopy',
    place: 'Site strategy',
    note: 'Where the slab meets the earth, and where the roof breaks the sun. The plan below the building is drawn with the same care as the elevation above it.',
  },
  {
    img: 'project-5.jpeg',
    title: 'Structure exposed',
    place: 'Frame study',
    note: 'Column grid, transfer beams, cantilever depth. Signed off by a licensed structural engineer before anything is poured — no retrofitted fixes, no surprises at inspection.',
  },
  {
    img: 'project-6.jpeg',
    title: 'Volume in line',
    place: 'Form study',
    note: 'Stacked terraces, deep reveals, a glazed corner held by steel. Massing is tested as line work long before it is tested as concrete.',
  },
  {
    img: 'project-7.jpeg',
    title: 'Layered assembly',
    place: 'Exploded build-up',
    note: 'Foundation, floor plate, frame, envelope, roof. Pulling the building apart on paper is how we find the clashes that would otherwise be found by a mason on a Tuesday.',
  },
  {
    img: 'project-8.jpeg',
    title: 'Skin and frame',
    place: 'Facade system',
    note: 'Masonry against glass, timber against steel. The facade is detailed as a system of joints, because that is where buildings actually fail.',
  },
];
SPREADS.forEach((s) => (s.url = DIR + s.img));

/* ── Geometry ──────────────────────────────────────────────────────────── */

/* Album proportions: each page is landscape (1.4:1), so the open spread is
   2.8:1 — wide and low, the shape of a bound photographic album rather than
   the portrait sketchbook this started as. .sb-book's aspect-ratio in
   main.css is 2*PAGE_W / PAGE_H and has to move with these. */
const PAGE_W = 1300; // composited page, device pixels
const PAGE_H = 930;
const N = 18; // strips — enough for a smooth curve
const SPAN = 0.5; // gutter -> outer page edge, as a fraction of book width
const BETA = 0.6; // peak curl of the arc, radians
const LAND = 0; // page the opening riffle settles on
const MAG = 2.3; // loupe magnification
const TILT_X = 4.5; // degrees — deliberately restrained
const TILT_Y = 7;
const ZOOM_MIN = 0.9;
const ZOOM_MAX = 1.5;
const SHEETS = 7; // sheets drawn per side to stand in for the page block
/* How far the vanishing point tracks the cursor, in % of the stage. This is
   the viewer moving their head, not the book turning — small numbers here do
   far more for the sense of a solid object than a bigger lean would. */
const ORIGIN_X = 9;
const ORIGIN_Y = 6;

/* Paper and ink, matched to the .sketchbook block in main.css */
const PAPER_TOP = '#f2ede2';
const PAPER_BOT = '#e4ddce';
const EARTH = '#9a6a3e';
const INK = '#2b2721';
const INK_SOFT = 'rgba(43,39,33,0.58)';
const INK_FAINT = 'rgba(43,39,33,0.36)';
const DISPLAY = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const BODY = "'Newsreader', Georgia, 'Times New Roman', serif";

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSketchbook() {
  const wrap = document.getElementById('sbWrap');
  const stage = document.getElementById('sbStage');
  const sb3d = document.getElementById('sb3d');
  const book = document.getElementById('sbBook');
  const capBox = document.getElementById('sbCaptions');
  const hint = document.getElementById('sbHint');
  if (!wrap || !book) return;

  const PAGES = []; // {left,right} object URLs, filled by buildPages()
  const M = SPREADS.length;
  let ready = false;
  let idx = 0;
  let turn = null; // {dir, from, to, t}
  let strips = [];

  const el = (t, c) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    return e;
  };

  /* ── Page compositing ───────────────────────────────────────────────── */

  /* Laid paper, drawn rather than tiled — an image would either repeat
     visibly across a 1300px page or cost more than the whole rest of the
     section. Four passes, coarse to fine, because that is the order the eye
     reads them in: blotchy pulp tone, then the mould's laid and chain lines,
     then the rag fibres lying in the sheet, then a last dusting of specks so
     nothing is perfectly smooth under the magnifier. */
  function laidPaper(ctx) {
    // 1. Mottle — uneven pulp density, the thing that stops it reading flat.
    for (let n = 0; n < 60; n++) {
      const x = Math.random() * PAGE_W;
      const y = Math.random() * PAGE_H;
      const r = 90 + Math.random() * 230;
      const warm = Math.random() > 0.45;
      const a = 0.012 + Math.random() * 0.022;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, warm ? `rgba(150,124,86,${a})` : `rgba(255,253,246,${a * 1.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // 2. The mould's wires: close laid lines, and chain lines further apart.
    ctx.fillStyle = 'rgba(108,90,64,0.030)';
    for (let y = 0; y < PAGE_H; y += 9) ctx.fillRect(0, y, PAGE_W, 1);
    ctx.fillStyle = 'rgba(255,252,244,0.05)';
    for (let x = 22; x < PAGE_W; x += 96) ctx.fillRect(x, 0, 1, PAGE_H);

    // 3. Rag fibres — short strokes lying nearly flat in the sheet.
    for (let n = 0; n < 1500; n++) {
      const x = Math.random() * PAGE_W;
      const y = Math.random() * PAGE_H;
      const len = 4 + Math.random() * 16;
      const ang = (Math.random() - 0.5) * 0.5; // mostly with the grain
      const a = 0.018 + Math.random() * 0.042;
      ctx.strokeStyle =
        Math.random() > 0.5 ? `rgba(126,106,76,${a})` : `rgba(255,253,247,${a * 1.35})`;
      ctx.lineWidth = Math.random() > 0.82 ? 1.6 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }

    // 4. Specks, for the loupe to find.
    for (let n = 0; n < 3200; n++) {
      const a = Math.random() * 0.05;
      ctx.fillStyle =
        Math.random() > 0.5 ? `rgba(120,102,74,${a})` : `rgba(255,252,244,${a * 1.4})`;
      ctx.fillRect(Math.random() * PAGE_W, Math.random() * PAGE_H, 2, 2);
    }
  }

  function paperBase(ctx, gutterSide) {
    const g = ctx.createLinearGradient(0, 0, 0, PAGE_H);
    g.addColorStop(0, PAPER_TOP);
    g.addColorStop(1, PAPER_BOT);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    laidPaper(ctx);

    // The fold falls away into shadow near the gutter.
    const w = PAGE_W * 0.13;
    const gg =
      gutterSide === 'right'
        ? ctx.createLinearGradient(PAGE_W - w, 0, PAGE_W, 0)
        : ctx.createLinearGradient(w, 0, 0, 0);
    gg.addColorStop(0, 'rgba(76,56,30,0)');
    gg.addColorStop(0.62, 'rgba(76,56,30,0.10)');
    gg.addColorStop(1, 'rgba(58,42,22,0.42)');
    ctx.fillStyle = gg;
    ctx.fillRect(gutterSide === 'right' ? PAGE_W - w : 0, 0, w, PAGE_H);

    // A hairline where the sheet is cut, opposite the fold.
    ctx.fillStyle = 'rgba(120,100,70,0.22)';
    ctx.fillRect(gutterSide === 'right' ? 0 : PAGE_W - 1, 0, 1, PAGE_H);
  }

  function plateMark(ctx, i, x, y) {
    ctx.fillStyle = EARTH;
    ctx.font = `400 34px ${BODY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
    ctx.fillText(String(i + 1).padStart(2, '0'), x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.fillStyle = 'rgba(43,39,33,0.16)';
    ctx.fillRect(x, y + 24, 104, 1);
  }

  function wrapLines(ctx, text, maxW) {
    const out = [];
    let line = '';
    for (const word of text.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(t).width > maxW) {
        out.push(line);
        line = word;
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  /** Left page: the render, laid on the sheet like a print with a deckle border. */
  function drawImagePage(img, i) {
    const c = document.createElement('canvas');
    c.width = PAGE_W;
    c.height = PAGE_H;
    const ctx = c.getContext('2d');
    paperBase(ctx, 'right');

    const m = Math.round(PAGE_W * 0.062);
    plateMark(ctx, i, m, 68);

    /* Fixed landscape frame, so pages stay uniform across mixed source ratios.
       On an album page the print runs nearly the full measure and the sheet
       reads as a mount: a thin band of paper above for the plate number, a
       wider one below for the caption. */
    const fw = PAGE_W - m * 2;
    const fh = Math.round(fw / 1.72);
    const fx = m;
    const fy = 118;
    const b = 12; // the print's own white border

    // the print lifts a little off the page
    ctx.save();
    ctx.shadowColor = 'rgba(58,44,26,0.34)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 9;
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(fx - b, fy - b, fw + b * 2, fh + b * 2);
    ctx.restore();

    // cover-crop
    const scale = Math.max(fw / img.width, fh / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    ctx.drawImage(img, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
    // warm the print into the page rather than leaving it a cold rectangle
    ctx.fillStyle = 'rgba(154,106,62,0.10)';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.restore();

    ctx.strokeStyle = 'rgba(43,39,33,0.20)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 27px ${BODY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.2em';
    ctx.fillText(SPREADS[i].place.toUpperCase(), m, fy + fh + b + 52);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    return c;
  }

  /** Right page: the note facing it. */
  function drawTextPage(i) {
    const s = SPREADS[i];
    const c = document.createElement('canvas');
    c.width = PAGE_W;
    c.height = PAGE_H;
    const ctx = c.getContext('2d');
    paperBase(ctx, 'left');

    /* The page is now wider than it is tall, so the full measure would run to
       a ~90-character line. Cap the column and centre it, mirroring the way
       the facing print is inset equally on its own page — otherwise the note
       hangs off the gutter with a third of the sheet blank to its right. */
    const maxW = Math.min(Math.round(PAGE_W * 0.8), 780);
    const m = Math.round((PAGE_W - maxW) / 2);

    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 26px ${BODY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.2em';
    ctx.fillText(`PLATE ${String(i + 1).padStart(2, '0')} / ${String(M).padStart(2, '0')}`, m, 104);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    let y = 292;
    ctx.fillStyle = INK;
    ctx.font = `400 86px ${DISPLAY}`;
    for (const line of wrapLines(ctx, s.title, maxW)) {
      ctx.fillText(line, m, y);
      y += 92;
    }

    y += 26;
    ctx.fillStyle = 'rgba(154,106,62,0.75)';
    ctx.fillRect(m, y, 84, 1);
    y += 72;

    ctx.fillStyle = INK_SOFT;
    ctx.font = `300 33px ${BODY}`;
    for (const line of wrapLines(ctx, s.note, maxW)) {
      ctx.fillText(line, m, y);
      y += 51;
    }

    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 24px ${BODY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.3em';
    ctx.fillText('VINCI BUILDERS', m, PAGE_H - 82);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    return c;
  }

  const toURL = (canvas, type, q) =>
    new Promise((res) => canvas.toBlob((b) => res(URL.createObjectURL(b)), type, q));

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
  }

  async function buildPages() {
    /* The title face is only ever drawn into canvas, so nothing in the DOM
       requests it and fonts.ready would resolve without it. Ask by name. */
    if (document.fonts) {
      await Promise.all([
        document.fonts.load("400 76px 'Instrument Serif'"),
        document.fonts.load("300 29px 'Newsreader'"),
        document.fonts.load("400 23px 'Newsreader'"),
      ]).catch(() => {});
      await document.fonts.ready.catch(() => {});
    }
    for (let i = 0; i < M; i++) {
      let left;
      try {
        left = await toURL(drawImagePage(await loadImage(SPREADS[i].url), i), 'image/jpeg', 0.88);
      } catch {
        left = await toURL(drawTextPage(i), 'image/jpeg', 0.88); // missing art — still turns
      }
      const right = await toURL(drawTextPage(i), 'image/jpeg', 0.88);
      PAGES[i] = { left, right };
    }
    ready = true;
    paint();
    restLoupe();
    syncZoom();
  }

  /* ── The page block ─────────────────────────────────────────────────── */

  /* Built once and left alone: these live beside .sb-book, not inside it, so
     paint()'s teardown never touches them and the loupe's page copy — which
     clones only .sb-book's children — never picks them up. */
  function buildStacks() {
    const tilt = document.getElementById('sbTilt');
    if (!tilt) return;
    for (const side of ['left', 'right']) {
      const st = el('div', `sb-stack sb-stack--${side}`);
      st.setAttribute('aria-hidden', 'true');
      for (let k = 0; k < SHEETS; k++) {
        const sheet = el('i', 'sb-sheet');
        sheet.style.setProperty('--k', k);
        st.appendChild(sheet);
      }
      tilt.insertBefore(st, book);
    }
  }

  /* How much of the album is lying on each side. Never quite zero — even the
     first spread has a cover's worth of paper under it. */
  function stackDepth() {
    const cur = turn ? turn.to : idx;
    const p = M > 1 ? cur / (M - 1) : 0.5;
    const f = (v) => (0.12 + v * 0.88).toFixed(3);
    sb3d.style.setProperty('--th-l', f(p));
    sb3d.style.setProperty('--th-r', f(1 - p));
  }

  function halfEl(pos, i) {
    const d = el('div', `sb-half ${pos}`);
    const im = new Image();
    im.className = 'sb-half-img';
    im.draggable = false;
    im.alt = pos === 'left' ? SPREADS[i].title : '';
    im.src = PAGES[i][pos];
    d.appendChild(im);
    d.appendChild(el('div', `gutter-shade ${pos}`));
    return d;
  }

  /* The strip chain, built once per turn; background offsets are pure
     geometry, so they never need touching again while it animates. */
  function buildCurl(dir, from, to) {
    strips = [];
    const c = el('div', `curl ${dir}`);
    c.style.setProperty('--n', N);
    c.style.setProperty('--span', SPAN);
    let host = c;

    const sw = `calc(var(--bw) * ${SPAN} / ${N})`;
    const pw = `calc(var(--bw) * ${SPAN})`;

    for (let i = 0; i < N; i++) {
      const s = el('div', 'strip');
      s.style.setProperty('--i', i);
      const A = `calc(-1 * (${i} * ${sw}))`; // faces the from-page
      const B = `calc(${i + 1} * ${sw} - ${pw})`; // faces the to-page
      const f = el('div', 'face front');
      const b = el('div', 'face back');
      const dress = (e, url, px) => {
        e.style.backgroundImage = `url(${url})`;
        e.style.backgroundPositionX = px;
      };
      const next = dir === 'next';
      dress(f, PAGES[from][next ? 'right' : 'left'], next ? A : B);
      dress(b, PAGES[to][next ? 'left' : 'right'], next ? B : A);
      f.appendChild(el('div', 'sh'));
      f.appendChild(el('div', 'gl'));
      b.appendChild(el('div', 'sh'));
      b.appendChild(el('div', 'gl'));
      s.appendChild(f);
      s.appendChild(b);
      if (i === N - 1) s.classList.add('edge');
      host.appendChild(s);
      host = s;
      strips.push(s);
    }
    return c;
  }

  function applyTurn(t) {
    const th = Math.PI * t; // how far the leaf has swung
    const beta = BETA * Math.sin(Math.PI * t); // it is flat at both ends
    const D = 180 / Math.PI;
    const tt = th + beta;
    const td = (2 * beta) / N;
    sb3d.style.setProperty('--tt', `${(tt * D).toFixed(2)}deg`);
    sb3d.style.setProperty('--td', `${(td * D).toFixed(3)}deg`);
    sb3d.style.setProperty('--shade', Math.sin(Math.PI * t).toFixed(3));
    fadeCaption(t);
    for (let i = 0; i < strips.length; i++) {
      const l1 = Math.abs(Math.cos(tt - i * td)); // facing, near edge
      const l2 = Math.abs(Math.cos(tt - (i + 1) * td)); // ...and far edge
      const st = strips[i].style;
      st.setProperty('--lit', l1.toFixed(3));
      st.setProperty('--a1', ((1 - l1) * 0.62).toFixed(3));
      st.setProperty('--a2', ((1 - l2) * 0.62).toFixed(3));
    }
  }

  function paint() {
    book.textContent = '';
    if (!ready) return;
    if (!turn) {
      book.appendChild(halfEl('left', idx));
      book.appendChild(halfEl('right', idx));
      sb3d.style.setProperty('--shade', '0');
    } else {
      const next = turn.dir === 'next';
      book.appendChild(halfEl('left', next ? turn.from : turn.to));
      book.appendChild(halfEl('right', next ? turn.to : turn.from));
      book.appendChild(buildCurl(turn.dir, turn.from, turn.to));
      applyTurn(turn.t);
    }
    const a = el('button', 'sb-zone sb-prev');
    const b = el('button', 'sb-zone sb-next');
    a.type = b.type = 'button';
    a.setAttribute('aria-label', 'previous page');
    b.setAttribute('aria-label', 'next page');
    book.appendChild(a);
    book.appendChild(b);
    stackDepth();
    layout();
    // The opening riffle flicks through every spread in well under a second —
    // captions and the loupe/zoom layer are unreadable at that speed anyway,
    // and syncZoomLayer() in particular clones the curl's ~100+ DOM nodes a
    // second time on every single step. Skipping all three here removes most
    // of the per-step render cost that made the riffle stutter; the final
    // settle (endIntro's own non-intro paint()) still runs them normally.
    if (!introOn) {
      caption();
      marks();
      syncZoomLayer();
      placeLoupe();
    }
  }

  /* ── Captions ───────────────────────────────────────────────────────── */

  let capOut = null,
    capIn = null;

  function caption() {
    capBox.textContent = '';
    capOut = capIn = null;
    if (turn) {
      capOut = el('p', 'sb-caption live');
      capOut.textContent = SPREADS[turn.from].title;
      capBox.appendChild(capOut);
      capIn = el('p', 'sb-caption live');
      capIn.textContent = SPREADS[turn.to].title;
      capBox.appendChild(capIn);
      fadeCaption(turn.t);
    } else {
      const p = el('p', 'sb-caption');
      p.textContent = SPREADS[idx].title;
      capBox.appendChild(p);
    }
  }

  /* The old title is gone before the new one arrives, so they never sit on
     top of each other mid-drag. */
  function fadeCaption(t) {
    if (!capOut || !capIn) return;
    const out = 1 - Math.max(0, Math.min(1, (t - 0.1) / 0.28));
    const inn = Math.max(0, Math.min(1, (t - 0.56) / 0.3));
    capOut.style.opacity = out.toFixed(3);
    capIn.style.opacity = inn.toFixed(3);
  }

  function layout() {
    sb3d.style.setProperty('--bw', `${book.clientWidth}px`);
  }
  addEventListener('resize', layout);

  /* ── Spring loop ────────────────────────────────────────────────────── */

  let spring = null,
    raf = null,
    last = 0;

  function animateTo(target, onDone, stiff, damp) {
    spring = { kind: 'spring', v: 0, target, done: onDone, k: stiff || 150, c: damp || 22 };
    kick();
  }
  /* The riffle wants a fixed tempo, not a spring settling time. */
  function tweenTo(target, dur, onDone) {
    spring = { kind: 'tween', from: turn ? turn.t : 0, target, dur, e: 0, done: onDone };
    kick();
  }
  function kick() {
    if (raf === null) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    raf = null;
    const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
    last = now;
    if (spring && turn) {
      const s = spring;
      if (s.kind === 'tween') {
        s.e += dt;
        const k = Math.min(1, s.e / s.dur);
        turn.t = s.from + (s.target - s.from) * k;
        applyTurn(turn.t);
        if (k >= 1) {
          spring = null;
          s.done?.();
        }
      } else {
        const x = turn.t - s.target;
        s.v += (-s.k * x - s.c * s.v) * dt;
        turn.t += s.v * dt;
        if (Math.abs(turn.t - s.target) < 0.002 && Math.abs(s.v) < 0.02) {
          turn.t = s.target;
          spring = null;
          applyTurn(turn.t);
          s.done?.();
        } else applyTurn(turn.t);
      }
    }
    viewSpring();
    const lmoved = loupeEase();
    // kick() may already have queued the next frame from a done-callback
    if ((spring || viewActive || lmoved) && raf === null) raf = requestAnimationFrame(tick);
  }

  /* ── Tilt + zoom of the book ────────────────────────────────────────── */

  const view = { rx: 0, ry: 0, z: 1, ox: 0, oy: 0, trx: 0, try_: 0, tz: 1, tox: 0, toy: 0 };
  let viewActive = false,
    lastZ = 1;

  function applyView() {
    sb3d.style.setProperty('--rx', `${view.rx.toFixed(2)}deg`);
    sb3d.style.setProperty('--ry', `${view.ry.toFixed(2)}deg`);
    sb3d.style.setProperty('--zoom', view.z.toFixed(3));
    /* The vanishing point moves with the cursor, so the layers behind the
       page — sheets, board, base — slide against it. */
    sb3d.style.perspectiveOrigin = `${(50 + view.ox).toFixed(2)}% ${(46 + view.oy).toFixed(2)}%`;
    // The glass stays put, but the page under it has moved.
    if (view.z !== lastZ) {
      lastZ = view.z;
      placeLoupe();
    }
  }
  function viewSpring() {
    const e = 0.14;
    let moved = false;
    for (const [k, t] of [
      ['rx', 'trx'],
      ['ry', 'try_'],
      ['z', 'tz'],
      ['ox', 'tox'],
      ['oy', 'toy'],
    ]) {
      const d = view[t] - view[k];
      if (Math.abs(d) > 0.0006) {
        view[k] += d * e;
        moved = true;
      } else view[k] = view[t];
    }
    if (moved) applyView();
    viewActive = moved;
    return moved;
  }
  function setView(rx, ry, z) {
    view.trx = Math.max(-TILT_X, Math.min(TILT_X, rx));
    view.try_ = Math.max(-TILT_Y, Math.min(TILT_Y, ry));
    view.tz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    viewActive = true;
    kick();
    syncZoom();
  }
  /* The book leans toward the cursor — no dragging, and never far. */
  function tiltTo(cx, cy) {
    if (drag) return; // hold still while a page is being turned
    const r = book.getBoundingClientRect();
    if (!r.width) return;
    const nx = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / (r.width * 0.62)));
    const ny = Math.max(-1, Math.min(1, (cy - (r.top + r.height / 2)) / (r.height * 0.9)));
    setView(-ny * TILT_X, nx * TILT_Y, view.tz);
    setOrigin(nx * ORIGIN_X, ny * ORIGIN_Y);
  }
  function setOrigin(ox, oy) {
    view.tox = Math.max(-ORIGIN_X, Math.min(ORIGIN_X, ox));
    view.toy = Math.max(-ORIGIN_Y, Math.min(ORIGIN_Y, oy));
    viewActive = true;
    kick();
  }
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      tiltTo(e.clientX, e.clientY);
    },
    { passive: true }
  );
  addEventListener('pointerout', (e) => {
    if (e.relatedTarget) return;
    setView(0, 0, view.tz);
    setOrigin(0, 0);
  });
  addEventListener('blur', () => {
    setView(0, 0, view.tz);
    setOrigin(0, 0);
  });
  // The wheel belongs to the page — zoom is on the toolbar, or a double click
  // to come back to 100%.
  stage.addEventListener('dblclick', () => setView(view.trx, view.try_, 1));

  /* ── Pointer work ───────────────────────────────────────────────────── */

  let drag = null;
  const bookRect = () => book.getBoundingClientRect();
  const hideHint = () => hint?.classList.add('gone');

  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !ready) return;
    const onBook = /** @type {Element} */ (e.target).closest('.sb-zone');
    if (!onBook || introOn) return;
    e.preventDefault(); // no text selection, no image drag
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    hideHint();
    const r = bookRect();
    const dir = (e.clientX - r.left) / r.width > 0.5 ? 'next' : 'prev';
    startTurn(dir, 0);
    drag = {
      dir,
      x0: e.clientX,
      w: r.width,
      moved: 0,
      vel: 0,
      t0: turn ? turn.t : 0,
      tPrev: performance.now(),
    };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    const raw = (drag.dir === 'next' ? -dx : dx) / (drag.w * 0.62);
    const t = Math.max(0, Math.min(1, drag.t0 + raw));
    const now = performance.now();
    drag.vel = (t - (turn ? turn.t : 0)) / Math.max(0.001, (now - drag.tPrev) / 1000);
    drag.tPrev = now;
    if (turn) {
      turn.t = t;
      applyTurn(t);
    }
  });
  function endDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!turn) return;
    if (d.moved < 6) {
      commit();
      return;
    } // a tap, not a drag
    if (turn.t > 0.42 || d.vel > 1.1) commit();
    else cancel();
  }
  stage.addEventListener('dragstart', (e) => e.preventDefault());
  stage.addEventListener('selectstart', (e) => e.preventDefault());
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* ── Turn control ───────────────────────────────────────────────────── */

  function startTurn(dir, t) {
    spring = null;
    if (turn) {
      idx = turn.to;
      turn = null;
    } // settle anything still in flight
    shoveLoupe(dir);
    const from = idx;
    turn = { dir, from, to: dir === 'next' ? (from + 1) % M : (from - 1 + M) % M, t: t || 0 };
    paint();
  }
  function commit() {
    if (!turn) return;
    if (REDUCED) {
      idx = turn.to;
      turn = null;
      paint();
      return;
    }
    animateTo(
      1,
      () => {
        idx = turn.to;
        turn = null;
        paint();
      },
      170,
      26
    );
    kick();
  }
  function cancel() {
    if (!turn) return;
    animateTo(
      0,
      () => {
        turn = null;
        paint();
      },
      150,
      24
    );
    kick();
  }
  function step(dir) {
    if (!ready) return;
    if (introOn) endIntro();
    if (turn) {
      idx = turn.to;
      turn = null;
    } // finish whatever is in flight
    startTurn(dir, 0);
    commit();
  }
  addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = /** @type {HTMLElement|null} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    // Only while the book is actually the thing on screen.
    const r = wrap.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    e.preventDefault();
    hideHint();
    step(e.key === 'ArrowRight' ? 'next' : 'prev');
  });

  /* ── The loupe ──────────────────────────────────────────────────────── */

  const loupe = document.getElementById('loupe');
  const loupeBtn = document.getElementById('sbLoupeBtn');
  const zoomWrap = document.getElementById('zoomWrap');
  const zoomInner = document.getElementById('zoomInner');
  // Opt-in: the glass only appears once the reader asks for it.
  let loupeOn = false,
    lx = null,
    ly = null,
    lgrab = null,
    lTarget = null;

  /* Height matters as much as width now the book is a wide, low album: sizing
     off the width alone gives a glass taller than the page it sits on. */
  const loupeSize = () =>
    Math.round(Math.max(140, Math.min(240, book.clientWidth * 0.235, book.clientHeight * 0.42)));
  const bookBox = () => ({ x: 0, y: 0, w: book.clientWidth, h: book.clientHeight });

  /* Park it at the lower right, half off the book. */
  function restLoupe() {
    const b = bookBox();
    lx = b.x + b.w * 0.86;
    ly = b.y + b.h * 0.74;
    placeLoupe();
  }
  /* Mirror whatever the book is currently showing into the magnified copy. */
  function syncZoomLayer() {
    zoomInner.textContent = '';
    for (const c of book.children) {
      if (c.classList.contains('sb-zone')) continue; // hit targets need no copy
      zoomInner.appendChild(c.cloneNode(true));
    }
  }
  /* The glass sits above the tilt, in the book's untransformed pixels, so the
     lean of the page never nudges it. What the tilt does change is which part
     of the paper is under the glass, and only the scale matters enough to
     correct for: the book is drawn about its own centre. */
  function placeLoupe() {
    if (lx === null) return;
    const B = bookBox(),
      bw = B.w,
      bh = B.h;
    if (!bw) return;
    const R = loupeSize() / 2,
      bez = R * 2 * 0.058;
    loupe.style.setProperty('--lr', `${R * 2}px`);
    loupe.style.transform = `translate3d(${(lx - R).toFixed(1)}px,${(ly - R).toFixed(1)}px,0)`;
    loupe.classList.toggle('on', loupeOn);

    // Where the paper's edges land once the book is scaled.
    const z = view.z,
      cx = bw / 2,
      cy = bh / 2;
    const x0 = cx + (0 - cx) * z,
      x1 = cx + (bw - cx) * z;
    const y0 = cy + (0 - cy) * z,
      y1 = cy + (bh - cy) * z;
    /* How far the glass's own centre is inside the paper. The copy fades out
       as it wanders off the sheet, so you are left looking through plain
       glass rather than at a sliver of page floating on the desk. */
    const nx = Math.max(x0, Math.min(lx, x1));
    const ny = Math.max(y0, Math.min(ly, y1));
    const inside =
      lx > x0 && lx < x1 && ly > y0 && ly < y1
        ? Math.min(lx - x0, x1 - lx, ly - y0, y1 - ly)
        : -Math.hypot(lx - nx, ly - ny);
    const k = Math.max(0, Math.min(1, (inside + R * 0.3) / (R * 0.55)));

    zoomWrap.style.opacity = (loupeOn ? k : 0).toFixed(3);
    if (k <= 0.002) return;
    const r = (R - bez).toFixed(1);
    const mask = `radial-gradient(circle ${r}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px,#000 calc(100% - 1px),transparent 100%)`;
    zoomWrap.style.webkitMaskImage = mask;
    zoomWrap.style.maskImage = mask;
    /* The page point beneath the glass, magnified about that same spot so the
       lens keeps showing MAG times whatever is on screen. */
    const px = cx + (lx - cx) / z,
      py = cy + (ly - cy) / z,
      s = MAG * z;
    zoomInner.style.transform = `translate(${(lx - px * s).toFixed(1)}px,${(ly - py * s).toFixed(1)}px) scale(${s.toFixed(4)})`;
  }
  /* The leaf shoves the glass aside as it sweeps past. */
  function shoveLoupe(dir) {
    if (!loupeOn || lx === null || lgrab) return;
    const b = bookBox();
    const nx = (b.w / 2 + (lx - b.x - b.w / 2) / view.z) / b.w;
    const ny = (b.h / 2 + (ly - b.y - b.h / 2) / view.z) / b.h;
    if (nx < 0.02 || nx > 0.98 || ny < 0.05 || ny > 0.95) return; // already clear
    lTarget = { x: b.x + b.w * (dir === 'next' ? 0.12 : 0.88), y: b.y + b.h * 0.855 };
    kick();
  }
  function loupeEase() {
    if (!lTarget) return false;
    if (lgrab) {
      lTarget = null;
      return false;
    }
    const dx = lTarget.x - lx,
      dy = lTarget.y - ly;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      lx = lTarget.x;
      ly = lTarget.y;
      lTarget = null;
      placeLoupe();
      return false;
    }
    lx += dx * 0.17;
    ly += dy * 0.17;
    placeLoupe();
    return true;
  }
  loupe.addEventListener('pointerdown', (e) => {
    if (!loupeOn || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation(); // never starts a page turn
    lTarget = null;
    lgrab = { cx: e.clientX, cy: e.clientY, lx0: lx, ly0: ly };
    loupe.classList.add('held');
    try {
      loupe.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    hideHint();
  });
  loupe.addEventListener('pointermove', (e) => {
    if (!lgrab) return;
    const b = bookBox(),
      R = loupeSize() / 2;
    // The glass carries none of the book's transform, so the cursor maps 1:1.
    lx = Math.max(b.x - R * 0.7, Math.min(b.x + b.w + R * 0.7, lgrab.lx0 + (e.clientX - lgrab.cx)));
    ly = Math.max(b.y - R * 0.7, Math.min(b.y + b.h + R * 1.0, lgrab.ly0 + (e.clientY - lgrab.cy)));
    placeLoupe();
  });
  const dropLoupe = () => {
    lgrab = null;
    loupe.classList.remove('held');
  };
  loupe.addEventListener('pointerup', dropLoupe);
  loupe.addEventListener('pointercancel', dropLoupe);
  loupeBtn.onclick = () => {
    loupeOn = !loupeOn;
    loupeBtn.setAttribute('aria-pressed', String(loupeOn));
    loupe.classList.toggle('on', loupeOn);
    if (loupeOn && lx === null) restLoupe();
    if (!loupeOn) zoomWrap.style.opacity = '0';
    hideHint();
  };
  addEventListener('resize', () => {
    lx = null;
    restLoupe();
  });

  /* The zoom read-out and the plate index are gone from the toolbar — the
     album is navigated by its pages and its arrows. setView still runs: it is
     what the cursor-follow tilt drives. */
  function syncZoom() {}
  function marks() {}

  /* ── The riffle ─────────────────────────────────────────────────────── */

  let riffle = null,
    riffleAt = 0,
    introOn = false,
    introDone = false,
    pendingIntro = false;

  function endIntro() {
    introOn = false;
    wrap.classList.remove('intro', 'b2');
  }

  function riffleStep() {
    const s = riffle[riffleAt];
    wrap.classList.toggle('b2', s.bell > 0.55);
    startTurn('next', 0);
    tweenTo(1, s.dur, () => {
      idx = turn.to;
      turn = null;
      riffleAt++;
      if (introOn && riffleAt < riffle.length) {
        paint();
        riffleStep();
      } else {
        endIntro();
        paint();
      }
    });
  }
  function startIntro() {
    if (introDone || !ready) return;
    introDone = true;
    const coarse = matchMedia('(max-width: 640px), (pointer: coarse)').matches;
    if (coarse || REDUCED) {
      idx = LAND;
      paint();
      return;
    }
    const steps = M + LAND;
    riffle = [];
    for (let r = 0; r < steps; r++) {
      const bell = Math.sin(Math.PI * (r / (steps - 1)));
      riffle.push({ bell, dur: 0.17 - 0.12 * bell });
    }
    riffleAt = 0;
    introOn = true;
    wrap.classList.add('intro');
    riffleStep();
  }

  /* ── Background dust ─────────────────────────────────────────────────
     A small canvas of slowly rising motes behind the book — the section's
     stand-in for the studio room this used to have. Only ever runs while
     the section is actually on screen: an IntersectionObserver starts and
     stops the loop rather than letting it tick for the whole scroll
     stretch the book is pinned across. */
  (function initDust() {
    const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('sbMotes'));
    if (!canvas || REDUCED) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let w = 0,
      h = 0,
      motes = [],
      raf2 = null,
      running = false;

    const COUNT = 46;
    function seed() {
      motes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.4,
        s: 0.06 + Math.random() * 0.16, // rise speed, px/frame at 60fps
        drift: (Math.random() - 0.5) * 0.05,
        a: 0.08 + Math.random() * 0.22,
        warm: Math.random() > 0.5,
      }));
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.s;
        m.x += m.drift;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        if (m.x < -4) m.x = w + 4;
        else if (m.x > w + 4) m.x = -4;
        ctx.beginPath();
        ctx.fillStyle = m.warm ? `rgba(222,71,88,${m.a})` : `rgba(244,244,246,${m.a})`;
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf2 = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true;
      resize();
      raf2 = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf2) cancelAnimationFrame(raf2);
    }

    new IntersectionObserver(
      ([e]) => {
        e.isIntersecting ? start() : stop();
      },
      { threshold: 0.01 }
    ).observe(document.getElementById('sketchbook'));
    addEventListener('resize', () => {
      if (running) resize();
    });
  })();

  // The book flicks itself through once, timed to start the moment the
  // wireframe's exit (main.js's #sketchbook camera trigger) finishes — same
  // `end` value, 'top 5%' — rather than after a dead scroll gap into the pin.
  ScrollTrigger.create({
    trigger: '#sketchbook',
    start: 'top 5%',
    once: true,
    onEnter: () => {
      if (ready) startIntro();
      else pendingIntro = true;
    },
  });

  /* ── Boot ───────────────────────────────────────────────────────────── */

  buildStacks();
  applyView();
  buildPages().then(() => {
    if (pendingIntro) startIntro();
  });
}
