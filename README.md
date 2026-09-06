 # VINCI Builders — 3D scrollytelling site
 
**Live:** [vinci-interactive-landing-page.pages.dev](https://vinci-interactive-landing-page.pages.dev)

 A single-page, desktop-targeted site for a fictional Bengaluru construction
 practice. Five sections, one shared WebGL stage, and a React island for the two
 photo components. `public/` is the entire deployable site.

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

`npm run dev` builds both JS bundles once and then serves `public/`. Neither
bundle is committed, so the build has to run at least once before the page will
boot.

| Script | What it does |
| --- | --- |
| `npm run build` | Both bundles below — this is what deploys run |
| `npm run build:site` | `src/site/` + three/gsap/lenis → `public/js/site-bundle.js` |
| `npm run build:wheel` | `src/wheel/` → `public/js/wheel-bundle.js` + `css/wheel-bundle.css` |
| `npm run dev:site` / `dev:wheel` | The same builds in watch mode |
| `npm run dev` | Build both, then serve on port 5173 |
| `npm run serve` | Serve `public/` without rebuilding |

## How it is put together

```
src/
  site/                     the vanilla three.js / GSAP site
    main.js                 boot sequence + all scroll choreography
    core/
      gate.js               desktop-only guard
      scroll.js             Lenis ↔ ScrollTrigger + scroll velocity
      stage.js              the single shared renderer / scene / camera
      cursor.js             custom cursor
    scenes/
      model-wire.js         loads the baked wireframe buffers
      hero-model.js         the hero's glowing line-segment house
    transitions/
      velocity-warp.js      global scroll-velocity distortion shader
    ui/
      sketchbook.js         the page-turning 3D book (canvas + CSS 3D)
      reveal.js             scroll reveals, split-text headlines, hero intro
      form.js               enquiry validation + delivery
  wheel/                    React island — Tailwind + framer-motion
    main.tsx                mounts both components into the vanilla page
    components/ui/
      scattered-polaroids.tsx   Trust: flippable photo cluster
      reveal-slider.tsx         Statement: drag-to-wipe drawing/photo
      photo-chrome.tsx          shared grain / bracket / lightbox chrome
scripts/
  build-model-wire.mjs      GLB → quantised feature-edge buffers (run by hand)
  serve.mjs                 zero-dependency static server
public/                     ← the entire deployable site
  index.html                all section markup
  css/main.css              design tokens and layout (hand-written)
  css/wheel-bundle.css      built from src/wheel/ — gitignored
  js/site-bundle.js         built from src/site/  — gitignored
  js/wheel-bundle.js        built from src/wheel/ — gitignored
  assets/model/             baked hero wireframe (house-wire.bin/.json)
  assets/house/             project photography
  assets/sketchbook/        the book's page images
```

### Two bundles, one page

The page is vanilla three.js and GSAP with a small React island grafted into two
`<div>`s. They share nothing at runtime — no React on the vanilla side, no
three.js on the island side — and are built by two separate Vite configs
(`vite.site.config.ts`, `vite.wheel.config.ts`) that both emit into `public/`.

Rollup sees the whole graph for each, so three ships tree-shaken and minified
(~660 KB, 190 KB gzipped) rather than as the 1.3 MB unminified dev build the
site used to self-host under `public/vendor/`.

### One stage, many acts

There is exactly **one** `WebGLRenderer`, one `Scene` and one
`PerspectiveCamera` for the whole page (`core/stage.js`). Each 3D act registers
a `THREE.Group` and is switched on and off by scroll range. Because the camera
is shared, an act can hand it to the next one and the move reads as a
continuous flight rather than a cut.

In practice only the hero act uses the stage today: it holds the camera from
the top of the page through the sketchbook's arrival, then turns away and fades
out along with the canvas. Trust, Statement and Contact are flat DOM sections
with no 3D backdrop.

### The hero wireframe

The source GLB is a 116 MB Sketchfab presentation board, almost all of it PBR
textures the blueprint never samples, so it is never loaded in the browser.
`scripts/build-model-wire.mjs` extracts feature edges once — boundary edges plus
creases past 32° — and writes a quantised binary of a few hundred KB, with each
edge tagged by construction phase. Re-run it by hand only if the source model
changes:

```bash
node scripts/build-model-wire.mjs path/to/model.glb
```

## The enquiry form

`src/site/ui/form.js` validates fully and delivers via whatever endpoint is set
on the form in markup:

```html
<form id="enquiry-form" data-endpoint="https://formspree.io/f/XXXXXXXX">
```

Any form-to-email service that accepts a JSON `POST` works unchanged — Formspree
and Web3Forms (add its `access_key` as a hidden input) both do.

**With `data-endpoint` empty the form does not claim to have sent anything.** It
opens the visitor's mail client with the brief pre-filled and says so, rather
than showing a thank-you for an enquiry that went nowhere. Netlify Forms is the
one option that needs markup changes instead: it wants a urlencoded POST to the
page's own path plus a hidden `form-name` input.

## Content that is placeholder

Written to be plausible for a Bengaluru practice, but none of it is real:

- All body copy and section narrative
- Studio address, phone and email in `index.html`
- "Est. 2009" and "40+ homes delivered"
- Every photograph — none of these are VINCI projects

## Deploying

`public/` is the entire site, but it is built rather than copied — both bundles
are gitignored, so a host that skips `npm run build` ships a page with no
JavaScript.

Deploys run on **Cloudflare Pages**:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `public` |
| Node version | pinned to 22 by `.nvmrc` |

Headers live in `public/_headers` — the only one of the three host configs
Cloudflare reads. `netlify.toml` and `vercel.json` carry the same caching and
security rules and are kept for `netlify deploy --prod` / `vercel --prod`.

`public/assets/` is committed on purpose. Every host above clones the repo and
then builds, and nothing in the build generates photographs or the baked model
geometry — an uncommitted asset is a 404 in production, not a build error.

## Browser support

Desktop Chromium, Firefox and Safari with WebGL. Below 1024px, on coarse
pointers, or without WebGL, `core/gate.js` replaces the page with a notice —
this was a deliberate scope decision, not an oversight.

`prefers-reduced-motion` is honoured: Lenis's smooth scrolling is handed back to
the browser, the preloader's minimum duration collapses, decorative animation
stops, and `[data-reveal]` elements start visible instead of waiting on an
animation that will not run. The scroll choreography itself remains.

## Design documentation

Every hand-built visual piece — the hero wireframe, the sketchbook, the lamp
glow, the cursor, the wheel's photo components, and so on — is written up
individually, properties and all, in [`docs/DESIGN.md`](docs/DESIGN.md).

## License

MIT © 2026 Nishanth S. See [LICENSE](LICENSE).
