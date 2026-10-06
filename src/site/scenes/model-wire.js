/**
 * Loader for the baked model wireframe.
 *
 * `scripts/build-model-wire.mjs` turns a GLB into feature-edge line segments,
 * quantised to int16 against a bounding box recorded in the sidecar JSON. All
 * that is left at runtime is a fetch and a dequantise — no glTF parser, no
 * GLTFLoader in the vendor bundle, and ~150 KB on the wire instead of 116 MB.
 */

const BASE = 'assets/model/house-wire';

/**
 * @returns {Promise<{positions: Float32Array, meta: object}|null>}
 *   null if the bake is missing or fails to load. The hero then stays an empty
 *   group — there is no procedural fallback — and the rest of the page boots.
 */
export async function loadModelWireframe(base = BASE) {
  try {
    const [meta, buffer] = await Promise.all([
      fetch(`${base}.json`)
        .then(assertOk)
        .then((r) => r.json()),
      fetch(`${base}.bin`)
        .then(assertOk)
        .then((r) => r.arrayBuffer()),
    ]);

    const quantised = new Int16Array(buffer);
    const positions = new Float32Array(quantised.length);
    for (let i = 0; i < quantised.length; i++) {
      positions[i] = quantised[i] * meta.quantScale + meta.quantOffset;
    }

    return { positions, meta };
  } catch (err) {
    console.warn('[model-wire] bake failed to load, hero left empty:', err.message);
    return null;
  }
}

function assertOk(res) {
  if (!res.ok) throw new Error(`${res.status} ${res.url}`);
  return res;
}
