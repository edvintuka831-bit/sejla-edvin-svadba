const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } })

export const fail = (status, error, headers = {}) => json({ error }, status, headers)

export async function readJson(req, maxBytes = 8_000) {
  const text = await req.text()
  if (text.length > maxBytes) throw new HttpError(413, 'Zahtjev je prevelik.')
  try {
    return JSON.parse(text || '{}')
  } catch {
    throw new HttpError(400, 'Neispravan zahtjev.')
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Sve funkcije vraćaju jasnu grešku umjesto pada.
export const handle = (fn) => async (req, context) => {
  try {
    return await fn(req, context)
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message)
    console.error(err)
    return fail(500, 'Došlo je do greške na serveru. Pokušajte ponovo.')
  }
}
