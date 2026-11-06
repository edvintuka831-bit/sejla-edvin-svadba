// GET /api/limits – ograničenja koja prikazuje stranica za goste (bez tajnih podataka)
import { settings } from '../lib/core.mjs'

export default async () =>
  new Response(
    JSON.stringify({
      maxImageMB: Math.round(settings.maxImageBytes / 1048576),
      maxVideoMB: Math.round(settings.maxVideoBytes / 1048576),
      maxFilesPerBatch: settings.maxFilesPerBatch,
      configured: Boolean(settings.supabaseUrl && settings.secretKey),
    }),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } },
  )

export const config = { path: '/api/limits' }
