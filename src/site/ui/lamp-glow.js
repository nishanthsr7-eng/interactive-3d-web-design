/**
 * The shared lamp glow behind Trust and Statement — see #lamp-glow in
 * main.css for the actual gradient. One continuous act across both
 * sections, not two separate instances: it grows and brightens exactly
 * across the sketchbook -> trust handoff (see the first trigger below for
 * why it's keyed there and not to #trust itself), then just sits there
 * steady behind both sections (nothing to drive once it's lit), and fades
 * out again before Contact.
 *
 * Two independent ScrollTriggers feed a single `target` state — each owning
 * one edge of the shape, matching how main.js's own wireTimeline() stacks
 * multiple ScrollTrigger.create() calls for the hero rather than
 * hand-rolling one trigger with baked-in progress breakpoints — but neither
 * writes to the DOM directly any more. A small rAF spring chases `target`
 * every frame and applies the result, so the glow always trails scroll by a
 * beat instead of snapping to it 1:1: it reads as something with its own
 * weight moving through the scene, not a value bound to a scrollbar.
 */

import { ScrollTrigger } from '../core/scroll.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Quadratic Bezier — lets the hotspot arc through the scene rather than
 *  sliding in a straight line from sketchbook's floor to Trust's photos. */
function bezier(t, p0, p1, p2) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

export function initLampGlow() {
  const el = document.getElementById('lamp-glow');
  const sketchbook = document.getElementById('sketchbook');
  const statement = document.getElementById('statement');
  if (!el || !sketchbook || !statement) return;

  // Path control points, in the same % space as --lamp-x/--lamp-y. Start is
  // roughly sketchbook's own floor-glow origin, end is the resting spot
  // behind Trust's photo cluster; the control point bows the path out to the
  // right and low before it sweeps up, like a lamp swinging into place
  // rather than being dragged there in a straight line.
  const PATH_X = [50, 84, 60];
  const PATH_Y = [92, 86, 48];

  const target = { opacity: 0, scale: 0.45, x: PATH_X[0], y: PATH_Y[0] };
  const state = { ...target };

  ScrollTrigger.create({
    trigger: sketchbook,
    start: 'bottom 120%',
    end: 'bottom 0%',
    scrub: 1,
    onUpdate(self) {
      const p = self.progress;
      // Eased, not linear: brightness has to catch up to sketchbook's own
      // bottom-up glow well before the handoff, or the section reads as a
      // dim gap between the book's own light and this one's.
      const e = 1 - (1 - p) ** 2;
      target.opacity = e;
      target.scale = 0.45 + e * 0.55;
      target.x = bezier(p, ...PATH_X);
      target.y = bezier(p, ...PATH_Y);
      kick();
    },
  });

  // Fade out before Contact. Independent of the trigger above — once scroll
  // passes the grow-in's own `end`, that trigger simply stops updating, so
  // the target holds at full opacity/scale through the rest of Trust and all
  // of Statement until this one starts pulling it back down.
  ScrollTrigger.create({
    trigger: statement,
    start: 'bottom 65%',
    end: 'bottom top',
    scrub: 1,
    onUpdate(self) {
      target.opacity = 1 - self.progress;
      kick();
    },
  });

  function apply() {
    el.style.opacity = state.opacity;
    el.style.setProperty('--lamp-scale', state.scale.toFixed(4));
    el.style.setProperty('--lamp-x', `${state.x.toFixed(2)}%`);
    el.style.setProperty('--lamp-y', `${state.y.toFixed(2)}%`);
  }

  let raf = null;
  function tick() {
    raf = null;
    let moved = false;
    for (const k of ['opacity', 'scale', 'x', 'y']) {
      const d = target[k] - state[k];
      if (Math.abs(d) > 0.0008) { state[k] += d * 0.07; moved = true; }
      else state[k] = target[k];
    }
    apply();
    if (moved) raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (REDUCED) { Object.assign(state, target); apply(); return; }
    if (raf === null) raf = requestAnimationFrame(tick);
  }
}
