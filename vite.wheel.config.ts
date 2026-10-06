import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the React island as one self-contained bundle: a single IIFE script
// + CSS file dropped into dist/js and dist/css, mounted into the plain
// <div id="trust-reveal"> and <div id="statement-reveal"> on the otherwise-
// vanilla page. The rest of the site is built separately by
// vite.site.config.ts and shares nothing with this bundle.
export default defineConfig({
  plugins: [react()],
  // public/ is copied into dist/ by scripts/build.mjs, not by Vite, which
  // also points index.html at the hashed bundle names.
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/wheel') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/wheel/main.tsx'),
      output: {
        format: 'iife',
        entryFileNames: 'js/wheel-[hash].js',
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'css/wheel-[hash].css' : 'assets/[name][extname]',
      },
    },
  },
});
