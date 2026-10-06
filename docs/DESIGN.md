# Design reference

Every hand-built piece of this page, written up on its own: what it is, how it
is built, and the exact numbers behind it. For the code layout and build
system, see the main [README](../README.md); this file is about the *design*,
not the tooling.

Screenshots are in [`docs/screenshots/`](screenshots/), captured from a real
run of the page at 1600×900.

---

## Visual language

Everything on the page reads off one small token set, defined at the top of
[`public/css/main.css`](../public/css/main.css):

| Token | Value | Used for |
| --- | --- | --- |
| `--ink` | `#000000` | Page background |
| `--ink-2` | `#0b0c14` | Card/panel surfaces (reveal slider, cursor label) |
| `--ink-3` | `#14151d` | Slightly-raised surfaces |
| `--bone` | `#F4F4F6` | Primary text |
| `--bone-dim` | `rgba(244,244,246,.62)` | Secondary text |
| `--bone-faint` | `rgba(244,244,246,.34)` | Tertiary/disabled text |
| `--red` | `#DE4758` | The one accent — links, focus rings, glow, brackets |
| `--red-hover` | `#CF2D3B` | Accent hover state |
| `--line` / `--line-soft` | `rgba(244,244,246,.12)` / `.06` | Hairline dividers |
| `--f-ui` | `Inter` | Every UI/body typeface — the whole page chrome |
| `--ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | The page's default "settle" easing |

Two typefaces exist outside `--f-ui`, and both are scoped to one place only:
**Instrument Serif** (display) and **Newsreader** (body), used exclusively by
the sketchbook's canvas-drawn pages (`src/site/ui/sketchbook.js`) — nowhere
else on the page sets them. All three families load from Google Fonts in
`index.html`.

Design language throughout is deliberately restrained: near-black ground,
off-white type, exactly one accent color, weight-contrast for emphasis instead
of color, and bracket-wrapped text links (`[ like this ]`) instead of filled
buttons.

---

## Hero — wireframe house

![Hero](screenshots/01-hero.png)

A single glowing rose-line-segment house (`src/site/scenes/hero-model.js`),
not a shaded render — literally a blueprint. It's the "Make your own steampunk house"
model by [Conrad Justin](https://sketchfab.com/ConradJustin), reduced from a 116 MB Sketchfab GLB to its feature edges by
`scripts/build-model-wire.mjs` (boundary edges + creases past 32°, quantised
to int16 — about 150 KB on the wire instead of 116 MB), then drawn with
`THREE.LineSegments` and additive blending.

**Properties**

| Property | Value |
| --- | --- |
| Line color | `#DE4758` (rose), additive blending, `depthWrite: false` |
| Camera rest | position `[2.0, 5.6, 31]`, look-at `[3.6, 2.4, 0]` |
| Camera intro start | position `[13.9, 1.6, 5.5]`, look-at `[13.5, 3.0, 0]` |
| Intro duration | 3.2s, `power2.inOut`, camera position + look-at tweened together |
| Model group | positioned `[13.5, -1.6, 0]`, scaled `1.3×` |
| Bloom (initial) | strength `0.04` at load, ramped down to `0.02` by the time the model exits |

**The floor grid** is a `THREE.GridHelper` (120 units, 60 divisions) with a
custom shader: lines fade to fully transparent by 42 units of view-distance
(depth cueing), and dim to nothing in a 6-unit radius around the cursor's
projected position on the ground plane — the grid visibly "extinguishes"
where you point.

**The dust** is 240 additively-blended `THREE.Points`, drifting upward inside
a 26×15×20 unit box and wrapping every 14 units of travel, each twinkling at
its own phase. They scatter away from the cursor's ground projection within a
5-unit radius (a `smoothstep` repulsion in the vertex shader) — "disturbing
dust in the air."

