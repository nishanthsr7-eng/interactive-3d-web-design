/**
 * Desktop gate. This experience is built for a large screen and a real GPU;
 * below that we show a courteous notice instead of a degraded page.
 */

const MIN_WIDTH = 1024;

export function isSupported() {
  if (window.innerWidth < MIN_WIDTH) return false;
  if (window.matchMedia('(pointer: coarse)').matches) return false;

  // No WebGL means none of the 3D acts can run at all.
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
  } catch {
    return false;
  }
  return true;
}

export function showGate() {
  document.documentElement.classList.add('is-gated');
  const el = document.getElementById('gate');
  if (el) el.hidden = false;

  // The preview only loads once the gate is shown, so desktop visitors never
  // download it. Autoplay is muted, so mobile browsers allow it.
  const video = /** @type {HTMLVideoElement|null} */ (el?.querySelector('.gate__video'));
  if (video?.dataset.src) {
    video.muted = true;
    video.autoplay = true;
    video.src = video.dataset.src;
    const play = () => video.play().catch(() => {});
    play();
    // Browsers defer autoplay in background tabs or under data saver; retry
    // when the tab comes forward or on the first tap.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) play();
    });
    el.addEventListener('pointerdown', play, { once: true });
  }

  // Re-check on resize so widening a desktop window recovers the experience.
  let reloading = false;
  window.addEventListener('resize', () => {
    if (!reloading && isSupported()) {
      reloading = true;
      window.location.reload();
    }
  });
}
