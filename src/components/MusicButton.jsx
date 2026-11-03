import { MUSIC } from '../config.js'
import Icon from './Icons.jsx'

// Dugme za uključivanje/isključivanje muzike (Zdravko Čolić – Jedina).
export default function MusicControls({ music }) {
  const { available, playing, blocked, missing, toggle } = music
  if (missing && !available) return null

  if (blocked && !playing) {
    return (
      <button type="button" className="music-pill" onClick={toggle}>
        <Icon name="music" size={20} /> Pusti našu pjesmu
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`music-btn ${playing ? 'is-playing' : ''}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? `Isključi muziku (${MUSIC.title})` : `Uključi muziku (${MUSIC.title})`}
      title={playing ? 'Isključi muziku' : 'Uključi muziku'}
    >
      <Icon name={playing ? 'music' : 'musicOff'} size={22} />
      {playing && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
    </button>
  )
}
