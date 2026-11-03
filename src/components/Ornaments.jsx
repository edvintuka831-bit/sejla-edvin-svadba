// Ručno crtani zlatni ukrasi (SVG) – bez vanjskih slika, brzo učitavanje.

const LEAF = 'M0 0 C 7 -9, 22 -10, 30 0 C 22 10, 7 9, 0 0 Z'

function Leaf({ x, y, r, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={LEAF} fill="url(#leafFill)" stroke="url(#goldStroke)" strokeWidth="0.9" />
      <path d="M2 0 L27 0" stroke="url(#goldStroke)" strokeWidth="0.6" opacity="0.7" />
    </g>
  )
}

function Bloom({ x, y, s = 1 }) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {petals.map((a) => (
        <ellipse key={`o${a}`} cx="0" cy="-13" rx="8" ry="13" transform={`rotate(${a})`}
          fill="url(#petalFill)" stroke="url(#goldStroke)" strokeWidth="0.8" />
      ))}
      {petals.map((a) => (
        <ellipse key={`i${a}`} cx="0" cy="-7" rx="4.5" ry="8" transform={`rotate(${a + 22.5})`}
          fill="url(#petalInner)" stroke="url(#goldStroke)" strokeWidth="0.6" />
      ))}
      <circle r="4.2" fill="url(#goldFill)" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={`d${a}`} cx="0" cy="-6.5" r="0.9" fill="#b8924a" transform={`rotate(${a})`} />
      ))}
    </g>
  )
}

// Bijela ruža: slojevi latica oko spiralnog srca.
function Rose({ x, y, s = 1 }) {
  const outer = [0, 72, 144, 216, 288]
  const mid = [36, 108, 180, 252, 324]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {outer.map((a) => (
        <path key={`o${a}`} d="M0 0 C -14 -6, -16 -22, 0 -24 C 16 -22, 14 -6, 0 0 Z" transform={`rotate(${a})`}
          fill="url(#roseOuter)" stroke="url(#goldStroke)" strokeWidth="0.8" />
      ))}
      {mid.map((a) => (
        <path key={`m${a}`} d="M0 0 C -10 -4, -11 -15, 0 -16 C 11 -15, 10 -4, 0 0 Z" transform={`rotate(${a})`}
          fill="url(#roseInner)" stroke="url(#goldStroke)" strokeWidth="0.7" />
      ))}
      <circle r="8.5" fill="url(#roseInner)" stroke="url(#goldStroke)" strokeWidth="0.7" />
      <path d="M-1 1 C -5 -1, -4 -6, 1 -6 C 6 -6, 7 0, 3 3 C -1 6, -8 4, -8 -1 C -8 -7, -2 -10, 4 -9"
        fill="none" stroke="url(#goldStroke)" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  )
}

function Bud({ x, y, r }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 0 C -5 -6, -4 -14, 0 -18 C 4 -14, 5 -6, 0 0 Z" fill="url(#petalFill)" stroke="url(#goldStroke)" strokeWidth="0.8" />
      <path d="M0 0 C -3 -4, -6 -6, -7 -9 M0 0 C 3 -4, 6 -6, 7 -9" stroke="url(#goldStroke)" strokeWidth="0.8" fill="none" />
    </g>
  )
}

// Zajedničke definicije gradijenata – renderuju se jednom u App.
export function OrnamentDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6cf98" />
          <stop offset="0.5" stopColor="#b8924a" />
          <stop offset="1" stopColor="#d9bd7e" />
        </linearGradient>
        <linearGradient id="goldFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3e2b3" />
          <stop offset="0.55" stopColor="#c9a55e" />
          <stop offset="1" stopColor="#9c7a37" />
        </linearGradient>
        <radialGradient id="petalFill" cx="0.5" cy="0.8" r="0.9">
          <stop offset="0" stopColor="#f6e6dc" />
          <stop offset="0.6" stopColor="#fbf3ea" />
          <stop offset="1" stopColor="#fffaf3" />
        </radialGradient>
        <radialGradient id="petalInner" cx="0.5" cy="0.9" r="0.9">
          <stop offset="0" stopColor="#efd3c3" />
          <stop offset="1" stopColor="#f9ece2" />
        </radialGradient>
        <radialGradient id="roseOuter" cx="0.5" cy="0.95" r="1">
          <stop offset="0" stopColor="#f3e8dc" />
          <stop offset="0.55" stopColor="#fffdf9" />
          <stop offset="1" stopColor="#ffffff" />
        </radialGradient>
        <radialGradient id="roseInner" cx="0.5" cy="0.9" r="0.9">
          <stop offset="0" stopColor="#ecdccb" />
          <stop offset="1" stopColor="#fffaf4" />
        </radialGradient>
        <linearGradient id="leafFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9dcc0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f6efe0" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function FloralCorner({ className = '' }) {
  return (
    <svg className={`floral ${className}`} viewBox="0 0 220 220" aria-hidden="true" focusable="false">
      <path d="M2 218 C 24 170, 44 128, 92 98 S 170 52, 216 4" fill="none" stroke="url(#goldStroke)" strokeWidth="1.4" />
      <path d="M40 150 C 20 130, 14 108, 18 86" fill="none" stroke="url(#goldStroke)" strokeWidth="1" />
      <path d="M140 58 C 150 36, 168 22, 190 18" fill="none" stroke="url(#goldStroke)" strokeWidth="1" />
      <path d="M92 98 C 70 80, 58 58, 60 30" fill="none" stroke="url(#goldStroke)" strokeWidth="1" />
      <Leaf x={22} y={180} r={-80} s={1} />
      <Leaf x={30} y={160} r={-20} s={0.9} />
      <Leaf x={52} y={132} r={-110} s={0.95} />
      <Leaf x={62} y={120} r={-30} s={1.05} />
      <Leaf x={120} y={74} r={-120} s={0.9} />
      <Leaf x={130} y={68} r={-35} s={1} />
      <Leaf x={168} y={36} r={-140} s={0.8} />
      <Leaf x={176} y={30} r={-40} s={0.85} />
      <Leaf x={18} y={110} r={-95} s={0.7} />
      <Leaf x={64} y={60} r={-75} s={0.75} />
      <Bud x={18} y={88} r={-10} />
      <Bud x={60} y={32} r={8} />
      <Bud x={190} y={18} r={70} />
      <Rose x={92} y={98} s={1.25} />
      <Rose x={40} y={150} s={0.75} />
      <Bloom x={146} y={56} s={0.62} />
      {[[110, 130], [126, 116], [80, 150], [170, 80], [50, 190], [196, 50]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="#c9a55e" opacity="0.8" />
      ))}
    </svg>
  )
}

