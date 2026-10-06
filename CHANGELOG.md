# Changelog

## v1.0.0 — 2026-10-06

First release.

### Site

- Hero with a glowing wireframe house that assembles in construction order and
  turns away as you scroll, drawn from a model baked down to its feature edges.
- Page-turning 3D sketchbook with drag and arrow-key page turns and a
  magnifier.
- Scattered polaroid photo wall and a drag-to-reveal drawing/photo slider,
  built as a small React island.
- Scroll-driven lamp glow, custom cursor, split-text reveals and smooth
  scrolling.
- Enquiry form with validation, delivered through Web3Forms, with a mail-client
  fallback when no endpoint is set.
- Desktop-only gate. Phones see a notice with a looping preview video.
- `prefers-reduced-motion` support.

### Engineering

- Two Vite builds into `dist/` with content-hashed bundles and long-lived
  caching.
- ESLint, Prettier and type-checking across both halves of the codebase.
- Vitest unit tests for the form rules and the wireframe loader.
- GitHub Actions CI running lint, format check, typecheck, tests and the build
  on every push and pull request.
- Deployed on Cloudflare Pages.
