/**
 * GLB -> blueprint wireframe.
 *
 * The source file is a Sketchfab presentation board, not a single house: a
 * scatter of loose kit props ("PROPS"), a plain blockout house ("BLOCKS"), and
 * the finished, fully detailed house ("FINAL"), laid out left to right along
 * X. Only the third — the finished house — is what belongs in the hero; see
 * REGION below for how it is isolated.
 *
 * The hero act draws the house as glowing line segments, so it needs edges, not
 * a shaded mesh. Loading the source GLB in the browser is not an option — it is
 * 116 MB, almost all of it PBR textures the blueprint never samples — so the
 * feature edges are extracted here, once, and shipped as a quantised binary of
 * a few hundred KB.
 *
 * "Feature edge" means either a boundary edge (one adjacent face) or a crease:
 * two faces meeting at more than ANGLE_DEG. That drops the interior tessellation
 * of every flat panel while keeping the silhouette, the trims and the pipework —
 * which is the part that reads as a blueprint.
 *
 * Every edge also carries the construction *phase* of the material it came
 * from (foundation, walls, framing, roof, mechanical, props — see PART_PHASE),
 * written out as a parallel byte array. The hero assembly uses that to stage
 * the reveal as a real build sequence instead of a uniform bottom-up wash.
 *
 *   node scripts/build-model-wire.mjs [path/to/model.glb]
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ── Tuning knobs ──────────────────────────────────────────────────────── */

const SRC = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'Sketches', 'make_your_own_steampunk_house.glb');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'model');
const NAME = 'house-wire';

const ANGLE_DEG = 32;           // crease threshold; lower keeps more edges
const TARGET_SEGMENTS = 13000;  // final count, longest-first
const TARGET_HEIGHT = 9.6;      // metres, to frame like the old procedural house
const WELD_TOLERANCE = 1e-4;    // fraction of the bounding diagonal

/**
 * World-space X cutoff isolating the "FINAL" house from the props scatter and
 * the "BLOCKS" blockout house to its left. Found by rendering a top-down
 * density map of the source scene: triangle density is near zero across
 * roughly x in [-2, 4], then ramps hard into the finished house from there.
 * 3.5 sits just inside that gap, in front of its entry gate.
 */
const REGION_MIN_X = 3.5;

/**
 * Construction phase per material, used to stage the assembly reveal as
 * foundation -> walls -> framing -> roof -> mechanical -> props, rather than a
 * uniform bottom-up wash. Keyed by the mesh name with its "Cube.NNN_" prefix
 * and trailing "_0" stripped. Anything unlisted falls into the last phase.
 */
const PART_PHASES = [
  { name: 'foundation', materials: ['wall_stone', 'stonework', 'Stone_trims', 'building_G'] },
  { name: 'walls', materials: ['wall_panels', 'wall_plaster', 'wall_planks'] },
  { name: 'framing', materials: ['beams_patterns', 'beams_dougong', 'trims_wood', 'trims_metal'] },
  { name: 'roof', materials: ['roof_A', 'roof_B'] },
  { name: 'mechanical', materials: ['house_B_pipes', 'house_c_pipes', 'house_F_pipes', 'pipes_low', 'steam_control_system', 'metal_fittings'] },
  { name: 'props', materials: ['props_A', 'props_B'] },
];
const PHASE_OF_MATERIAL = new Map();
PART_PHASES.forEach((phase, i) => phase.materials.forEach((m) => PHASE_OF_MATERIAL.set(m, i)));
const DEFAULT_PHASE = PART_PHASES.length - 1;

// The scene's presentation text ("PROPS" / "BLOCKS" / "FINAL" and the section
// dividers) never got a real material renamed in Blender, so it exported as
// the generic default — it is the only mesh called exactly this.
const EXCLUDED_MATERIALS = new Set(['Material']);

function materialName(meshName) {
  return (meshName || '').replace(/^Cube\.\d+_/, '').replace(/_0$/, '');
}

/* ── glTF plumbing ─────────────────────────────────────────────────────── */

