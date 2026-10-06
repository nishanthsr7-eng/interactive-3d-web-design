/**
 * ACT I — Hero wireframe.
 *
 * The real "Make your own steampunk house" model (Sketches/House), reduced to
 * its feature edges by scripts/build-model-wire.mjs and drawn as glowing rose
 * line segments rather than a shaded mesh — a blueprint, not a render. The
 * reveal is a camera fly-through choreographed in main.js's `runIntro()`, not
 * a geometry-assembly shader — this act just owns the model, its material,
 * and its idle motion.
 */

import * as THREE from 'three';
import { stage, registerAct } from '../core/stage.js';

const ROSE = 0xde4758; // --red, main.css
const BONE = 0xf4f4f6; // --bone, main.css

// Rest framing: the wide establishing shot the fly-through intro lands on,
// and the anchor the Act I ScrollTrigger in main.js animates forward from.
const CAMERA_REST = { position: [2.0, 5.6, 31], lookAt: [3.6, 2.4, 0] };

// Fly-through start: close and low, just past the model's façade, so the
// intro reads as pulling back out of the structure into the establishing
// shot rather than a cut. Offset relative to the model's own position below.
const CAMERA_INTRO = { position: [13.9, 1.6, 5.5], lookAt: [13.5, 3.0, 0] };

const gridVertex = /* glsl */ `
  varying vec3 vPos;
  varying float vViewDist;
  void main() {
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDist = -mv.z; // distance from camera along view direction
    gl_Position = projectionMatrix * mv;
  }
`;

const gridFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec2 uPointer;
  uniform float uGlowRadius;
  varying vec3 vPos;
  varying float vViewDist;

  void main() {
    // Default state is the grid's normal faint glow everywhere; the cursor
    // extinguishes it fully at its centre, fading back in by uGlowRadius.
    float d = distance(vPos.xz, uPointer);
    float dim = smoothstep(uGlowRadius, 0.0, d);

    // Lines recede into dimness with distance, like the near edge of the
    // floor catching more light than the far back of the room. Reaches 0
    // (not a dim 0.18 floor) by 42 units out — the hero's own resting shot
    // sits ~31 units from the grid's centre, comfortably inside that curve,
    // so this doesn't dim the wide shot, it just means the far lines finish
    // fading before the grid's own finite edge (see buildGrid) is ever what
    // makes them disappear.
    float depthFade = mix(1.0, 0.0, smoothstep(8.0, 42.0, vViewDist));

    gl_FragColor = vec4(uColor, uOpacity * (1.0 - dim) * depthFade);
  }
`;

/**
 * Faint drafting-table ground grid, sitting just under the house's base.
 * Reuses GridHelper purely for its geometry — the material is swapped for a
 * shader so the grid can glow near the cursor.
 */
function buildGrid() {
  // Sized well past where the depth fade above already reaches full
  // transparency (~34 units out), so the mesh's own edge is never what's
  // making lines disappear — the fade always gets there first, regardless
  // of exactly where the camera sits during the hero/sketchbook handoff.
  const grid = /** @type {THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>} */ (
    /** @type {unknown} */ (new THREE.GridHelper(120, 60, ROSE, ROSE))
  );
  grid.position.y = -0.15;
  grid.material = new THREE.ShaderMaterial({
    vertexShader: gridVertex,
    fragmentShader: gridFragment,
    uniforms: {
      uColor: { value: new THREE.Color(ROSE) },
      uOpacity: { value: 0.14 },
      uPointer: { value: new THREE.Vector2(1e4, 1e4) }, // parked off-grid until the first move
      uGlowRadius: { value: 6.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return grid;
}

const DUST_COUNT = 240;
const DUST_RANGE = { x: 26, y: 15, z: 20 }; // half-extents, local space
const DUST_WRAP = 14; // vertical travel before a mote wraps back to the floor

const dustVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uRepelRadius;
  uniform float uRepelStrength;
  varying float vTwinkle;

  void main() {
    vec3 pos = position;
    float speed = 0.12 + aSeed * 0.22;
    pos.y = mod(pos.y + uTime * speed, ${DUST_WRAP.toFixed(1)}) - ${(DUST_WRAP / 2).toFixed(1)};
    pos.x += sin(uTime * 0.25 + aSeed * 41.0) * 0.7;
    pos.z += cos(uTime * 0.22 + aSeed * 29.0) * 0.7;

    // Scatter away from the cursor, like disturbing dust in the air.
    vec2 fromPointer = pos.xz - uPointer;
    float dist = max(length(fromPointer), 0.0001);
    float push = smoothstep(uRepelRadius, 0.0, dist) * uRepelStrength;
    pos.xz += (fromPointer / dist) * push;

    vTwinkle = 0.4 + 0.6 * fract(sin(aSeed * 91.7) * 43758.5);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.1 + aSeed * 1.5) * (44.0 / -mv.z);
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float falloff = 1.0 - smoothstep(0.0, 0.25, r);
    gl_FragColor = vec4(uColor, falloff * vTwinkle * uOpacity * 0.35);
  }
`;

