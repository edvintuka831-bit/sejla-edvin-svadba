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

export async function getJson(path) {
  let res
  try {
    res = await fetch(path, { headers: { accept: 'application/json' } })
  } catch {
    throw new ApiError('Nema internet veze. Provjerite mrežu i pokušajte ponovo.', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error || `Greška na serveru (${res.status}).`, res.status)
  return data
}

export async function getConfig() {
  try {
    return await getJson('/api/config')
  } catch {
    return null
  }
}

// Upload direktno u privatnu pohranu (Cloudflare R2) preko potpisanog linka, s napretkom.
// Link prihvata samo tačnu veličinu i tip koji je server odobrio.
export function putSigned(url, blob, contentType, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', contentType)
    xhr.timeout = 60 * 60 * 1000
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      reject(new ApiError(xhr.status === 403 ? 'Link za slanje je istekao ili datoteka ne odgovara. Pokušajte ponovo.' : `Slanje nije uspjelo (${xhr.status}).`, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('Veza je prekinuta tokom slanja. Pokušajte ponovo.', 0))
    xhr.ontimeout = () => reject(new ApiError('Slanje traje predugo. Pokušajte na boljoj mreži (Wi-Fi).', 0))
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.onabort = () => reject(new ApiError('Slanje je prekinuto.', 0))
    xhr.send(blob)
  })
}