const COMPONENT = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const NUM_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGLB(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB (bad magic)');

  let off = 12;
  let json = null;
  let bin = null;

  // chunkLength already includes the chunk's own 4-byte padding.
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(buf.toString('utf8', start, start + len));
    else if (type === 0x004e4942) bin = buf.subarray(start, start + len);
    off = start + len;
  }

  if (!json) throw new Error('GLB has no JSON chunk');
  return { json, bin };
}

/** Read an accessor out as a flat typed array, honouring byteStride. */
function readAccessor(gltf, bin, index) {
  const acc = gltf.accessors[index];
  const comps = NUM_COMPONENTS[acc.type];
  const Ctor = COMPONENT[acc.componentType];
  const out = new Ctor(acc.count * comps);

  if (acc.bufferView == null) return out; // spec: zero-filled

  const view = gltf.bufferViews[acc.bufferView];
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const elemSize = Ctor.BYTES_PER_ELEMENT * comps;
  const stride = view.byteStride || elemSize;

  if (stride === elemSize) {
    // Tightly packed: one copy for the whole run.
    const at = bin.byteOffset + base;
    return new Ctor(bin.buffer.slice(at, at + acc.count * elemSize));
  }

  for (let i = 0; i < acc.count; i++) {
    const at = bin.byteOffset + base + i * stride;
    // Strided offsets are not guaranteed to be component-aligned, so go
    // through a copy rather than a view onto the shared buffer.
    out.set(new Ctor(bin.buffer.slice(at, at + elemSize)), i * comps);
  }
  return out;
}

