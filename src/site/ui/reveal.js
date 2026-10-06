/**
 * Generic scroll reveal for [data-reveal] elements outside the 3D acts.
 */

import { gsap, ScrollTrigger, SplitText } from '../core/scroll.js';

export function initReveal(root = document) {
  const items = [...root.querySelectorAll('[data-reveal]')];

  for (const el of items) {
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      autoAlpha: 1,
      y: 0,
      duration: 0.95,
      ease: 'power3.out',
    });
  }

  ScrollTrigger.refresh();
}

/**
 * Water-ripple hover effect on the hero's "scroll to explore" cue, scoped to
 * that one glass pill — nowhere else on the page spawns these.
 */
export function initScrollRipple() {
  const el = /** @type {HTMLElement|null} */ (document.querySelector('.hero__scroll'));
  if (!el) return;

  let lastSpawn = 0;
  el.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - lastSpawn < 140) return; // throttle so ripples don't flood
    lastSpawn = now;

    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'hero__scroll-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    ripple.addEventListener('animationend', () => ripple.remove());
    el.appendChild(ripple);
  });
}

/** Counts the "40+" badge up from 0 once its <b> becomes visible. */
function startBadgeCount() {
  const el = /** @type {HTMLElement|null} */ (document.querySelector('.badge-count'));
  if (!el) return;
  const to = Number(el.dataset.countTo) || 0;
  const counter = { v: 0 };
  gsap.to(counter, {
    v: to,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = String(Math.round(counter.v));
    },
  });
}

/**
 * Trust and Statement's kicker + headline get a per-character/per-word
 * treatment layered on top of the generic [data-reveal] fade those elements
 * already have (the element itself still fades+rises as a block; this
 * additionally animates the text inside it, so the copy is doing something
 * rather than just sliding in flat).
 *
 * Kicker: each character rises into place with a slight overshoot, like a
 * split-flap board resolving one character after another.
 * Headline: each word starts soft/blurred and racks into focus — a literal
 * reading of "the drawing is flat, we build the depth" (and reads just as
 * well as "coming under scrutiny" for the Trust copy next to it).
 */
export function revealSectionHeadlines(scope = '.trust, .statement') {
  const sections = document.querySelectorAll(scope);

  for (const section of sections) {
    const kicker = section.querySelector('.kicker');
    const heading = section.querySelector('h2');

    if (kicker) {
      const kickerSplit = new SplitText(kicker, { type: 'chars', charsClass: 'char' });
      gsap.set(kickerSplit.chars, { autoAlpha: 0, y: 10 });
      gsap.to(kickerSplit.chars, {
        scrollTrigger: { trigger: kicker, start: 'top 92%', once: true },
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.02,
        ease: 'back.out(2)',
      });
    }

    if (heading) {
      const headingSplit = new SplitText(heading, { type: 'words', wordsClass: 'word' });
      gsap.set(headingSplit.words, { autoAlpha: 0, filter: 'blur(9px)', scale: 1.05 });
      gsap.to(headingSplit.words, {
        scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
        autoAlpha: 1,
        filter: 'blur(0px)',
        scale: 1,
        duration: 0.9,
        stagger: 0.055,
        ease: 'power2.out',
      });
    }
  }

  ScrollTrigger.refresh();
}

/** Hero copy animates on load rather than on scroll. */
export function revealHero() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  // Title lines start loosely tracked, as if not yet assembled, and snap to
  // the display face's normal -0.04em on arrival — 'back' overshoots past it
  // and settles, which reads as a mechanical snap rather than a plain fade.
  gsap.set('.hero__title .line', { letterSpacing: '0.4em' });
  tl.to('.hero__title .line', { autoAlpha: 1, y: 0, duration: 1.05, stagger: 0.11 })
    .to(
      '.hero__title .line',
      {
        letterSpacing: '-0.04em',
        duration: 1.0,
        stagger: 0.11,
        ease: 'back.out(1.6)',
      },
      '<'
    )
    .to('.hero .lede', { autoAlpha: 1, y: 0, duration: 0.9 }, '-=0.7')
    // Badges tick in one at a time rather than as one block; the "40+" count
    // starts the instant its own <b> begins revealing.
    .to(
      '.hero__badges > *',
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.75,
        stagger: 0.12,
        onStart: startBadgeCount,
      },
      '-=0.62'
    )
    .to('.hero__scroll', { autoAlpha: 1, y: 0, duration: 0.8 }, '-=0.5')
    .from('.masthead', { autoAlpha: 0, y: -18, duration: 0.9 }, '-=1.0');
  return tl;
}
