// A before/after wipe: drag to reveal how much of the frame shows the real
// photo versus a line-drawing derived from that same photo. One photo, one
// gesture, acting out what this section's own copy already says ("the
// drawing is flat, we build the depth").
//
// The "drawing" layer is not a separate asset: an SVG filter (grayscale ->
// edge-detect convolution -> recolour to brand red, using the edge strength
// itself as the alpha channel) derives it from the exact same <img>, so
// there's never a photo without its line-drawing counterpart and no extra
// files to source or keep in sync.
import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion"

import { cn } from "@/lib/utils"
import { clamp, HALFTONE_DOTS } from "@/lib/constants"
import { useTiltShine } from "@/lib/use-tilt-shine"
import { CornerBrackets, Grain, Lightbox, useLightboxEscape } from "./photo-chrome"

/** How long after a drag/keyboard nudge before scroll retakes control of the wipe. */
const SCROLL_RESUME_IDLE_MS = 1000
/** Wipe range driven by scroll — kept off the 0/100 extremes so it's never fully clipped. */
const SCROLL_WIPE_RANGE: [number, number] = [15, 85]

export interface RevealSliderProps {
  /** Photo URL — used for both the real-photo side and, filtered, the drawing side. */
  image: string
  /** Alt text. @default "" */
  alt?: string
  /**
   * Accessible name for the slider, and the lightbox's title. NOT rendered on
   * the image — pass `caption` for that. Splitting the two stops the visible
   * strip from repeating the <h2> that already sits beside this component.
   */
  label?: string
  /** Optional caption drawn across the bottom of the image. @default undefined */
  caption?: string
  /** Where the wipe starts, 0-100. @default 50 */
  defaultPosition?: number
  /** Extra classes for the box. @default undefined */
  className?: string
}

