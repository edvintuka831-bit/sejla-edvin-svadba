// Lokalni server za razvoj i testiranje: pokreće iste Netlify funkcije (rsvp, admin)
// nad lokalnom Netlify Blobs bazom (folder .netlify/blobs-local). Vite dev server prosljeđuje /api ovdje.
//   ADMIN_PASSWORD=probna-sifra node scripts/dev-api.mjs
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { BlobsServer } from '@netlify/blobs/server'

const PORT = Number(process.env.API_PORT || 8788)
const BLOBS_PORT = PORT + 1
const token = 'local-dev-token'
const directory = process.env.BLOBS_DIR || '.netlify/blobs-local'
mkdirSync(directory, { recursive: true })

const blobs = new BlobsServer({ directory, port: BLOBS_PORT, token })
await blobs.start()
const edge = `http://127.0.0.1:${BLOBS_PORT}`
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({ edgeURL: edge, uncachedEdgeURL: edge, siteID: 'local-site', token }),
).toString('base64')

const rsvp = (await import('../netlify/functions/rsvp.mjs')).default
const admin = (await import('../netlify/functions/admin.mjs')).default

createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const url = `http://${req.headers.host}${req.url}`
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  })
  const path = new URL(url).pathname
  const fn = path === '/api/rsvp' ? rsvp : path.startsWith('/api/admin/') ? admin : null
  const response = fn
    ? await fn(request, { ip: req.socket.remoteAddress })
    : new Response('{"error":"Nije pronađeno."}', { status: 404 })
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(PORT, '127.0.0.1', () => console.log(`API na http://127.0.0.1:${PORT}`))
