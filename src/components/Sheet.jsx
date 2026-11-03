import { useEffect } from 'react'
import Icon from './Icons.jsx'

// Donji panel (bottom sheet) na mobitelu, centrirani dijalog na računaru.
export default function Sheet({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="Zatvori"><Icon name="close" size={20} /></button>
        <h3 className="sheet-title">{title}</h3>
        {children}
      </div>
    </div>
  )
}
