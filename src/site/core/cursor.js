/**
 * Custom cursor: a small ring that follows with lag and changes state over
 * interactive elements. Elements opt in with data-cursor="drag|hotspot|link".
 */

import { gsap } from 'gsap';

export function initCursor() {
  const root = document.getElementById('cursor');
  if (!root) return;

  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const label = root.querySelector('.cursor__label');

  const toDotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const toDotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  const toRingX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' });
  const toRingY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });
  const toLabelX = gsap.quickTo(label, 'x', { duration: 0.42, ease: 'power3' });
  const toLabelY = gsap.quickTo(label, 'y', { duration: 0.42, ease: 'power3' });

  let visible = false;

  window.addEventListener('pointermove', (e) => {
    if (!visible) {
      visible = true;
      gsap.to(root, { autoAlpha: 1, duration: 0.3 });
    }
    toDotX(e.clientX);
    toDotY(e.clientY);
    toRingX(e.clientX);
    toRingY(e.clientY);
    toLabelX(e.clientX);
    toLabelY(e.clientY);
  });

  document.addEventListener('pointerleave', () => {
    visible = false;
    gsap.to(root, { autoAlpha: 0, duration: 0.3 });
  });

  // Delegate state changes so elements added later still work.
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest?.('[data-cursor]');
    if (!target) return;
    const mode = target.dataset.cursor;
    root.dataset.mode = mode;
    label.textContent = target.dataset.cursorLabel ?? '';
  });

  document.addEventListener('pointerout', (e) => {
    if (!e.target.closest?.('[data-cursor]')) return;
    if (e.relatedTarget?.closest?.('[data-cursor]')) return;
    root.dataset.mode = '';
    label.textContent = '';
  });

  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  // The page sets `cursor: none` everywhere, which leaves a keyboard user with
  // no pointer and no ring. The first Tab hands the real cursor back and hides
  // the ring; moving the mouse again takes it away (see .is-keyboard in
  // main.css, and the :focus-visible rules beside it).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') document.documentElement.classList.add('is-keyboard');
  });
  window.addEventListener('pointermove', () => {
    document.documentElement.classList.remove('is-keyboard');
  });
}
