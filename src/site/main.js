/**
 * VINCI Builders — boot sequence and scroll choreography.
 *
 * Structure follows vertex3d.asia: Hero -> Trust -> Statement share one
 * continuous camera move around a single 3D object (the house), which the
 * Sketchbook act then takes over from directly into Contact.
 */

import { isSupported, showGate } from './core/gate.js';
import {
  initScroll,
  gsap,
  ScrollTrigger,
  stopScroll,
  startScroll,
  scrollTo,
  REDUCED_MOTION,
} from './core/scroll.js';
import { initStage, startRenderLoop, setActActive, setBloom, stage } from './core/stage.js';
import { initCursor } from './core/cursor.js';
import { createHeroModel } from './scenes/hero-model.js';
import { loadModelWireframe } from './scenes/model-wire.js';
import { initForm } from './ui/form.js';
import { initReveal, revealHero, revealSectionHeadlines, initScrollRipple } from './ui/reveal.js';
import { initSketchbook } from './ui/sketchbook.js';
import { initLampGlow } from './ui/lamp-glow.js';

const acts = {};

boot().catch((err) => {
  console.error('[VINCI] boot failed:', err);
  /** @type {any} */ (window).__vinciBootError = err;
});

async function boot() {
  document.getElementById('year').textContent = String(new Date().getFullYear());

  if (!isSupported()) {
    showGate();
    return;
  }

  // A window that starts wide enough can still be resized narrower than the
  // gate's floor afterward (e.g. dragging it onto a smaller monitor) — catch
  // that instead of leaving an unsupported layout running silently.
  let gated = false;
  window.addEventListener('resize', () => {
    if (!gated && !isSupported()) {
      gated = true;
      showGate();
    }
  });

  document.documentElement.classList.add('is-locked');
  startPreloaderAnimation();

  // The hero wireframe loads in the background from a small baked bin/json
  // pair; the fly-through intro waits for it separately, right before it plays.
  const heroModelPromise = loadModelWireframe();

  initScroll();
  stopScroll();

  initStage(document.getElementById('gl-canvas'));
  initCursor();
  initScrollRipple();

  acts.hero = createHeroModel();

  acts.hero.setCameraForIntro();
  setActActive('hero', true);
  // Matches the hero ScrollTrigger's p=0 value — otherwise the composer's
  // default bloom strength (tuned for the dark walkthrough footage) holds
  // until the first scroll event and blows out anything pale on load.
  setBloom(0.04);
  startRenderLoop();

  initForm();
  initSketchbook();
  wireTimeline();
  ScrollTrigger.refresh();

  // A floor under the preloader's duration: on a fast connection the wire
  // bake resolves almost instantly, which used to cut the mark's draw-on
  // animation short and dismiss before it read as a "load" at all. Progress
  // eases toward 92% across this floor so the counter is doing something
  // the whole time rather than sitting at 0 and jumping to 100.
  // Under reduced motion the draw-on animation this floor exists to protect
  // is not playing, so the floor is just a wait — drop it to a beat.
  const MIN_PRELOAD_MS = REDUCED_MOTION ? 300 : 2400;
  const minPreload = new Promise((resolve) => setTimeout(resolve, MIN_PRELOAD_MS));
  const progress = { v: 0 };
  gsap.to(progress, {
    v: 92,
    duration: MIN_PRELOAD_MS / 1000,
    ease: 'power1.out',
    onUpdate: () => updatePreloader(progress.v, 100),
  });

  const [heroModel] = await Promise.all([heroModelPromise, minPreload]);
  // Attached while still hidden behind the preloader, not after it lifts —
  // otherwise the wireframe used to pop into existence fully-formed the
  // instant the curtain cleared, read as a jarring cut rather than a reveal.
  acts.hero.attachModel(heroModel);
  // Not awaited: the fly-through starts moving the instant the curtain
  // begins lifting, so the model is never seen sitting frozen mid-fade —
  // awaiting here left a static wireframe on screen for the ~1.4s the
  // preloader took to dissolve before any motion began.
  dismissPreloader();

  document.documentElement.classList.remove('is-locked');
  startScroll();
  initReveal();
  revealSectionHeadlines();
  initLampGlow();
  runIntro();
}

/**
 * The opening beat: the camera pulls back from inside the house to the wide
 * establishing shot while the hero copy resolves alongside it.
 */
async function runIntro() {
  const { position, lookAt } = acts.hero.cameraRest;
  const target = { x: lookAt[0], y: lookAt[1], z: lookAt[2] };

  gsap.to(stage.camera.position, {
    x: position[0],
    y: position[1],
    z: position[2],
    duration: 3.2,
    ease: 'power2.inOut',
  });
  gsap.to(target, {
    x: lookAt[0],
    y: lookAt[1],
    z: lookAt[2],
    duration: 3.2,
    ease: 'power2.inOut',
    onUpdate: () => stage.camera.lookAt(target.x, target.y, target.z),
  });

  revealHero();
}

/* ── Preloader ─────────────────────────────────────────────────────────── */

function startPreloaderAnimation() {
  const paths = /** @type {NodeListOf<SVGGeometryElement>} */ (
    document.querySelectorAll('.preloader__mark .pl-line')
  );
  paths.forEach((p) => {
    const len = p.getTotalLength();
    p.style.setProperty('--len', String(len));
  });

  gsap.to('.preloader__mark .pl-line', {
    strokeDashoffset: 0,
    duration: 1.5,
    stagger: 0.14,
    ease: 'power2.inOut',
  });
}