/** Sparse, slowly drifting motes — the drafting-studio atmosphere around the model. */
function buildDust() {
  const positions = new Float32Array(DUST_COUNT * 3);
  const seeds = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * DUST_RANGE.x;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * DUST_RANGE.y;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * DUST_RANGE.z;
    seeds[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: dustVertex,
    fragmentShader: dustFragment,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(BONE).lerp(new THREE.Color(ROSE), 0.35) },
      uPointer: { value: new THREE.Vector2(1e4, 1e4) }, // parked off-grid until the first move
      uRepelRadius: { value: 5.0 },
      uRepelStrength: { value: 3.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, material);
}

/**
 * The wireframe loads separately (see `model-wire.js`) and attaches later via
 * `act.attachModel()` — this act registers immediately with an empty group so
 * the rest of the page (nav, copy, scroll) never waits on the fetch.
 */
export function createHeroModel() {
  const group = new THREE.Group();
  // Pushed further right/up than the model's natural centre, and slightly
  // enlarged, so it reads in the open space past the hero copy's readability
  // scrim rather than sitting cramped against it.
  group.position.set(13.5, -1.6, 0);
  group.scale.setScalar(1.3);

  const grid = buildGrid();
  group.add(grid);

  const dust = buildDust();
  group.add(dust);

  // Cursor tracking for the grid glow and dust repulsion: the pointer is only
  // known in screen space, so each frame it's cast onto the horizontal plane
  // the grid sits on and converted into the group's own local space.
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    -(group.position.y + grid.position.y * group.scale.y)
  );
  const worldHit = new THREE.Vector3();
  const pointerLocal = new THREE.Vector2();

  const state = { opacity: 1 };
  let lines = null;

  const act = registerAct('hero', {
    group,
    update(dt, t) {
      if (lines) lines.material.opacity = state.opacity;

      raycaster.setFromCamera(stage.pointer, stage.camera);
      if (raycaster.ray.intersectPlane(groundPlane, worldHit)) {
        group.worldToLocal(worldHit);
        pointerLocal.set(worldHit.x, worldHit.z);
        grid.material.uniforms.uPointer.value.copy(pointerLocal);
        dust.material.uniforms.uPointer.value.copy(pointerLocal);
      }

      grid.material.uniforms.uOpacity.value = 0.14 * state.opacity;
      dust.material.uniforms.uTime.value = t;
      dust.material.uniforms.uOpacity.value = state.opacity;
    },
  });

  act.state = state;

  /** @param {{positions:Float32Array, meta:object}|null} loaded */
  act.attachModel = (loaded) => {
    if (!loaded) return; // bake failed to load — hero stays an empty group

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(loaded.positions, 3));

    lines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: ROSE,
        transparent: true,
        opacity: state.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(lines);
  };

  act.cameraRest = CAMERA_REST;
  act.cameraIntro = CAMERA_INTRO;

  act.setCameraForIntro = () => {
    stage.camera.position.set(...CAMERA_INTRO.position);
    stage.camera.lookAt(...CAMERA_INTRO.lookAt);
  };

  return act;
}
