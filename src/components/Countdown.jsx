import { GATHERING_DATE } from '../config.js'
import { useCountdown } from '../hooks/useCountdown.js'

const pad = (n) => String(n).padStart(2, '0')
const plural = (n, one, few, many) => {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return one
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few
  return many
}

export default function Countdown() {
  const { days, hours, minutes, seconds, done } = useCountdown(GATHERING_DATE)
  if (done) return <p className="countdown-done">Danas je naš dan! Vidimo se u 11:00.</p>
  const cells = [
    [days, plural(days, 'dan', 'dana', 'dana')],
    [pad(hours), plural(hours, 'sat', 'sata', 'sati')],
    [pad(minutes), plural(minutes, 'minuta', 'minute', 'minuta')],
    [pad(seconds), plural(seconds, 'sekunda', 'sekunde', 'sekundi')],
  ]
  return (
    <div className="countdown" role="timer" aria-label={`Do okupljanja: ${days} dana, ${hours} sati, ${minutes} minuta`}>
      {cells.map(([v, l]) => (
        <div className="cd-cell" key={l + v}>
          <span className="cd-num">{v}</span>
          <span className="cd-label">{l}</span>
        </div>
      ))}
    </div>
  )
}
