// Cloudflare R2 (S3-kompatibilna pohrana) – JEDAN PRIVATNI bucket.
// Ništa u njemu nije javno: gost dobija kratkotrajne potpisane linkove
//  - za upload: samo za tačnu putanju, tačnu veličinu i tačan tip datoteke,
//  - za pregled: samo za ODOBRENE fotografije i videe (izdaje ih /api/gallery).
import { AwsClient, AwsV4Signer } from 'aws4fetch'
import { HttpError, env } from './core.mjs'

function cfg() {
  const accountId = env('R2_ACCOUNT_ID')
  // Bucket napravljen s jurisdikcijom "European Union" ima posebnu adresu (.eu.)
  const jurisdiction = env('R2_JURISDICTION').toLowerCase() === 'eu' ? '.eu' : ''
  const endpoint = env('R2_ENDPOINT', accountId ? `https://${accountId}${jurisdiction}.r2.cloudflarestorage.com` : '').replace(/\/$/, '')
  return {
    endpoint,
    bucket: env('R2_BUCKET'),
    creds: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      service: 's3',
      region: env('R2_REGION', 'auto'),
    },
  }
}

export const r2Configured = () => {
  const c = cfg()
  return Boolean(c.endpoint && c.bucket && c.creds.accessKeyId && c.creds.secretAccessKey)
}

function base() {
  const c = cfg()
  if (!r2Configured()) {
    throw new HttpError(503, 'Pohrana nije podešena (nedostaju R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID ili R2_SECRET_ACCESS_KEY).')
  }
  return c
}

const objectUrl = (c, key) =>
  `${c.endpoint}/${c.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`

async function presign(method, key, { expires, headers = {}, query = {}, datetime } = {}) {
  const c = base()
  const url = new URL(objectUrl(c, key))
  url.searchParams.set('X-Amz-Expires', String(expires))
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const signer = new AwsV4Signer({ ...c.creds, method, url: url.toString(), headers, signQuery: true, allHeaders: true, datetime })
  return (await signer.sign()).url.toString()
}

// Upload: potpisani su i tip i TAČNA veličina – drugačija datoteka se odbija.
export const presignPut = (key, contentType, size) =>
  presign('PUT', key, {
    expires: 2 * 3600,
    headers: { 'content-type': contentType, 'content-length': String(size) },
  })

// Pregled: vrijeme potpisa se zaokružuje na sat, pa isti link vrijedi za više
// posjeta i preglednik ga može keširati. Link važi 6–7 sati.
export function presignView(key) {
  const hour = new Date(Math.floor(Date.now() / 3600_000) * 3600_000)
  const datetime = hour.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return presign('GET', key, { expires: 7 * 3600, datetime })
}

// Preuzimanje originala (samo administratori)
export const presignDownload = (key, filename) =>
  presign('GET', key, {
    expires: 6 * 3600,
    query: {
      'response-content-disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })

let client
const aws = () => {
  const c = base()
  client ??= new AwsClient(c.creds)
  return { c, aws: client }
}

export async function headObject(key) {
  const { c, aws: a } = aws()
  const res = await a.fetch(objectUrl(c, key), { method: 'HEAD' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 HEAD ${res.status}`)
  return { size: Number(res.headers.get('content-length')), type: res.headers.get('content-type') }
}

export async function readHead(key, length = 64) {
  const { c, aws: a } = aws()
  const res = await a.fetch(objectUrl(c, key), { headers: { range: `bytes=0-${length - 1}` } })
  if (!res.ok) throw new Error(`R2 GET ${res.status}`)
  return new Uint8Array(await res.arrayBuffer()).subarray(0, length)
}

export async function deleteObjects(keys) {
  const { c, aws: a } = aws()
  await Promise.all(
    keys.filter(Boolean).map(async (key) => {
      const res = await a.fetch(objectUrl(c, key), { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`)
    }),
  )
}

// Provjera veze s bucketom (za administratorski pregled sistema)
export async function checkBucket() {
  const { c, aws: a } = aws()
  const res = await a.fetch(`${c.endpoint}/${c.bucket}?list-type=2&max-keys=1`)
  return { ok: res.ok, status: res.status }
}

// Anonimni pristup MORA biti odbijen (provjera da bucket nije slučajno javan)
export async function checkAnonymousDenied() {
  const c = base()
  const res = await fetch(`${c.endpoint}/${c.bucket}?list-type=2&max-keys=1`)
  return res.status === 401 || res.status === 403 || res.status === 400
}
