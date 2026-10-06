// Shared visual chrome for the site's photo boxes: film grain, pulsing
// corner brackets, and a click-to-expand lightbox. Photos render
// true-color — no accent tint anywhere in this chrome (an earlier pass had
// one; removed after it read as discoloring the actual photography rather
// than framing it).
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { BRAND_RED, GRAIN } from '@/lib/constants';
import type { PhotoItem } from '@/lib/types';

export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
      style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
    />
  );
}

const BRACKET_POS = [
  'top-4 left-4 border-t border-l',
  'top-4 right-4 border-t border-r',
  'bottom-4 left-4 border-b border-l',
  'bottom-4 right-4 border-b border-r',
] as const;

/** A viewfinder frame that flashes on every `flashKey` change. */
export function CornerBrackets({ flashKey }: { flashKey: React.Key }) {
  return (
    <div key={flashKey} aria-hidden className="pointer-events-none absolute inset-3">
      {BRACKET_POS.map((pos, i) => (
        <motion.span
          key={i}
          className={cn('absolute h-4 w-4 border-solid', pos)}
          style={{ borderColor: BRAND_RED }}
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: 0.85, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

/** Closes on Escape while `open`. */
export function useLightboxEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

/** Portalled to <body> so it isn't affected by the box's own clipping or
    stacking context. */
export function Lightbox({ item, onClose }: { item: PhotoItem; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.img
          src={item.image}
          alt={item.alt ?? ''}
          className="max-h-[86vh] max-w-[92vw] rounded-sm object-contain shadow-2xl"
          initial={{ scale: 0.92, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 font-mono text-xs uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-white"
        >
          Close ✕
        </button>
        {item.label ? (
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">
            {item.label}
          </p>
        ) : null}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
