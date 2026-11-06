// Romantični detalji: zlatni ukrasi, monogram i lagano padajuće latice/iskre.
export function Flourish({ className = '' }) {
  return (
    <svg className={`flourish ${className}`} viewBox="0 0 240 24" aria-hidden="true">
      <path d="M4 12h86M150 12h86" stroke="url(#fl-g)" strokeWidth="1" />
      <path d="M120 3c-5 5-11 9-20 9 9 0 15 4 20 9 5-5 11-9 20-9-9 0-15-4-20-9z" fill="url(#fl-g)" opacity=".9" />
      <circle cx="96" cy="12" r="2" fill="url(#fl-g)" />
      <circle cx="144" cy="12" r="2" fill="url(#fl-g)" />
      <defs>
        <linearGradient id="fl-g" x1="0" x2="1">
          <stop offset="0" stopColor="#b8924a" stopOpacity="0" />
          <stop offset=".3" stopColor="#c9a55e" />
          <stop offset=".5" stopColor="#ecd59d" />
          <stop offset=".7" stopColor="#b8924a" />
          <stop offset="1" stopColor="#8a672b" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Monogram() {
  return (
    <div className="monogram" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id="mono-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1deb0" />
            <stop offset=".45" stopColor="#c9a55e" />
            <stop offset="1" stopColor="#8a672b" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="56" fill="none" stroke="url(#mono-g)" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#mono-g)" strokeWidth=".6" strokeDasharray="1.5 4" />
        <path d="M60 6c3 4 3 8 0 12-3-4-3-8 0-12zM60 102c3 4 3 8 0 12-3-4-3-8 0-12z" fill="url(#mono-g)" />
      </svg>
      <span>Š<em>&amp;</em>E</span>
    </div>
  )
}

const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 73) % 100,
  delay: (i * 1.7) % 12,
  duration: 13 + ((i * 5) % 9),
  size: 8 + ((i * 7) % 9),
  sparkle: i % 3 === 0,
}))

export function Petals() {
  return (
    <div className="petals" aria-hidden="true">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className={p.sparkle ? 'sparkle' : 'petal'}
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: p.size,
            height: p.sparkle ? p.size / 2 : p.size,
          }}
        />
      ))}
    </div>
  )
}
