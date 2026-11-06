const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const IconCamera = (p) => (
  <svg {...base} {...p}><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.4l1.2-1.8A1.5 1.5 0 0 1 10.4 3.5h3.2a1.5 1.5 0 0 1 1.3.7L16.1 6h1.4A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12.5" r="3.6" /></svg>
)
export const IconVideo = (p) => (
  <svg {...base} {...p}><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3z" /></svg>
)
export const IconHeart = (p) => (
  <svg {...base} {...p}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" /></svg>
)
export const IconGallery = (p) => (
  <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5-5 3.5 3.5L15 14l5 4.5" /></svg>
)
export const IconCheck = (p) => (
  <svg {...base} strokeWidth={2.2} {...p}><path d="m5 12.5 4.2 4.2L19 7" /></svg>
)
export const IconAlert = (p) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.2" /><path d="M12 17.2v.1" /></svg>
)
export const IconClose = (p) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconPlus = (p) => (
  <svg {...base} strokeWidth={1.8} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconPlay = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M8 5.5v13l11-6.5z" /></svg>
)
export const IconChevron = ({ dir = 'right', ...p }) => (
  <svg {...base} strokeWidth={2} {...p} style={{ transform: dir === 'left' ? 'scaleX(-1)' : undefined }}><path d="m9 5 7 7-7 7" /></svg>
)
export const IconDownload = (p) => (
  <svg {...base} strokeWidth={1.8} {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></svg>
)
export const IconShield = (p) => (
  <svg {...base} {...p}><path d="M12 3 5 6v5.5c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>
)
export const IconRefresh = (p) => (
  <svg {...base} strokeWidth={1.8} {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
)
export const IconTrash = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></svg>
)