**Scroll takeover**: as `#hero` scrolls by (`scrub: 1.1`), the camera
continues forward past its rest position toward a wider pull-back, then a
second trigger (`#sketchbook`, `top 105%` → `top 5%`) carries it into a
close-up arrival at the model (0–51% of that range) before the model turns
~63° away, shrinks to 40% scale, and fades out together with the whole
canvas (51–100%) — see `wireTimeline()` in `src/site/main.js` for the exact
lerps.

---

## Scroll engine

Not a visible design element on its own, but everything else on the page
depends on it. `src/site/core/scroll.js` wires **Lenis** (smooth-scroll) into
**GSAP ScrollTrigger**.

| Property | Value |
| --- | --- |
| Lenis duration | 1.1s |
| Lenis easing | `1.001 - 2^(-10t)` (custom expo-out) |
| Wheel multiplier | 0.9 |
| Touch multiplier | 1.5 |
| `gsap.ticker.lagSmoothing` | `0` (disabled — a paused tab jumps tweens to their end rather than lurching) |
| Velocity smoothing | `velocity += (v - velocity) * 0.25` per tick, decayed `× 0.92` toward rest |
| `prefers-reduced-motion` | `smoothWheel` disabled — scrolling hands back to the browser natively, Lenis stays in place only for `scrollTo()` |

**Velocity-warp shader** (`src/site/transitions/velocity-warp.js`) is a
full-screen post-process pass reading that same velocity: a barrel pinch that
grows with scroll speed, chromatic separation along the scroll axis
(`shift = velocity × 0.016`), a cheap 5-tap directional smear, and a matching
vignette — so fast scrolling has physical weight instead of feeling free and
weightless. At rest (`intensity < 0.001`) it's a pure pass-through.

---

## Custom cursor

`src/site/core/cursor.js` — a small ring + dot that lags behind the real
pointer, with a label that appears over anything tagged `data-cursor`.

| Property | Value |
| --- | --- |
| Dot follow | `duration: 0.12`, ease `power3` |
| Ring/label follow | `duration: 0.42`, ease `power3` |
| Modes | `link`, `hotspot`, `drag` — set via `data-cursor` on the target element |
| Keyboard fallback | First `Tab` press restores the native cursor and hides the ring (`.is-keyboard`); moving the mouse again reverts it |

`cursor: none` is set globally on interactive elements while the custom ring
is active, so this is a full cursor replacement, not an addition.

---

## The sketchbook

![Sketchbook — a settled spread](screenshots/03-sketchbook-spread.png)
![Sketchbook — the opening riffle](screenshots/02-sketchbook-riffle.png)

The centerpiece: a real page-turning book (`src/site/ui/sketchbook.js`) on
VINCI's dark ground.

**How a page-turn is actually built**: the turning leaf is not one flat panel
on a hinge. It's a chain of **18 nested strips**, each carrying a front and
back face (`backface-visibility` does the flip), whose cumulative rotation
sweeps through an arc — so the paper visibly *bends* across its width instead
of pivoting like a door.

| Property | Value |
| --- | --- |
| Strips per turning leaf (`N`) | 18 |
| Peak curl (`BETA`) | 0.6 rad |
| Composited page size | 1300 × 930px (landscape 1.4:1 — an open spread reads 2.8:1, "album" not "book") |
| Book tilt range | ±4.5° (X) / ±7° (Y), cursor-driven, spring-eased (`× 0.14`/tick) |
| Loupe magnification | 2.3× |
| Zoom range | 0.9× – 1.5× (double-click resets to 1×) |
| Sheets drawn per side (stack illusion) | 7 |
| Paper tone | `#f2ede2` → `#e4ddce` gradient, plus 4 procedural noise passes (mottle, laid/chain lines, rag fibres, specks) |
| Turn commit threshold | past 42% dragged, or a flick velocity > 1.1 |
| Opening riffle | flicks through all 8 plates in well under a second on load, each step 0.05–0.17s (bell curve, slowest in the middle) |

