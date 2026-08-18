import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the main (vanilla) site — src/site/main.js plus three, gsap and
// lenis — into one minified, tree-shaken IIFE at public/js/site-bundle.js.
//
// This replaces the old hand-vendored public/vendor/ + <script type="importmap">
// arrangement, which shipped three's unminified dev build (1.3 MB) and every
// gsap module whole. Rollup now sees the whole graph and drops what the site
// never imports, which is most of three.
export default defineConfig({
  // public/ is this build's output dir, not a source of static assets to copy
  // into itself — same reason as vite.wheel.config.ts.
  publicDir: false,
  resolve: {
    alias: [
      // The site's own imports use three's documented "three/addons/" prefix;
      // that alias normally comes from an import map, so map it here instead.
      { find: /^three\/addons\//, replacement: 'three/examples/jsm/' },
    ],
  },
  build: {
    outDir: 'public',
    emptyOutDir: false,
    target: 'es2020',
    // Everything below the desktop gate has WebGL2 and a modern engine, so
    // there is no legacy target to hold the bundle back.
    rollupOptions: {
      input: path.resolve(__dirname, 'src/site/main.js'),
      output: {
        format: 'iife',
        entryFileNames: 'js/site-bundle.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
