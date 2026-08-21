/**
 * Smooth scrolling (Lenis) wired into GSAP's ScrollTrigger, plus a normalised
 * scroll velocity that the velocity-warp shader reads every frame.
 */

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const scrollState = {
  /** Smoothed, signed velocity in roughly [-1, 1]. */
  velocity: 0,
  /** Absolute velocity, eased back toward 0 at rest. */
  intensity: 0,
  progress: 0,
};

let lenis = null;

/** Honoured by initScroll and by main.js's preloader floor. */
export const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initScroll() {
  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    // Smoothing is the page's biggest single piece of motion. Turning it off
    // hands scrolling back to the browser while leaving Lenis in place, so
    // ScrollTrigger and scrollTo() below keep working unchanged.
    smoothWheel: !REDUCED_MOTION,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.5,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // Velocity is reported in px/frame; ~60px is a hard flick.
  lenis.on('scroll', ({ velocity }) => {
    const v = Math.max(-1, Math.min(1, velocity / 60));
    scrollState.velocity += (v - scrollState.velocity) * 0.25;
  });

  gsap.ticker.add(() => {
    // Decay toward rest so the warp always settles even if scroll stops abruptly.
    scrollState.velocity *= 0.92;
    if (Math.abs(scrollState.velocity) < 0.0005) scrollState.velocity = 0;
    scrollState.intensity = Math.abs(scrollState.velocity);
    scrollState.progress =
      window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
  });

  return lenis;
}

export function scrollTo(target, opts = {}) {
  lenis?.scrollTo(target, { duration: REDUCED_MOTION ? 0 : 1.6, ...opts });
}

export function stopScroll() {
  lenis?.stop();
}

export function startScroll() {
  lenis?.start();
}

export { gsap, ScrollTrigger, SplitText };
