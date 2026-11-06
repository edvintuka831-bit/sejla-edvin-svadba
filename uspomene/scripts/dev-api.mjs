// Lokalni server za serverske funkcije – isti kod kao na Netlifyju.
//  - Netlify Blobs: lokalni BlobsServer (folder .netlify/blobs-local)
//  - Cloudflare R2: bilo koji S3-kompatibilni server (npr. RustFS u Dockeru), vidi README
// Pokretanje: npm run dev:api   (drugi terminal: npm run dev)
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BlobsServer } from '@netlify/blobs/server'

const root = resolve(import.meta.dirname, '..')
for (const file of ['.env.local', '.env']) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const PORT = Number(process.env.API_PORT || 8788)
const BLOBS_PORT = PORT + 1
const token = 'local-dev-token'
const directory = resolve(root, process.env.BLOBS_DIR || '.netlify/blobs-local')
mkdirSync(directory, { recursive: true })
await new BlobsServer({ directory, port: BLOBS_PORT, token }).start()
const edge = `http://127.0.0.1:${BLOBS_PORT}`
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({ edgeURL: edge, uncachedEdgeURL: edge, siteID: 'local-site', token }),
).toString('base64')

const routes = []
for (const name of ['config', 'upload-init', 'upload-complete', 'wish', 'gallery', 'admin']) {
  const mod = await import(resolve(root, 'netlify/functions', `${name}.mjs`))
  for (const p of [mod.config.path].flat()) routes.push([p, mod.default])
}
const match = (path) =>
  routes.find(([p]) => (p.endsWith('/*') ? path.startsWith(p.slice(0, -1)) : path === p))?.[1]

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const fn = match(url.pathname)
  if (!fn) {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Nije pronađeno."}')
    return
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  })
  const response = await fn(request, { ip: req.headers['x-test-ip'] || req.socket.remoteAddress })
  const out = {}
  response.headers.forEach((v, k) => (out[k] = v))
  res.writeHead(response.status, out)
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(PORT, '127.0.0.1', () => console.log(`API: http://127.0.0.1:${PORT}`))
