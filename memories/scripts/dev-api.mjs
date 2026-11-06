// Lokalni server za serverske funkcije (isti kod kao na Netlifyju).
// Pokretanje: npm run dev:api   (u drugom terminalu: npm run dev)
// Čita varijable iz .env.local (vidi .env.example).
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
for (const file of ['.env.local', '.env']) {
  const path = resolve(root, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const names = ['upload-init', 'upload-complete', 'wish', 'admin', 'limits']
const routes = new Map()
for (const name of names) {
  const mod = await import(resolve(root, 'netlify/functions', `${name}.mjs`))
  routes.set(mod.config.path, mod.default)
}

const port = Number(process.env.API_PORT || 8788)
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const fn = routes.get(url.pathname)
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
  const ip = req.headers['x-test-ip'] || req.socket.remoteAddress
  const response = await fn(request, { ip })
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}).listen(port, '127.0.0.1', () => console.log(`API: http://127.0.0.1:${port}  (${[...routes.keys()].join(', ')})`))
