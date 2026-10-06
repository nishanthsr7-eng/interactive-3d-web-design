# Design decisions

This document records the key technical decisions behind the site: what was
chosen, why it was the right call for this project, and what it costs. Each
trade-off was accepted deliberately.

---

## 1. Desktop-first, with a gated experience

**Decision.** The site runs only on screens at least 1024px wide, with a fine
pointer and WebGL support. Every other device sees a notice with a short
looping preview of the experience (`src/site/core/gate.js`).

**Rationale.** The experience is built around a real-time 3D scene,
scroll-driven camera movement and precise drag interactions. Each of these
depends on screen space, GPU headroom and a mouse or trackpad. A responsive
version would not be a smaller copy of the same design; it would be a different
product. Shipping one experience done well was preferred over two done
partially.

**Trade-off.** Phone visitors see a preview rather than the live site. A
purpose-built mobile experience is the first item on the roadmap.

---

## 2. A vanilla core with an isolated React island

**Decision.** The page is built on vanilla three.js and GSAP (`src/site/`). The
two photo components are a self-contained React island (`src/wheel/`) mounted
into two placeholder elements. Each half has its own build and shares no code
at runtime.

**Rationale.** The 3D stage and scroll choreography are imperative by nature
and gain nothing from a component framework. The photo components, by
contrast, are state-driven UI where React and framer-motion are the right
tools. Separating the two lets each part use the approach that suits it,
without either carrying the other's overhead.

**Trade-off.** Two build configurations to maintain, and React (about 97 KB
gzipped) is loaded for two components.

---

## 3. Pre-processing the 3D model offline

**Decision.** The source model is a 116 MB file, almost entirely textures. A
one-time script (`scripts/build-model-wire.mjs`) reduces it to its feature
edges: outlines plus any crease sharper than 32°. Positions are compressed to
16-bit integers, and every edge is tagged with a construction phase:
foundation, walls, framing, roof, mechanical and props.

**Rationale.** The hero renders the house as a line drawing, so textures and a
full model loader would be wasted weight. Moving the work to build time
reduces the download to roughly 170 KB of geometry (13,000 line segments). The
phase tags turn a technical optimisation into a storytelling device: the
house assembles in the order it would be built.

**Trade-off.** Any change to the model requires re-running the script. If the
processed file fails to load, the hero renders empty; there is no fallback.

---

## 4. A single shared 3D stage

**Decision.** The whole page uses one renderer, one scene and one camera
(`src/site/core/stage.js`). Each 3D section registers as an "act" that scroll
position switches on and off.

**Rationale.** Browsers cap the number of active WebGL contexts, and every
additional context costs memory. A shared stage avoids both problems and lets
the camera move continuously from one act to the next, so transitions read as
a single unbroken shot rather than a series of cuts.

**Trade-off.** Only the hero uses the stage today, so the architecture is more
general than the current page strictly needs. It is in place for future acts.

---

## 5. Content-hashed bundles with long-lived caching

**Decision.** The build (`scripts/build.mjs`) copies `public/` into `dist/`,
emits both bundles with a content hash in the filename, and updates
`index.html` to reference them. JavaScript is then cached for a year as
immutable (`public/_headers`).

**Rationale.** With fixed filenames, browsers must re-check every bundle on
every visit, or risk running stale code after a deploy. Hashed filenames
remove that tension: each build produces new URLs, so returning visitors load
from cache and still receive updates the moment they ship.

**Trade-off.** The page only runs from `dist/` after a build, because
`index.html` in `public/` references placeholder names.

---

## 6. Static form delivery through Web3Forms

**Decision.** The enquiry form posts directly to Web3Forms, configured in the
markup. If no endpoint is set, it opens the visitor's email client with the
enquiry already filled in.

**Rationale.** A form service keeps the site fully static: no server to run,
secure or pay for, and no dependency on a particular host. The fallback
guarantees the form never confirms a message that was not actually sent.

**Trade-off.** Delivery depends on a third-party service, and its public access
key is visible in the page source. That is how the service is designed to work
and does not expose anything sensitive.
