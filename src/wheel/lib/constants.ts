export const BRAND_RED = "#DE4758"

/* Film grain, as a self-contained SVG so nothing needs an asset file. */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/* A small tileable print-halftone dot grid, brand-red — sits at the
   RevealSlider's wipe seam so the boundary reads as reprographics (the
   drawing being "printed" into the photo) rather than a hard knife-edge. */
export const HALFTONE_DOTS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9'%3E%3Ccircle cx='4.5' cy='4.5' r='1.3' fill='%23DE4758'/%3E%3C/svg%3E\")"

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
export const wrap = (n: number, len: number) => ((n % len) + len) % len
