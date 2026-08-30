import * as React from "react"
import { animate, useMotionValue } from "framer-motion"

/**
 * Cursor-tracked box tilt + a highlight that follows the cursor — the same
 * "viewer moves their head" trick the sketchbook uses, kept small (±14deg)
 * so it reads as weight, not a gimmick. Shared by the wheel and the stack so
 * both photo boxes react to the cursor identically.
 */
export function useTiltShine(boxRef: React.RefObject<HTMLElement>, reduced: boolean | null) {
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const shineX = useMotionValue(0)
  const shineY = useMotionValue(0)
  const shineOpacity = useMotionValue(0)
  const tiltSpring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 140, damping: 16, mass: 0.6 }

  const onPointerEnter = React.useCallback(() => {
    if (!reduced) animate(shineOpacity, 1, { duration: 0.25 })
  }, [reduced, shineOpacity])

  const onPointerLeave = React.useCallback(() => {
    if (reduced) return
    animate(tiltX, 0, tiltSpring)
    animate(tiltY, 0, tiltSpring)
    animate(shineOpacity, 0, { duration: 0.3 })
    // `tiltSpring` is a literal derived from `reduced`, already a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, tiltX, tiltY, shineOpacity])

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (reduced) return
      const r = boxRef.current?.getBoundingClientRect()
      if (!r) return
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      const nx = px / r.width - 0.5
      const ny = py / r.height - 0.5
      animate(tiltX, ny * -14, tiltSpring)
      animate(tiltY, nx * 14, tiltSpring)
      shineX.set(px)
      shineY.set(py)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [reduced, boxRef, tiltX, tiltY, shineX, shineY]
  )

  return { tiltX, tiltY, shineX, shineY, shineOpacity, onPointerEnter, onPointerLeave, onPointerMove }
}
