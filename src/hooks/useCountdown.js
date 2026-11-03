import { useEffect, useState } from 'react'

// Računa se iz stvarnog vremena (Date.now) prema apsolutnom trenutku, pa je tačno u svakoj vremenskoj zoni.
function diff(target) {
  const ms = Math.max(0, target.getTime() - Date.now())
  const s = Math.floor(ms / 1000)
  return {
    done: ms === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

export function useCountdown(target) {
  const [left, setLeft] = useState(() => diff(target))
  useEffect(() => {
    const tick = () => setLeft(diff(target))
    const id = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [target])
  return left
}
