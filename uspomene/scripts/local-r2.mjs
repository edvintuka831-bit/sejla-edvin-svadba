// Priprema LOKALNOG S3 servera koji glumi Cloudflare R2 (samo za razvoj/testove):
//   docker run -d --name r2local -p 9000:9000 -e RUSTFS_ACCESS_KEY=localkey -e RUSTFS_SECRET_KEY=localsecret123 rustfs/rustfs
//   node scripts/local-r2.mjs
// Pravi bucket i CORS pravilo – isto pravilo se na Cloudflareu unosi ručno (vidi README).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AwsClient } from 'aws4fetch'

const env = {}
for (const line of readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2]
}
const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: env.R2_REGION || 'us-east-1' })
const bucketUrl = `${env.R2_ENDPOINT}/${env.R2_BUCKET}`
console.log('bucket', (await aws.fetch(bucketUrl, { method: 'PUT' })).status)
const origins = ['http://localhost:5173', 'http://localhost:4173']
const cors = `<CORSConfiguration><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join('')}<AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>content-type</AllowedHeader><AllowedHeader>range</AllowedHeader><ExposeHeader>ETag</ExposeHeader><ExposeHeader>Content-Length</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`
console.log('cors', (await aws.fetch(`${bucketUrl}?cors`, { method: 'PUT', body: cors, headers: { 'content-type': 'application/xml' } })).status)