export function RevealSlider({
  image,
  alt,
  label,
  caption,
  defaultPosition = 50,
  className,
}: RevealSliderProps) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const filterId = React.useId().replace(/:/g, "")
  const reduced = useReducedMotion()
  const wipe = useMotionValue(defaultPosition)
  const [dragging, setDragging] = React.useState(false)
  const [lightboxOpen, setLightboxOpen] = React.useState(false)
  const pointerDown = React.useRef<{ x: number; y: number } | null>(null)
  // Mirrors `dragging` in a ref so the scroll listener (added once, not on
  // every drag start/stop) always reads the current value without going
  // stale — same reasoning as `pointerDown` above.
  const draggingRef = React.useRef(false)
  // Last manual interaction (drag or arrow-key nudge); scroll only drives
  // the wipe once this has been quiet for a bit, so grabbing the handle
  // always wins over the scroll-linked sweep.
  const lastInteractionRef = React.useRef(-Infinity)

  // Bound to motion values, not React state: both update the DOM directly
  // every drag frame without going through a re-render.
  const clipPath = useTransform(wipe, (v) => `inset(0 0 0 ${v}%)`)
  const handleLeft = useTransform(wipe, (v) => `${v}%`)

  const { tiltX, tiltY, onPointerEnter, onPointerLeave, onPointerMove } = useTiltShine(boxRef, reduced)
  useLightboxEscape(lightboxOpen, () => setLightboxOpen(false))

  // aria-valuenow needs to stay accurate for assistive tech without forcing
  // a React re-render on every drag frame — set it straight on the DOM node.
  React.useEffect(() => {
    return wipe.on("change", (v) => {
      boxRef.current?.setAttribute("aria-valuenow", String(Math.round(v)))
    })
  }, [wipe])

  // A one-time invite on load: sweeps the handle a little so the gesture is
  // discoverable without a static hint label competing with the caption.
  // Reads wipe's *current* value rather than the literal defaultPosition, so
  // it plays nicely whether or not scroll-scrub has already moved the handle
  // by the time this fires.
  React.useEffect(() => {
    if (reduced) return
    const t = window.setTimeout(() => {
      const base = wipe.get()
      animate(wipe, [base, base + 14, base - 6, base], {
        duration: 2.2,
        ease: "easeInOut",
        times: [0, 0.4, 0.75, 1],
      })
    }, 900)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll-scrub: while nobody has grabbed the handle recently, the wipe
  // tracks scroll progress through the pinned `#statement` section (the same
  // top/bottom-of-viewport convention the vanilla ScrollTrigger triggers in
  // main.js use), so the drawing-to-photo sweep is guaranteed to play even
  // for visitors who never think to drag. A direct scroll listener is used
  // instead of framer-motion's useScroll, which needs its target ref
  // resolved before its own layout effect runs — `#statement` isn't
  // rendered by this component, so it can only be looked up after mount.
  React.useEffect(() => {
    if (reduced) return
    const section = document.getElementById("statement")
    if (!section) return

    let raf = 0
    const [from, to] = SCROLL_WIPE_RANGE
    const update = () => {
      raf = 0
      if (draggingRef.current || performance.now() - lastInteractionRef.current < SCROLL_RESUME_IDLE_MS) return
      const rect = section.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const progress = total > 0 ? clamp(-rect.top / total, 0, 1) : 0
      wipe.set(from + progress * (to - from))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced, wipe])

  const setFromClientX = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    const pct = ((clientX - r.left) / r.width) * 100
    wipe.set(Math.min(100, Math.max(0, pct)))
  }

  return (
    <div
      ref={boxRef}
      role="slider"
      aria-roledescription="before/after reveal"
      aria-label={label ? `${label} — drag to compare drawing and photo` : "Drag to compare drawing and photo"}
      aria-valuenow={Math.round(defaultPosition)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerEnter={() => onPointerEnter()}
      onPointerLeave={() => onPointerLeave()}
      onPointerDown={(e) => {
        pointerDown.current = { x: e.clientX, y: e.clientY }
        draggingRef.current = true
        setDragging(true)
        setFromClientX(e.clientX)
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        onPointerMove(e)
        if (dragging) setFromClientX(e.clientX)
      }}
      onPointerUp={(e) => {
        draggingRef.current = false
        lastInteractionRef.current = performance.now()
        setDragging(false)
        const d = pointerDown.current
        pointerDown.current = null
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) setLightboxOpen(true)
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        lastInteractionRef.current = performance.now()
        wipe.set(Math.min(100, Math.max(0, wipe.get() + (e.key === "ArrowRight" ? 5 : -5))))
      }}
      className={cn(
        "relative h-full w-full select-none overflow-hidden rounded-[4px] bg-[#0b0c14] cursor-ew-resize",
        "outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-inset",
        className
      )}
      style={{ boxShadow: "0 30px 60px rgba(0,0,0,.5)" }}
    >
      <motion.div className="absolute inset-0" style={{ perspective: 900, rotateX: tiltX, rotateY: tiltY }}>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"
              result="gray"
            />
            <feConvolveMatrix order="3 3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" in="gray" result="edges" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.871  0 0 0 0 0.278  0 0 0 0 0.345  0.7 0.7 0.7 0 0"
              in="edges"
            />
          </filter>
        </svg>

        {/* Drawing side — the whole box, always rendered; the photo wipes in
            on top of it as `wipe` grows. */}
        <div className="absolute inset-0 bg-[#0b0c14]">
          <img src={image} alt="" aria-hidden className="h-full w-full object-cover" style={{ filter: `url(#${filterId})` }} />
        </div>

        {/* Photo side — clipped to reveal only up to the handle. */}
        <motion.div className="absolute inset-0 overflow-hidden" style={{ clipPath }}>
          <img src={image} alt={alt ?? ""} draggable={false} className="h-full w-full object-cover" />
        </motion.div>

        {/* Halftone seam — a soft, feathered band of print-style dots riding
            the handle, so the boundary reads as reprographics (the drawing
            being "printed" into the photo) rather than a hard clip edge. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-7 -translate-x-1/2 mix-blend-screen opacity-70"
          style={{
            left: handleLeft,
            backgroundImage: HALFTONE_DOTS,
            backgroundSize: "9px 9px",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 35%, black 65%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 35%, black 65%, transparent)",
          }}
        />

        {/* Handle */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-white/70" style={{ left: handleLeft }}>
          <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0b0c14]/80 text-white/80">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
              <path d="M4 1 1 5l3 4M8 1l3 4-3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </motion.div>
      </motion.div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15" />
      <Grain />
      <CornerBrackets flashKey="reveal" />

      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
        Drawing
      </div>
      <div className="pointer-events-none absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
        Built
      </div>

      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/85">{caption}</p>
        </div>
      ) : null}

      {lightboxOpen ? <Lightbox item={{ image, alt, label }} onClose={() => setLightboxOpen(false)} /> : null}
    </div>
  )
}