**The loupe** (magnifying glass) holds a second, independent copy of the book
—cloned DOM, not a shared transform — so tilting the book never drags the
glass with it, and the copy fades out as the glass wanders off the page edge.
It's opt-in (a toolbar toggle), parked at the lower-right at rest.

**Page content** lives in the `SPREADS` array at the top of the file — swap
images/captions there; everything downstream (compositing, layout, the loupe)
is unaware of the specific content.

---

## Lamp glow (Sketchbook → Trust → Statement)

One continuous radial-gradient glow (`#lamp-glow` in `main.css`, driven by
`src/site/ui/lamp-glow.js`) that appears to swing into place behind the photo
sections like a lamp, rather than being dragged there in a straight line.

| Property | Value |
| --- | --- |
| Path | Quadratic Bézier, control points at `x:[50,84,60]` `y:[92,86,48]` (% of viewport) |
| Grow-in trigger | `#sketchbook`, `bottom 120%` → `bottom 0%`, eased `1-(1-p)²` |
| Fade-out trigger | `#statement`, `bottom 65%` → `bottom top`, linear |
| Motion spring | independent rAF loop, `state += (target - state) × 0.07` per frame — always trails scroll by a beat rather than snapping to it |
| Scale range | 0.45 → 1.0 |

---

## Trust — the scattered polaroids

![Trust wall at rest](screenshots/04-trust-wall.png)
![Trust wall, hovering one photo](screenshots/05-trust-wall-hover.png)

`src/wheel/components/ui/scattered-polaroids.tsx` — a React/framer-motion
component mounted into `#trust-reveal`. Seven project photos, hand-placed
(not runtime-randomized) at their own angle and overlap, framed like physical
Polaroid prints.

| Property | Value |
| --- | --- |
| Photo count / positions | 7 fixed slots (`SLOTS` array): rotation −8° to +8°, width 30–40% |
| Rest state | full grayscale (`grayscale(1)`) |
| Hover | desaturates to color over 0.5s, `easeOut`, **plus** a 0.7s SVG `feDisplacementMap` ripple (turbulence-driven) that peaks at frame 35% — "a Polaroid physically developing," not a plain cross-fade |
| Hover transform | straightens to 0° rotation, scales to 1.09×, lifts −12px, `zIndex: 30` |
| Click | flips 180° on the Y axis (spring: stiffness 220, damping 22) to reveal a caption on the back |
| Reduced motion | grayscale/color swap is instant; no ripple, no flip spring easing |

---

## Statement — the drawing/photo reveal slider

![Statement reveal slider](screenshots/06-statement-reveal.png)

`src/wheel/components/ui/reveal-slider.tsx`, mounted into `#statement-reveal`
— a single interior photo, wiped between "the drawing" and "the built photo,"
acting out the section's own copy ("the drawing is flat, we build the
depth").

The drawing is **not a separate asset** — it's the same `<img>` run through
an SVG filter chain: grayscale → 3×3 edge-detect convolution
(`kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1"`) → recolored to the brand red
using edge strength as alpha. One photo can never drift out of sync with its
own line-drawing.

