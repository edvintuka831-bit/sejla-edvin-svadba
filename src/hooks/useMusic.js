import { useCallback, useEffect, useRef, useState } from 'react'
import { MUSIC } from '../config.js'

// Muzika se pokreće tek na klik gosta (zahtjev svih mobilnih preglednika).
// available – fajl postoji i može se reproducirati
// blocked   – preglednik je odbio pokretanje; prikazuje se "Pusti našu pjesmu"
// missing   – fajl ne postoji; prikazuje se link na muzički servis
export function useMusic() {
  const audioRef = useRef(null)
  const fadeRef = useRef(0)
  const resumeRef = useRef(false)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    audio.preload = 'none'
    audio.volume = 0
    audioRef.current = audio

    // Pronađi koji od podržanih fajlova postoji, prije nego gost klikne.
    let cancelled = false
    ;(async () => {
      for (const src of MUSIC.sources) {
        try {
          const res = await fetch(src, { method: 'HEAD' })
          const type = res.headers.get('content-type') || ''
          if (res.ok && !type.includes('text/html')) {
            if (!cancelled && !audio.src) audio.src = src
            return
          }
        } catch {
          // probaj sljedeći
        }
      }
      if (!cancelled && audio.paused) setMissing(true)
    })()

    const onReady = () => {
      setAvailable(true)
      setMissing(false)
    }
    const onPlay = () => {
      setPlaying(true)
      setBlocked(false)
    }
    const onPause = () => setPlaying(false)
    const onError = () => {
      setAvailable(false)
      setPlaying(false)
      setBlocked(false)
      setMissing(true)
    }
    audio.addEventListener('canplay', onReady)
    audio.addEventListener('playing', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    const onVisibility = () => {
      if (document.hidden) {
        resumeRef.current = !audio.paused
        audio.pause()
      } else if (resumeRef.current) {
        audio.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      cancelAnimationFrame(fadeRef.current)
      audio.pause()
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('playing', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const fadeIn = (audio) => {
    cancelAnimationFrame(fadeRef.current)
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / 2500))
      audio.volume = MUSIC.volume * t
      if (t < 1) fadeRef.current = requestAnimationFrame(step)
    }
    audio.volume = 0
    fadeRef.current = requestAnimationFrame(step)
  }

  // Mora se pozvati direktno iz klika.
  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    // Ako provjera fajla još traje, kreni s prvim izvorom.
    if (!audio.src) audio.src = MUSIC.sources[0]
    const p = audio.play()
    fadeIn(audio)
    if (p && p.then) {
      p.then(() => {
        setAvailable(true)
        setBlocked(false)
      }).catch((err) => {
        // NotAllowedError = preglednik traži još jedan dodir gosta.
        if (err && err.name === 'NotAllowedError') setBlocked(true)
      })
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) play()
    else audio.pause()
  }, [play])

  return { available, playing, blocked, missing, play, toggle }
}