/* ── Matrices (column-major, glTF order) ───────────────────────────────── */

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function composeTRS(node) {
  if (node.matrix) return node.matrix.slice();

  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];

  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function applyMatrix(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/* ── Extraction ────────────────────────────────────────────────────────── */

/**
 * Flatten the scene graph into world-space triangle soup, keeping only
 * triangles whose centroid falls at or past `regionMinX` — i.e. only the
 * finished house, not the props scatter or the blockout to its left.
 *
 * `triPhase` runs parallel to `indices` one entry per triangle (not per
 * index), recording which construction phase its material belongs to.
 */
function collectTriangles(gltf, bin, regionMinX) {
  const positions = [];
  const indices = [];
  const triPhase = [];
  const scene = gltf.scenes[gltf.scene ?? 0];

  const walk = (nodeIndex, parent) => {
    const node = gltf.nodes[nodeIndex];
    const world = multiply(parent, composeTRS(node));

    if (node.mesh != null) {
      const mesh = gltf.meshes[node.mesh];
      const material = materialName(mesh.name);

      if (!EXCLUDED_MATERIALS.has(material)) {
      const phase = PHASE_OF_MATERIAL.get(material) ?? DEFAULT_PHASE;

      for (const prim of mesh.primitives) {
        if ((prim.mode ?? 4) !== 4) continue;            // triangles only
        if (prim.attributes?.POSITION == null) continue;

        const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
        const world3 = new Float32Array(pos.length);
        for (let i = 0; i < pos.length; i += 3) {
          const p = applyMatrix(world, pos[i], pos[i + 1], pos[i + 2]);
          world3[i] = p[0]; world3[i + 1] = p[1]; world3[i + 2] = p[2];
        }

        const idx = prim.indices != null ? readAccessor(gltf, bin, prim.indices) : null;
        const count = idx ? idx.length : pos.length / 3;

        for (let i = 0; i < count; i += 3) {
          const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
          const cx = (world3[a * 3] + world3[b * 3] + world3[c * 3]) / 3;
          if (cx < regionMinX) continue;

          const offset = positions.length / 3;
          positions.push(
            world3[a * 3], world3[a * 3 + 1], world3[a * 3 + 2],
            world3[b * 3], world3[b * 3 + 1], world3[b * 3 + 2],
            world3[c * 3], world3[c * 3 + 1], world3[c * 3 + 2]
          );
          indices.push(offset, offset + 1, offset + 2);
          triPhase.push(phase);
        }
      }
      }
    }

    for (const child of node.children || []) walk(child, world);
  };

  for (const root of scene.nodes) walk(root, IDENTITY);
  return { positions, indices, triPhase };
}

/**
 * Weld coincident vertices onto a shared index space.
 *
 * Every mesh in the file is a separate primitive with its own vertex buffer, so
 * without this every panel's edges look like boundary edges and the crease test
 * never sees a second face.
 */
function weld(positions, indices, tolerance) {
  const map = new Map();
  const remap = new Int32Array(positions.length / 3);
  const welded = [];

  for (let i = 0; i < positions.length; i += 3) {
    const key =
      Math.round(positions[i] / tolerance) + '|' +
      Math.round(positions[i + 1] / tolerance) + '|' +
      Math.round(positions[i + 2] / tolerance);

    let at = map.get(key);
    if (at === undefined) {
      at = welded.length / 3;
      map.set(key, at);
      welded.push(positions[i], positions[i + 1], positions[i + 2]);
    }
    remap[i / 3] = at;
  }

  const out = new Int32Array(indices.length);
  for (let i = 0; i < indices.length; i++) out[i] = remap[indices[i]];
  return { positions: Float64Array.from(welded), indices: out };
}

/**
 * Boundary + crease edges of a welded triangle mesh.
 *
 * `triPhase[t / 3]` is the construction phase of triangle `t`; each returned
 * edge is tagged with the phase of whichever triangle touched it first. A
 * crease between two different materials still gets one definite phase this
 * way rather than needing to carry two.
 */
function featureEdges(positions, indices, angleDeg, triPhase) {
  const cosLimit = Math.cos((angleDeg * Math.PI) / 180);
  const stride = positions.length / 3 + 1; // room to pack (lo, hi) into one number

  const firstNormal = new Map(); // edge key -> normal of its first face
  const edgePhase = new Map();   // edge key -> phase of its first face
  const creased = new Set();
  const smooth = new Set();

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    if (a === b || b === c || a === c) continue;

    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const e1x = positions[b * 3] - ax;
    const e1y = positions[b * 3 + 1] - ay;
    const e1z = positions[b * 3 + 2] - az;
    const e2x = positions[c * 3] - ax;
    const e2y = positions[c * 3 + 1] - ay;
    const e2z = positions[c * 3 + 2] - az;

    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue; // zero-area triangle carries no orientation
    nx /= len; ny /= len; nz /= len;
    const phase = triPhase[t / 3];

    for (let e = 0; e < 3; e++) {
      const p = e === 0 ? a : e === 1 ? b : c;
      const q = e === 0 ? b : e === 1 ? c : a;
      const lo = p < q ? p : q;
      const key = lo * stride + (p < q ? q : p);

      const seen = firstNormal.get(key);
      if (seen === undefined) {
        firstNormal.set(key, [nx, ny, nz]);
        edgePhase.set(key, phase);
      } else if (!creased.has(key)) {
        const dot = seen[0] * nx + seen[1] * ny + seen[2] * nz;
        if (dot < cosLimit) creased.add(key);
        else smooth.add(key);
      }
    }
  }

  // An edge that was never paired is a boundary edge and always counts.
  const edges = [];
  for (const key of firstNormal.keys()) {
    if (smooth.has(key) && !creased.has(key)) continue;
    const lo = Math.floor(key / stride);
    edges.push([lo, key - lo * stride, edgePhase.get(key)]);
  }
  return edges;
}

/* ── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`reading ${path.relative(ROOT, SRC)}`);
  const buf = await readFile(SRC);
  const { json: gltf, bin } = parseGLB(buf);
  const credit = gltf.asset?.extras || {};

  const soup = collectTriangles(gltf, bin, REGION_MIN_X);
  console.log(
    `  ${soup.indices.length / 3} triangles, ${soup.positions.length / 3} vertices ` +
    `(x >= ${REGION_MIN_X}, the FINAL house only)`
  );

  // The bounding box drives both the weld tolerance and the normalisation.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < soup.positions.length; i += 3) {
    if (soup.positions[i] < minX) minX = soup.positions[i];
    if (soup.positions[i] > maxX) maxX = soup.positions[i];
    if (soup.positions[i + 1] < minY) minY = soup.positions[i + 1];
    if (soup.positions[i + 1] > maxY) maxY = soup.positions[i + 1];
    if (soup.positions[i + 2] < minZ) minZ = soup.positions[i + 2];
    if (soup.positions[i + 2] > maxZ) maxZ = soup.positions[i + 2];
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
  console.log(
    `  source bbox ${(maxX - minX).toFixed(2)} x ${(maxY - minY).toFixed(2)} x ` +
    `${(maxZ - minZ).toFixed(2)}`
  );

  const w = weld(soup.positions, soup.indices, diagonal * WELD_TOLERANCE);
  console.log(`  welded to ${w.positions.length / 3} vertices`);

  const edges = featureEdges(w.positions, w.indices, ANGLE_DEG, soup.triPhase);
  console.log(`  ${edges.length} feature edges at ${ANGLE_DEG} degrees`);

  // Decimate longest-first: long edges are structure, short ones are surface
  // detail that only turns to mush at hero scale.
  const ranked = edges.map(([a, b, phase]) => {
    const dx = w.positions[a * 3] - w.positions[b * 3];
    const dy = w.positions[a * 3 + 1] - w.positions[b * 3 + 1];
    const dz = w.positions[a * 3 + 2] - w.positions[b * 3 + 2];
    return { a, b, phase, len: dx * dx + dy * dy + dz * dz };
  });
  ranked.sort((p, q) => q.len - p.len);
  const kept = ranked.slice(0, TARGET_SEGMENTS);
  console.log(`  keeping ${kept.length} segments`);

  const phaseCounts = new Array(PART_PHASES.length).fill(0);
  for (const { phase } of kept) phaseCounts[phase]++;
  PART_PHASES.forEach((p, i) => console.log(`    ${p.name}: ${phaseCounts[i]}`));

  // Normalise: centred on x/z, sitting on y = 0, scaled to TARGET_HEIGHT.
  const scale = TARGET_HEIGHT / (maxY - minY);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const flat = new Float32Array(kept.length * 6);
  let o = 0;
  for (const { a, b } of kept) {
    for (const v of [a, b]) {
      flat[o++] = (w.positions[v * 3] - cx) * scale;
      flat[o++] = (w.positions[v * 3 + 1] - minY) * scale;
      flat[o++] = (w.positions[v * 3 + 2] - cz) * scale;
    }
  }

  // Quantise to int16 over the output bounds. At this scale one step is well
  // under a millimetre, so nothing visible is lost and the payload halves.
  let lo = Infinity, hi = -Infinity;
  for (const v of flat) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const range = hi - lo;
  const quantised = new Int16Array(flat.length);
  for (let i = 0; i < flat.length; i++) {
    quantised[i] = Math.round(((flat[i] - lo) / range) * 65534) - 32767;
  }

  // One byte per segment naming its construction phase, parallel to the
  // position pairs above.
  const phases = Uint8Array.from(kept.map((k) => k.phase));

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, `${NAME}.bin`), Buffer.from(quantised.buffer));
  await writeFile(path.join(OUT_DIR, `${NAME}.parts.bin`), Buffer.from(phases.buffer));
  await writeFile(
    path.join(OUT_DIR, `${NAME}.json`),
    JSON.stringify(
      {
        source: path.basename(SRC),
        credit,
        region: { minX: REGION_MIN_X },
        segments: kept.length,
        angleDeg: ANGLE_DEG,
        // position = value * quantScale + quantOffset
        quantScale: range / 65534,
        quantOffset: lo + range * (32767 / 65534),
        bounds: {
          width: (maxX - minX) * scale,
          height: TARGET_HEIGHT,
          depth: (maxZ - minZ) * scale,
        },
        phases: PART_PHASES.map((p) => p.name),
      },
      null,
      2
    ) + '\n'
  );

  console.log(
    `wrote public/assets/model/${NAME}.bin ` +
    `(${(quantised.byteLength / 1024).toFixed(0)} KB) + ${NAME}.parts.bin + ${NAME}.json`
  );
  if (credit.author) console.log(`  credit: ${credit.title} — ${credit.author}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
