import * as React from "react"
import { createRoot } from "react-dom/client"

import { ScatteredPolaroids, type PolaroidPhoto } from "./components/ui/scattered-polaroids"
import { RevealSlider } from "./components/ui/reveal-slider"
import "./index.css"

// Exterior-leaning: ultra-modern glass/steel houses with visible tech touches
// (automated louvre screens, night lighting). Mix of freshly sourced photos
// (tech-*) and photos already vetted for the earlier wheel (delivered-*).
const TRUST_PHOTOS: PolaroidPhoto[] = [
  { src: "/assets/house/hightech/tech-01.jpg", alt: "House with automated perforated louvre screens" },
  { src: "/assets/house/hightech/tech-02.jpg", alt: "Modern black and timber house exterior" },
  { src: "/assets/house/wheel/delivered-01.jpg", alt: "Modern house exterior with a timber-clad extension, dusk" },
  { src: "/assets/house/wheel/delivered-02.jpg", alt: "Modern villa exterior with a lap pool" },
  { src: "/assets/house/wheel/delivered-03.jpg", alt: "Modern house exterior with a rooftop pool" },
  { src: "/assets/house/wheel/delivered-04.jpg", alt: "Modern house exterior with an infinity-edge pool" },
  { src: "/assets/house/wheel/delivered-06.jpg", alt: "Modern house exterior with timber and white cladding" },
]

const trustEl = document.getElementById("trust-reveal")
if (trustEl) {
  createRoot(trustEl).render(
    <React.StrictMode>
      <ScatteredPolaroids
        photos={TRUST_PHOTOS}
        label="Design-led construction · Bengaluru"
        hint="Hover a photo to preview · click to flip"
      />
    </React.StrictMode>
  )
}

// Statement reverted back to the before/after drawing-vs-photo wipe (the
// revolving filmstrip didn't fit here per feedback) — same single interior
// photo it used before.
const statementEl = document.getElementById("statement-reveal")
if (statementEl) {
  createRoot(statementEl).render(
    <React.StrictMode>
      {/* `label` is the accessible name only — it is not drawn on the image.
          The visible caption used to repeat the <h2> directly beside it word
          for word; the "Drawing" / "Built" corner labels already say what the
          two halves are. */}
      <RevealSlider
        image="/assets/house/stack/depth-01.jpg"
        alt="Interior with a floating staircase against a concrete wall"
        label="The drawing is flat. We build the depth."
      />
    </React.StrictMode>
  )
}