export function Divider({ className = '' }) {
  return (
    <svg className={`divider ${className}`} viewBox="0 0 320 30" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fadeL" x1="0" x2="1">
          <stop offset="0" stopColor="#b8924a" stopOpacity="0" />
          <stop offset="1" stopColor="#b8924a" />
        </linearGradient>
        <linearGradient id="fadeR" x1="1" x2="0">
          <stop offset="0" stopColor="#b8924a" stopOpacity="0" />
          <stop offset="1" stopColor="#b8924a" />
        </linearGradient>
      </defs>
      <path d="M0 15 H120" stroke="url(#fadeL)" strokeWidth="1" />
      <path d="M200 15 H320" stroke="url(#fadeR)" strokeWidth="1" />
      <path d="M120 15 C 130 4, 142 4, 146 12 C 149 18, 141 20, 139 15" fill="none" stroke="url(#goldStroke)" strokeWidth="1.2" />
      <path d="M200 15 C 190 4, 178 4, 174 12 C 171 18, 179 20, 181 15" fill="none" stroke="url(#goldStroke)" strokeWidth="1.2" />
      <path d="M120 15 C 130 26, 142 26, 146 18" fill="none" stroke="url(#goldStroke)" strokeWidth="0.8" />
      <path d="M200 15 C 190 26, 178 26, 174 18" fill="none" stroke="url(#goldStroke)" strokeWidth="0.8" />
      <path d="M160 5 L168 15 L160 25 L152 15 Z" fill="url(#goldFill)" />
      <circle cx="160" cy="15" r="2" fill="#fffaf0" />
      <circle cx="148" cy="15" r="1.4" fill="#b8924a" />
      <circle cx="172" cy="15" r="1.4" fill="#b8924a" />
    </svg>
  )
}

// Nepravilan rub voštanog pečata (deterministički generisan).
function sealPath(cx, cy, r, bumps = 18) {
  const pts = []
  const steps = bumps * 4
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const wobble = Math.sin(a * bumps) * 2.4 + Math.sin(a * 5 + 1.3) * 1.6 + Math.cos(a * 3) * 1.1
    const rr = r + wobble
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + ' Z'
}
const SEAL_EDGE = sealPath(60, 60, 54)

export function WaxSeal({ initials }) {
  return (
    <svg viewBox="0 0 120 120" className="seal-svg" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="waxBody" cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#f7e7b9" />
          <stop offset="0.35" stopColor="#d8b56c" />
          <stop offset="0.75" stopColor="#a8823c" />
          <stop offset="1" stopColor="#7d5e25" />
        </radialGradient>
        <radialGradient id="waxInner" cx="0.6" cy="0.7" r="0.75">
          <stop offset="0" stopColor="#e3c47f" />
          <stop offset="0.7" stopColor="#b89049" />
          <stop offset="1" stopColor="#8f6c2c" />
        </radialGradient>
        <linearGradient id="waxText" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f3810" />
          <stop offset="1" stopColor="#6b4f1c" />
        </linearGradient>
      </defs>
      <path d={SEAL_EDGE} fill="url(#waxBody)" />
      <circle cx="60" cy="60" r="41" fill="url(#waxInner)" />
      <circle cx="60" cy="60" r="41" fill="none" stroke="#f3dfa8" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx="60" cy="60" r="37" fill="none" stroke="#7a5b22" strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="1.5 2.5" />
      <text x="60" y="73.2" textAnchor="middle" className="seal-initials" fill="#fbe9b8" opacity="0.7">{initials}</text>
      <text x="60" y="72" textAnchor="middle" className="seal-initials" fill="url(#waxText)">{initials}</text>
      <ellipse cx="30" cy="30" rx="8" ry="3.5" fill="#fff6dc" opacity="0.4" transform="rotate(-40 30 30)" />
    </svg>
  )
}

export function Monogram({ className = '' }) {
  return (
    <div className={`monogram ${className}`} aria-hidden="true">
      <span>Š</span>
      <i>&amp;</i>
      <span>E</span>
    </div>
  )
}
