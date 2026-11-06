import { SUPABASE_KEY, SUPABASE_URL } from './config.js'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function postJson(path, body, headers = {}) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Nema internet veze. Provjerite mrežu i pokušajte ponovo.', 0)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* npr. 404 kada serverske funkcije nisu objavljene */
  }
  if (!res.ok) {
    const fallback =
      res.status === 404
        ? 'Serverske funkcije nisu dostupne. Stranica mora biti objavljena preko GitHub veze na Netlifyju.'
        : `Greška na serveru (${res.status}). Pokušajte ponovo.`
    throw new ApiError(data?.error || fallback, res.status)
  }
  return data
}

export async function getLimits() {
  try {
    const res = await fetch('/api/limits')
    if (res.ok) return await res.json()
  } catch {
    /* koriste se zadana ograničenja */
  }
  return null
}

// Upload direktno u Supabase Storage preko jednokratnog potpisanog linka (s napretkom).
export function putSigned(target, blob, contentType, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const path = target.path.split('/').map(encodeURIComponent).join('/')
    xhr.open('PUT', `${SUPABASE_URL}/storage/v1/object/upload/sign/uploads/${path}?token=${encodeURIComponent(target.token)}`)
    xhr.setRequestHeader('apikey', SUPABASE_KEY)
    xhr.setRequestHeader('authorization', `Bearer ${SUPABASE_KEY}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.setRequestHeader('content-type', contentType)
    xhr.timeout = 15 * 60 * 1000
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = `Slanje nije uspjelo (${xhr.status}).`
      try {
        const body = JSON.parse(xhr.responseText)
        if (/size|large/i.test(body.message || body.error || '')) msg = 'Datoteka je prevelika za server.'
        else if (/mime|type/i.test(body.message || body.error || '')) msg = 'Format datoteke nije dozvoljen.'
      } catch {
        /* zadržava se opća poruka */
      }
      reject(new ApiError(msg, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Veza je prekinuta tokom slanja. Pokušajte ponovo.', 0))
    xhr.ontimeout = () => reject(new ApiError('Slanje traje predugo. Pokušajte na boljoj mreži (Wi-Fi).', 0))
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.onabort = () => reject(new ApiError('Slanje je prekinuto.', 0))
    xhr.send(blob)
  })
}