| Property | Value |
| --- | --- |
| Wipe control | drag, arrow keys (±5%), or scroll (once idle 1000ms after the last manual interaction) |
| Scroll-driven range | 15%–85% (kept off the extremes so it's never fully clipped) |
| Load-in invite | one auto-sweep at +900ms: `base → +14 → −6 → base` over 2.2s, so the gesture is discoverable |
| Seam treatment | a soft halftone-dot band (brand-red `HALFTONE_DOTS`, 9×9px tile) rides the handle — "reprographics," not a hard clip edge |
| Tilt | cursor-tracked, ±14° (shared `useTiltShine` hook — see below) |
| Interaction | click (without a drag) opens a full-screen lightbox |

---

## Shared photo chrome

`src/wheel/components/ui/photo-chrome.tsx` — reused by both wheel photo
components, so Trust and Statement's photo boxes read as one system:

- **Grain**: an inline SVG `feTurbulence` noise texture, `mix-blend-mode:
  overlay`, opacity 0.16, tiled 160×160px.
- **Corner brackets**: four small L-shaped brackets that flash in
  (`opacity 0→0.85`, `scale 1.6→1`, 0.5s custom cubic-bezier) whenever their
  `flashKey` changes — a "viewfinder" cue.
- **Lightbox**: portalled to `<body>` (escapes any clipping/stacking
  context), spring-in (stiffness 260, damping 26), closes on `Escape` or
  backdrop click.
- **`useTiltShine`** (`src/wheel/lib/use-tilt-shine.ts`): the shared
  cursor-follow tilt for both photo boxes — ±14°, spring `stiffness: 140,
  damping: 16, mass: 0.6` — the same "the viewer moves their head" idea the
  sketchbook uses independently, at a smaller scale.

---

## Enquiry form

![Contact / enquiry](screenshots/07-contact-form.png)

`src/site/ui/form.js` — validates client-side, then delivers via whatever
`data-endpoint` is set on `<form id="enquiry-form">` in `index.html` (see the
README's "The enquiry form" section for the delivery contract). Currently
wired to Web3Forms.

| Property | Value |
| --- | --- |
| Validation timing | on blur first, then live on every keystroke once a field is marked invalid |
| Invalid-field animation | `x: -7 → 0`, `elastic.out(1, 0.35)` |
| No endpoint configured | falls back to the visitor's own mail client (`mailto:`) rather than claiming a submission was sent |
| Success state | button label → "Sent", auto-reverts after 2.2s; form fades to 35% opacity and back during reset |

---

## Reveals & headline choreography

`src/site/ui/reveal.js` — the generic pattern for anything tagged
`[data-reveal]`: fade + rise (`autoAlpha`, `y: 0`, 0.95s, `power3.out`),
triggered once at `top 88%` of viewport.

Trust and Statement's headlines get an extra, more specific treatment on top
of that block-level reveal:

- **Kicker** (small caps label): per-character rise with overshoot
  (`back.out(2)`, 0.5s, staggered 0.02s) — reads like a split-flap board
  resolving one character at a time.
- **`<h2>`**: per-word blur-to-focus (`blur(9px)→0`, `scale 1.05→1`, 0.9s,
  staggered 0.055s) — a literal read of "the drawing is flat, we build the
  depth."

The hero's own copy animates on load, not on scroll (`revealHero()`):
title lines start at `letter-spacing: 0.4em` and snap to `-0.04em` with a
`back.out(1.6)` overshoot — reads as a mechanical assembly, not a fade.

---

## Desktop gate & reduced motion

`src/site/core/gate.js` blocks the experience below **1024px width**, on any
coarse/touch pointer, or without WebGL — replaced with a plain notice rather
than a degraded page. This is a deliberate scope decision (confirmed
directly with the client), not an oversight; mobile/touch layouts were never
part of this build.

`prefers-reduced-motion: reduce` is honoured throughout: Lenis smoothing
disables, the preloader's minimum duration collapses to 300ms, decorative
loops (dust, ripples, riffle) stop outright, and `[data-reveal]` elements
start visible instead of waiting on animations that will never run. The
*scroll choreography itself* (camera moves, section transitions) still
plays — only the purely decorative motion is suppressed.

---

## Screenshot index

| File | Shows |
| --- | --- |
| `01-hero.png` | Hero, post fly-through-intro |
| `02-sketchbook-riffle.png` | The opening riffle mid-flight (intentionally shows motion blur) |
| `03-sketchbook-spread.png` | The book settled on its first spread |
| `04-trust-wall.png` | Trust wall at rest (grayscale) |
| `05-trust-wall-hover.png` | Trust wall, one photo hovered (color reveal) |
| `06-statement-reveal.png` | Statement's drawing/photo wipe, mid-position |
| `07-contact-form.png` | The enquiry form |

Captured with a scripted headless Chromium pass at 1600×900 against a local
`npm run dev` build — not committed as a recurring process, just a one-off
capture for this doc.
