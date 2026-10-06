/**
 * Production build: public/ + both Vite bundles -> dist/.
 *
 * public/ holds the hand-written page and its static assets. Both bundles are
 * emitted with content-hashed names (site-[hash].js, wheel-[hash].js,
 * wheel-[hash].css) so hosts can cache them forever; this script then swaps
 * the stable names index.html refers to for the hashed ones.
 */

import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

await rm(DIST, { recursive: true, force: true });
await cp(path.join(ROOT, 'public'), DIST, { recursive: true });

for (const config of ['vite.site.config.ts', 'vite.wheel.config.ts']) {
  await build({ configFile: path.join(ROOT, config), logLevel: 'warn' });
}

/** The single file in dist/<dir> matching prefix-*.ext */
async function hashed(dir, prefix, ext) {
  const files = (await readdir(path.join(DIST, dir))).filter(
    (f) => f.startsWith(`${prefix}-`) && f.endsWith(ext)
  );
  if (files.length !== 1) throw new Error(`expected one ${dir}/${prefix}-*${ext}, got ${files}`);
  return `/${dir}/${files[0]}`;
}

const swaps = {
  '/js/site-bundle.js': await hashed('js', 'site', '.js'),
  '/js/wheel-bundle.js': await hashed('js', 'wheel', '.js'),
  '/css/wheel-bundle.css': await hashed('css', 'wheel', '.css'),
};

const htmlPath = path.join(DIST, 'index.html');
let html = await readFile(htmlPath, 'utf8');
for (const [from, to] of Object.entries(swaps)) {
  if (!html.includes(from)) throw new Error(`index.html no longer references ${from}`);
  html = html.replaceAll(from, to);
}
await writeFile(htmlPath, html);

for (const [from, to] of Object.entries(swaps)) console.log(`  ${from} -> ${to}`);
console.log('Built dist/');
