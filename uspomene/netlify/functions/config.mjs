// GET /api/config – javna podešavanja za stranicu gosta (bez tajnih podataka)
import { handle, json, settings } from '../lib/core.mjs'
import { getTables } from '../lib/db.mjs'

export default handle(async () => {
  const tables = await getTables()
  return json({
    maxImageMB: Math.round(settings.maxImageBytes / 1048576),
    maxVideoMB: Math.round(settings.maxVideoBytes / 1048576),
    maxFilesPerBatch: settings.maxFilesPerBatch,
    tables: tables.map(({ id, label }) => ({ id, label })),
  })
}, ['GET'])

export const config = { path: '/api/config' }
