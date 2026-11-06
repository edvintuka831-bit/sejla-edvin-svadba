import { supabase } from '../lib/supabase.js'
import { postJson } from '../lib/api.js'

export const MEDIA_COLUMNS =
  'id, kind, status, guest_name, caption, original_name, mime_type, size_bytes, width, height, duration_seconds, original_path, preview_path, thumb_path, created_at, completed_at, reviewed_at'

const WEB_IMAGES = ['image/jpeg', 'image/png', 'image/webp']

// Putanja u privatnom bucketu koja se koristi za sličicu / veliki pregled
export const thumbSource = (m) => m.thumb_path || m.preview_path || (WEB_IMAGES.includes(m.mime_type) ? m.original_path : null)
export const previewSource = (m) =>
  m.kind === 'video' ? m.original_path : m.preview_path || (WEB_IMAGES.includes(m.mime_type) ? m.original_path : null)

export async function signMany(paths, expiresIn = 3600) {
  const unique = [...new Set(paths.filter(Boolean))]
  const out = {}
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await supabase.storage.from('uploads').createSignedUrls(unique.slice(i, i + 100), expiresIn)
    if (error) throw error
    for (const d of data) if (d.signedUrl) out[d.path] = d.signedUrl
  }
  return out
}

export async function signOne(path, download) {
  const { data, error } = await supabase.storage
    .from('uploads')
    .createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}

async function token() {
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('Prijava je istekla. Prijavite se ponovo.')
  return t
}

// Radnje se šalju u manjim dijelovima (serverska funkcija ima vremensko ograničenje)
export async function adminAction(action, ids, onProgress) {
  const results = {}
  const step = action.startsWith('wish-') ? 50 : 8
  for (let i = 0; i < ids.length; i += step) {
    const res = await postJson('/api/admin', { action, ids: ids.slice(i, i + step) }, { authorization: `Bearer ${await token()}` })
    Object.assign(results, res.results)
    onProgress?.(Math.min(ids.length, i + step), ids.length)
  }
  return results
}

export function safeName(s, max = 60) {
  return (
    String(s || '')
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, max) || 'gost'
  )
}

export function downloadName(m) {
  const ext = m.original_path.split('.').pop()
  const base = safeName(m.original_name.replace(/\.[^.]+$/, ''), 50)
  return `${safeName(m.guest_name, 30)}_${base}.${ext}`
}
