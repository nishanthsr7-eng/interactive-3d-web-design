/** @type {import('tailwindcss').Config} */
export default {
  // Scoped to the wheel island only — the rest of the site is hand-written
  // CSS (public/css/main.css) and never passes through Tailwind.
  content: ['./src/wheel/**/*.{ts,tsx}'],
  // Preflight resets html/body/headings globally, which would fight the
  // main site's own (cursor:none, box-sizing, etc.) — the wheel only needs
  // utility classes, not a second global reset.
  corePlugins: { preflight: false },
  theme: {
    extend: {},
  },
  plugins: [],
};
