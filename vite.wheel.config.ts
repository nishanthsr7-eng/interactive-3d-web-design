import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the React island as one self-contained bundle: a single IIFE script
// + CSS file dropped into public/js and public/css, mounted into the plain
// <div id="trust-reveal"> and <div id="statement-reveal"> on the otherwise-
// vanilla page. The rest of the site is built separately by
// vite.site.config.ts and shares nothing with this bundle.
export default defineConfig({
  plugins: [react()],
  // public/ is both this build's source of static assets and its output dir;
  // Vite's own "copy publicDir into outDir" step is meaningless here (it'd be
  // copying public/ onto itself) and just prints a warning, so disable it.
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/wheel') },
  },
  build: {
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/wheel/main.tsx'),
      output: {
        format: 'iife',
        entryFileNames: 'js/wheel-bundle.js',
        assetFileNames: (info) =>
          info.name?.endsWith('.css') ? 'css/wheel-bundle.css' : 'assets/[name][extname]',
      },
    },
  },
});
