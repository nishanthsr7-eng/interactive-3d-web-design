// Photos as a loose scatter of physical prints rather than a gridded box —
// each one framed like a Polaroid (thick border, deep caption strip), tossed
// down at its own angle and slightly overlapping its neighbours. Replaces
// the earlier two-column drifting wall: that read as a tidy gallery widget,
// this reads as proof — actual site photos someone dropped on a desk.
//
// Two interactions per tile:
//  - Hover straightens it, lifts it forward, and runs a brief displacement
//    ripple as it desaturates from grayscale to color — a nod to a Polaroid
//    physically developing rather than a filter just switching off.
//  - Click flips it 180° to its back, showing the photo's caption.
import * as React from "react"
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

export interface PolaroidPhoto {
  src: string
  alt?: string
  /** Shown on the flipped-back side. Falls back to `alt`. */
  caption?: string
}

export interface ScatteredPolaroidsProps {
  photos: PolaroidPhoto[]
  /** Caption shown below the scatter. @default undefined */
  label?: string
  /** Smaller interaction hint shown under the caption. @default undefined */
  hint?: string
  /** Extra classes for the outer wrapper. @default undefined */
  className?: string
}

interface Slot {
  top: string
  left: string
  rotate: number
  width: string
  z: number
}

// Hand-arranged rather than randomized at runtime — a deliberate scatter
// (varied position, rotation and size) instead of risking runtime-random
// placements that overlap badly on some viewport.
const SLOTS: Slot[] = [
  { top: "0%", left: "4%", rotate: -8, width: "36%", z: 3 },
  { top: "0%", left: "46%", rotate: 6, width: "40%", z: 2 },
  { top: "28%", left: "0%", rotate: 5, width: "34%", z: 4 },
  { top: "24%", left: "38%", rotate: -5, width: "38%", z: 1 },
  { top: "50%", left: "16%", rotate: 8, width: "34%", z: 5 },
  { top: "52%", left: "50%", rotate: -6, width: "32%", z: 2 },
  { top: "36%", left: "62%", rotate: 3, width: "30%", z: 6 },
]

function PolaroidTile({ photo, slot }: { photo: PolaroidPhoto; slot: Slot }) {
  const reduced = useReducedMotion()
  const [flipped, setFlipped] = React.useState(false)
  const filterId = React.useId().replace(/:/g, "")
  const gray = useMotionValue(1)
  const displace = useMotionValue(0)
  const filterStyle = useMotionTemplate`url(#${filterId}) grayscale(${gray})`

  const onEnter = () => {
    if (reduced) {
      gray.set(0)
      return
    }
    animate(gray, 0, { duration: 0.5, ease: "easeOut" })
    animate(displace, [0, 46, 0], { duration: 0.7, ease: "easeOut", times: [0, 0.35, 1] })
  }
  const onLeave = () => {
    if (reduced) {
      gray.set(1)
      return
    }
    animate(gray, 1, { duration: 0.4, ease: "easeIn" })
  }

  return (
    <motion.button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      onHoverStart={onEnter}
      onHoverEnd={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className="absolute cursor-pointer select-none rounded-[2px] bg-[#eeeadf] p-[9px] pb-[24px] text-left outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      style={{
        top: slot.top,
        left: slot.left,
        width: slot.width,
        zIndex: slot.z,
        rotate: slot.rotate,
        transformStyle: "preserve-3d",
        boxShadow: "0 18px 34px rgba(0,0,0,.55)",
      }}
      whileHover={reduced ? undefined : { rotate: 0, scale: 1.09, y: -12, zIndex: 30 }}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      aria-label={photo.caption ?? photo.alt ?? "Photo — click to flip"}
    >
      {/* Front: the photo, ripple-developing from grayscale on hover. */}
      <div
        className="relative aspect-[4/5] w-full overflow-hidden bg-black"
        style={{ backfaceVisibility: "hidden" }}
      >
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="7" result="noise" />
            <motion.feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              xChannelSelector="R"
              yChannelSelector="G"
              scale={displace}
            />
          </filter>
        </svg>
        <motion.img
          src={photo.src}
          alt={photo.alt ?? ""}
          draggable={false}
          className="h-full w-full object-cover"
          style={{ filter: reduced ? undefined : filterStyle }}
        />
      </div>

      {/* Back: caption, revealed by the flip. */}
      <div
        className="absolute inset-[9px] bottom-[24px] flex items-center justify-center bg-[#eeeadf] p-4 text-center"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <p className="font-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-[#2a2a2a]">
          {photo.caption ?? photo.alt}
        </p>
      </div>
    </motion.button>
  )
}

export function ScatteredPolaroids({ photos, label, hint, className }: ScatteredPolaroidsProps) {
  if (!photos.length) return null

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <div className="relative min-h-0 flex-1">
        {photos.map((p, i) => (
          <PolaroidTile key={i} photo={p} slot={SLOTS[i % SLOTS.length]} />
        ))}
      </div>
      {label || hint ? (
        <div className="pointer-events-none relative z-10 mt-8 space-y-1">
          {label ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">{label}</p>
          ) : null}
          {hint ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">{hint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
