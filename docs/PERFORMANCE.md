# Performance

## Lighthouse

Lighthouse 12, desktop preset, run against the live site on 6 October 2026:

| Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- |
| 61 | 96 | 100 | 92 |

| Metric | Value |
| --- | --- |
| First Contentful Paint | 1.2 s |
| Largest Contentful Paint | 2.9 s |
| Total Blocking Time | 160 ms |
| Cumulative Layout Shift | 0.28 |

Scores vary between runs and machines. Treat these as a baseline, not a
guarantee.

## What ships

Sizes from `npm run build`, gzipped with level 9:

| File | Minified | Gzipped |
| --- | --- | --- |
| `js/site-[hash].js` (three.js, GSAP, Lenis, site code) | 667 KB | 189 KB |
| `js/wheel-[hash].js` (React, framer-motion, photo components) | 296 KB | 97 KB |
| `css/main.css` | 53 KB | 15 KB |
| `css/wheel-[hash].css` | 9 KB | 2 KB |

| Assets | Size |
| --- | --- |
| Project photos (`assets/house/`) | 2.3 MB |
| Sketchbook pages (`assets/sketchbook/`) | 476 KB |
| Baked model (`assets/model/`) | 176 KB |
| Phone preview video (`assets/video/`, only loaded on phones) | 1.1 MB |

## What has been optimised

- **Baked model.** The hero loads about 170 KB of quantised edges instead of a
  116 MB model. See [DECISIONS.md](DECISIONS.md#3-pre-processing-the-3d-model-offline).
- **Tree-shaken libraries.** three.js, GSAP and Lenis are bundled by Vite, so
  only the parts the site imports ship. An earlier version loaded three.js's
  unminified 1.3 MB build directly.
- **Long caching.** Bundles have content-hashed names, so `public/_headers`
  caches them for a year. Photos and model files are cached the same way.
- **Preview video only on phones.** The gate sets the video's source only when
  the notice is shown, so desktop visitors never download it.

## What's next

- **Layout shift (CLS 0.28).** The target is under 0.1. The likely causes are
  the preloader and web fonts swapping in. Reserving their space should
  fix most of it, but this has not been profiled yet.
- **Bundle size.** The site bundle is a single 189 KB gzipped file. Splitting
  the hero from the rest would let the first paint happen sooner.
- **Photo weight.** The project photos are 2.3 MB. Serving them as WebP or AVIF
  at the sizes actually displayed would cut that substantially.
