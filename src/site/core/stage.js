/**
 * The shared 3D stage.
 *
 * One WebGLRenderer, one Scene, one PerspectiveCamera for the entire page.
 * Every 3D act contributes a THREE.Group and registers itself here; acts are
 * activated and deactivated by scroll range. Because there is only ever one
 * camera, an act can hand the camera to the next one and the move reads as a
 * continuous flight rather than a cut.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VelocityWarpShader } from '../transitions/velocity-warp.js';
import { scrollState } from './scroll.js';

export const stage = {
  renderer: null,
  scene: null,
  camera: null,
  composer: null,
  clock: new THREE.Clock(),
  acts: new Map(),
  pointer: new THREE.Vector2(),
  /** Smoothed pointer, what parallax should actually follow. */
  pointerEased: new THREE.Vector2(),
  size: { w: 0, h: 0, dpr: 1 },
};

let warpPass = null;
let bloomPass = null;

export function initStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(0, 2.2, 16);

  stage.renderer = renderer;
  stage.scene = scene;
  stage.camera = camera;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.75, 0.22);
  composer.addPass(bloomPass);

  warpPass = new ShaderPass(VelocityWarpShader);
  composer.addPass(warpPass);

  composer.addPass(new OutputPass());
  stage.composer = composer;

  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', (e) => {
    stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    stage.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  return stage;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Cap DPR: at 2x the bloom pass alone costs more than it returns.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

  stage.size = { w, h, dpr };
  stage.renderer.setPixelRatio(dpr);
  stage.renderer.setSize(w, h, false);
  stage.composer.setPixelRatio(dpr);
  stage.composer.setSize(w, h);
  bloomPass?.setSize(w * dpr, h * dpr);

  stage.camera.aspect = w / h;
  stage.camera.updateProjectionMatrix();

  for (const act of stage.acts.values()) act.resize?.(w, h);
}

/**
 * Register a 3D act.
 *
 * @param {string} id
 * @param {{group:THREE.Group, update?:Function, enter?:Function, exit?:Function, resize?:Function}} act
 */
export function registerAct(id, act) {
  act.id = id;
  act.active = false;
  act.group.visible = false;
  stage.scene.add(act.group);
  stage.acts.set(id, act);
  return act;
}

export function setActActive(id, active) {
  // Coerce: ScrollTrigger reports isActive as undefined (not false) when a
  // trigger is inactive, and three's projectObject tests `visible === false`
  // strictly — so an undefined here would render the group regardless.
  active = !!active;

  const act = stage.acts.get(id);
  if (!act || act.active === active) return;
  act.active = active;
  act.group.visible = active;
  if (active) act.enter?.();
  else act.exit?.();
}

export function getAct(id) {
  return stage.acts.get(id);
}

/** Bloom needs to be dialled back over photographic content. */
export function setBloom(strength, radius = 0.75, threshold = 0.22) {
  if (!bloomPass) return;
  bloomPass.strength = strength;
  bloomPass.radius = radius;
  bloomPass.threshold = threshold;
}

export function startRenderLoop() {
  const tick = () => {
    const dt = Math.min(stage.clock.getDelta(), 0.05);
    const t = stage.clock.elapsedTime;

    stage.pointerEased.x += (stage.pointer.x - stage.pointerEased.x) * 0.055;
    stage.pointerEased.y += (stage.pointer.y - stage.pointerEased.y) * 0.055;

    if (warpPass) {
      warpPass.uniforms.uVelocity.value = scrollState.velocity;
      warpPass.uniforms.uIntensity.value = scrollState.intensity;
      warpPass.uniforms.uTime.value = t;
    }

    // Reconcile activation from scroll position rather than trusting callbacks.
    // ScrollTrigger can skip onToggle across a large instant jump, and its
    // `isActive` is not true at the exact start boundary — which would leave
    // the hero hidden at scroll 0. An inclusive range test avoids both.
    const y = window.scrollY;
    for (const act of stage.acts.values()) {
      if (!act.trigger) continue;
      setActActive(act.id, y >= act.trigger.start && y <= act.trigger.end);
    }

    for (const act of stage.acts.values()) {
      if (act.active) act.update?.(dt, t);
    }

    stage.composer.render();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export { THREE };