function updatePreloader(loaded, total) {
  const pct = Math.round((loaded / total) * 100);
  const el = document.getElementById('preloader-pct');
  const fill = document.getElementById('preloader-fill');
  if (el) el.textContent = String(pct);
  if (fill) fill.style.width = `${pct}%`;
}

function dismissPreloader() {
  updatePreloader(1, 1);
  return gsap
    .timeline()
    .to('.preloader__inner', { autoAlpha: 0, y: -14, duration: 0.6, ease: 'power2.in' })
    .to('.preloader', { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' }, '-=0.2')
    .set('.preloader', { display: 'none' })
    .then();
}

/* ── Scroll choreography ───────────────────────────────────────────────── */

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function wireTimeline() {
  const { position: heroPos, lookAt: heroLook } = acts.hero.cameraRest;

  /* HERO — the fly-through plays on load (runIntro) and lands on cameraRest;
     scroll continues forward from that same anchor into a slow push/orbit. */
  const HERO_END = {
    pos: [heroPos[0] + 1.6, heroPos[1] - 2.2, heroPos[2] - 13],
    look: [heroLook[0] - 1.4, heroLook[1] - 0.4, heroLook[2]],
  };
  // Not assigned to acts.hero.trigger: that property drives stage.js's
  // per-frame auto-activation reconcile, which would deactivate the hero
  // group the instant scroll passes this section — activation here is fully
  // manual instead (see the sketchbook fade-out below).
  // scrub matches the sketchbook trigger's smoothed lag below (1.1, not
  // `true`) — one continuous motion character from Hero through the model's
  // exit, instead of a snap-to-scroll feel that suddenly turns smooth.
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.1,
    onUpdate(self) {
      const p = self.progress;
      stage.camera.position.set(...lerp3(heroPos, HERO_END.pos, p));
      stage.camera.lookAt(...lerp3(heroLook, HERO_END.look, p));
      setBloom(0.04 * (1 - p * 0.5));
    },
  });

  /* SKETCHBOOK — the model's run ends here, properly: a close-up arrival for
     one last look at the house (0-51% of this trigger), then it turns away,
     shrinks and fades while the canvas itself dissolves (51-100%) — not a
     flat cross-fade. The hero act is switched off for good once it's gone.
     Trust and Statement are flat text sections from here on, with no 3D
     backdrop of their own, and nothing past the sketchbook ever needs the
     canvas again.
     end is pushed 20% of the viewport further than the arrival alone needs —
     that whole extra stretch is given to the close-up (0-51%), not the
     turn-away/fade (51-100%, held at its original ~518px), so the arrival
     reads unhurried without slowing the exit. The sketchbook's own page-flip
     intro trigger (sketchbook.js) starts at this same `end` value, so the
     flip begins exactly as this exit finishes rather than after a scroll gap.
     scrub is a smoothed lag (not `true`) so the whole exit eases rather than
     snapping 1:1 to scroll position. */
  const CLOSEUP = { pos: [11, 4.5, 9], look: [13.5, 3.5, 0] };
  const CLOSEUP_SPLIT = 0.51;
  const heroGroup = acts.hero.group;
  const heroBaseScale = heroGroup.scale.x;
  const heroPin = /** @type {HTMLElement} */ (document.querySelector('.hero__pin'));
  // .hero__pin::before's legibility gradient needs to be gone well before
  // the sketchbook approach finishes (see the CSS comment on it) — done by
  // 40% into this trigger, i.e. before CLOSEUP_SPLIT, not tied to it.
  const PIN_FADE_END = 0.4;

  ScrollTrigger.create({
    trigger: '#sketchbook',
    start: 'top 105%',
    end: 'top 5%',
    scrub: 1.1,
    onUpdate(self) {
      const p = self.progress;
      heroPin.style.setProperty('--hero-pin-fade', String(1 - Math.min(1, p / PIN_FADE_END)));
      if (p < CLOSEUP_SPLIT) {
        const k = p / CLOSEUP_SPLIT;
        stage.camera.position.set(...lerp3(HERO_END.pos, CLOSEUP.pos, k));
        stage.camera.lookAt(...lerp3(HERO_END.look, CLOSEUP.look, k));
        stage.renderer.domElement.style.opacity = '1';
        heroGroup.scale.setScalar(heroBaseScale);
        heroGroup.rotation.y = 0;
        acts.hero.state.opacity = 1;
      } else {
        const k = (p - CLOSEUP_SPLIT) / (1 - CLOSEUP_SPLIT);
        heroGroup.scale.setScalar(heroBaseScale * (1 - k * 0.6));
        heroGroup.rotation.y = k * 1.1; // ~63° turning away, not a spin
        acts.hero.state.opacity = 1 - k;
        stage.renderer.domElement.style.opacity = String(1 - k);
      }
    },
    onLeave: () => setActActive('hero', false),
    onEnterBack: () => {
      setActActive('hero', true);
      heroGroup.scale.setScalar(heroBaseScale);
      heroGroup.rotation.y = 0;
      acts.hero.state.opacity = 1;
    },
  });

  // Anchor links go through Lenis so they inherit the smooth scroll.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollTo(target);
    });
  });
}
