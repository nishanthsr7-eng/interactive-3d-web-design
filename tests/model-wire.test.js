import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadModelWireframe } from '../src/site/scenes/model-wire.js';

const ok = (body) => ({ ok: true, status: 200, url: 'x', ...body });

afterEach(() => vi.unstubAllGlobals());

describe('loadModelWireframe', () => {
  it('dequantises int16 positions with the sidecar scale and offset', async () => {
    const meta = { quantScale: 0.5, quantOffset: 10 };
    const quantised = new Int16Array([0, 2, -4]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('.json')
          ? ok({ json: async () => meta })
          : ok({ arrayBuffer: async () => quantised.buffer })
      )
    );

    const result = await loadModelWireframe('model');
    expect(result.meta).toEqual(meta);
    expect(Array.from(result.positions)).toEqual([10, 11, 8]);
  });

  it('returns null when the bake is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, url: 'model.bin' }))
    );
    expect(await loadModelWireframe('model')).toBeNull();
  });
});
