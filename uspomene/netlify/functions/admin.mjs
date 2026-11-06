// /api/admin/* – administracija (samo Šejla i Edvin)
import { HttpError, ID_RE, clientHash, cleanName, handle, json, readJson, settings } from '../lib/core.mjs'
import { ADMINS, configStatus, currentAdmin, login, logoutCookie, requireAdmin } from '../lib/auth.mjs'
import { del, galleryIds, galleryKeys, getJSON, getMany, getTables, getUsage, idsWithStatus, listKeys, revTime, setJSON, setMarker, setStatus, tableApprovedKey, tableKey, usageKey } from '../lib/db.mjs'
import { checkAnonymousDenied, checkBucket, deleteObjects, presignDownload, presignView, r2Configured } from '../lib/r2.mjs'

const GB = 1024 ** 3
const PAGE = 48
const STATUSES = ['pending', 'approved', 'rejected']
const BROWSER_IMAGES = ['image/png', 'image/webp']

function downloadName(rec) {
  const ext = rec.originalKey.split('.').pop()
  const safe = (s, n) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, '_').slice(0, n) || 'gost'
  const table = rec.tableLabel ? `${safe(rec.tableLabel, 20)}_` : ''
  return `${table}${safe(rec.guestName, 30)}_${safe(rec.originalName.replace(/\.[^.]+$/, ''), 40)}.${ext}`
}

async function withViewUrls(rec) {
  const view = rec.kind === 'video' ? rec.originalKey : rec.previewKey || ([...BROWSER_IMAGES, 'image/jpeg'].includes(rec.mimeType) ? rec.originalKey : null)
  return {
    ...rec,
    batchKeyHash: undefined,
    thumbUrl: rec.thumbKey ? await presignView(rec.thumbKey) : rec.previewKey ? await presignView(rec.previewKey) : null,
    viewUrl: view ? await presignView(view) : null,
  }
}

// Šta gost smije vidjeti: kod slike SAMO pregled napravljen u pregledniku (bez EXIF/GPS)
function publicKeys(rec) {
  if (rec.kind === 'video') return { videoKey: rec.originalKey, thumbKey: rec.thumbKey }
  let preview = rec.previewKey
  if (!preview) {
    if (!BROWSER_IMAGES.includes(rec.mimeType)) {
      throw new HttpError(422, `„${rec.originalName}“ nema pregled za galeriju (format ${rec.mimeType}). Original možete preuzeti, ali se ne objavljuje da ne bi otkrio skrivene podatke (npr. lokaciju).`)
    }
    preview = rec.originalKey // PNG/WEBP bez pregleda
  }
  return { previewKey: preview, thumbKey: rec.thumbKey || preview }
}

// ---------------------------------------------------------------- moderacija
// Svaka stavka ima vlastite zapise, pa se Šejla i Edvin ne mogu međusobno pregaziti.

async function unpublish(rec) {
  await Promise.all([...galleryKeys(rec), tableApprovedKey(rec)].map(del))
  rec.galRev = null
  rec.publicKeys = null
}

async function mediaAction(action, ids, admin) {
  const records = await getMany('media', ids)
  const results = {}
  const now = new Date().toISOString()
  await Promise.all(
    records.map(async (rec) => {
      try {
        if (rec.status === 'uploading') throw new HttpError(409, 'Datoteka se još šalje.')
        if (action === 'approve') {
          if (rec.status !== 'approved') {
            rec.publicKeys = publicKeys(rec)
            rec.galRev = revTime()
            Object.assign(rec, { reviewedAt: now, reviewedBy: admin.name })
            await setStatus('media', rec, 'approved')
            await Promise.all([...galleryKeys(rec), tableApprovedKey(rec)].map(setMarker))
          }
        } else if (action === 'reject') {
          await unpublish(rec)
          Object.assign(rec, { reviewedAt: now, reviewedBy: admin.name })
          await setStatus('media', rec, 'rejected')
        } else {
          await unpublish(rec)
          await deleteObjects([rec.originalKey, rec.previewKey, rec.thumbKey])
          await Promise.all([del(`media/${rec.id}`), del(`idx/${rec.status}/${rec.id}`), del(usageKey(rec.id, rec.storedBytes)), del(tableKey(rec))])
        }
        results[rec.id] = { ok: true }
      } catch (err) {
        if (!(err instanceof HttpError)) console.error(action, rec.id, err)
        results[rec.id] = { ok: false, error: err instanceof HttpError ? err.message : 'Radnja nije uspjela. Pokušajte ponovo.' }
      }
    }),
  )
  for (const id of ids) results[id] ??= { ok: false, error: 'Stavka nije pronađena.' }
  return results
}

async function wishAction(action, ids, admin) {
  const records = await getMany('wish', ids)
  const now = new Date().toISOString()
  await Promise.all(
    records.map(async (rec) => {
      if (rec.galRev) await del(`galw/${rec.galRev}-${rec.id}`)
      rec.galRev = null
      if (action === 'wish-delete') {
        await Promise.all([del(`wish/${rec.id}`), del(`widx/${rec.status}/${rec.id}`)])
        return
      }
      Object.assign(rec, { reviewedAt: now, reviewedBy: admin.name })
      if (action === 'wish-approve') rec.galRev = revTime()
      await setStatus('wish', rec, action === 'wish-approve' ? 'approved' : 'rejected')
      if (rec.galRev) await setMarker(`galw/${rec.galRev}-${rec.id}`)
    }),
  )
  const found = new Set(records.map((r) => r.id))
  return Object.fromEntries(ids.map((id) => [id, found.has(id) ? { ok: true } : { ok: false, error: 'Nije pronađeno.' }]))
}

// ---------------------------------------------------------------- stolovi

function validateTables(raw) {
  if (!Array.isArray(raw) || raw.length > 200) throw new HttpError(400, 'Najviše 200 stolova.')
  const seen = new Set()
  return raw.map((t, i) => {
    const id = String(t?.id || '').toLowerCase().trim()
    const label = cleanName(t?.label, 40)
    if (!/^[a-z0-9-]{1,20}$/.test(id)) throw new HttpError(400, `Red ${i + 1}: oznaka u linku smije imati samo mala slova, brojeve i crticu (npr. 7 ili mladenacki).`)
    if (!label) throw new HttpError(400, `Red ${i + 1}: upišite naziv stola.`)
    if (seen.has(id)) throw new HttpError(400, `Oznaka „${id}“ se ponavlja.`)
    seen.add(id)
    return { id, label }
  })
}

// ---------------------------------------------------------------- rute

export default handle(async (req, context) => {
  const url = new URL(req.url)
  const route = url.pathname.replace(/^\/api\/admin\/?/, '')
  const q = (k) => url.searchParams.get(k)

  if (route === 'login' && req.method === 'POST') {
    const body = await readJson(req, 2_000)
    const cookie = await login(req, String(body.admin || ''), String(body.password || ''), clientHash(req, context))
    const id = String(body.admin)
    return json({ ok: true, admin: { id, name: ADMINS[id].name } }, 200, { 'set-cookie': cookie })
  }
  if (route === 'logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': logoutCookie(req) })
  }
  if (route === 'me' && req.method === 'GET') {
    return json({ admin: currentAdmin(req), configured: configStatus() })
  }

  const admin = requireAdmin(req)

  if (route === 'stats' && req.method === 'GET') {
    const [pending, approved, rejected, wp, wa, wr, usage, photos, videos] = await Promise.all([
      idsWithStatus('idx', 'pending'),
      idsWithStatus('idx', 'approved'),
      idsWithStatus('idx', 'rejected'),
      idsWithStatus('widx', 'pending'),
      idsWithStatus('widx', 'approved'),
      idsWithStatus('widx', 'rejected'),
      getUsage(),
      galleryIds('gal/image'),
      galleryIds('gal/video'),
    ])
    return json({
      pending: pending.length,
      approved: approved.length,
      approvedPhotos: photos.length,
      approvedVideos: videos.length,
      rejected: rejected.length,
      wishes: { pending: wp.length, approved: wa.length, rejected: wr.length },
      usage,
      storageLimitBytes: settings.storageLimitBytes,
    })
  }

  if (route === 'media' && req.method === 'GET') {
    const status = STATUSES.includes(q('status')) ? q('status') : 'pending'
    const kind = q('kind')
    const table = q('table')
    const offset = Math.max(0, Number(q('offset')) || 0)
    let ids = await idsWithStatus('idx', status)
    if (status !== 'pending') ids.reverse() // najnovije prvo
    let records
    let total
    if (kind || table) {
      const all = (await getMany('media', ids)).filter(
        (r) => (!kind || r.kind === kind) && (!table || (table === '-' ? !r.tableId : r.tableId === table)),
      )
      total = all.length
      records = all.slice(offset, offset + PAGE)
    } else {
      total = ids.length
      records = await getMany('media', ids.slice(offset, offset + PAGE))
    }
    return json({ total, items: await Promise.all(records.map(withViewUrls)) })
  }

  if (route === 'action' && req.method === 'POST') {
    const body = await readJson(req)
    const action = String(body.action || '')
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))] : []
    if (!ids.length || ids.length > 50 || !ids.every((id) => ID_RE.test(id))) throw new HttpError(400, 'Neispravan izbor stavki.')
    if (['approve', 'reject', 'delete'].includes(action)) return json({ results: await mediaAction(action, ids, admin) })
    if (['wish-approve', 'wish-reject', 'wish-delete'].includes(action)) return json({ results: await wishAction(action, ids, admin) })
    throw new HttpError(400, 'Nepoznata radnja.')
  }

  if (route === 'wishes' && req.method === 'GET') {
    const status = STATUSES.includes(q('status')) ? q('status') : 'pending'
    const ids = await idsWithStatus('widx', status)
    const records = await getMany('wish', status === 'pending' ? ids.slice(0, 500) : ids.reverse().slice(0, 500))
    return json({ items: records })
  }

  if (route === 'download' && req.method === 'GET') {
    const id = String(q('id') || '')
    if (!ID_RE.test(id)) throw new HttpError(400, 'Neispravan zahtjev.')
    const rec = await getJSON(`media/${id}`)
    if (!rec || rec.status === 'uploading') throw new HttpError(404, 'Datoteka nije pronađena.')
    return json({ url: await presignDownload(rec.originalKey, downloadName(rec)), filename: downloadName(rec) })
  }

  // Kompletna arhiva: spisak svih originala s linkovima za preuzimanje (po 150)
  if (route === 'export' && req.method === 'GET') {
    const scope = q('scope') === 'all' ? STATUSES : ['approved']
    const offset = Math.max(0, Number(q('offset')) || 0)
    const ids = (await Promise.all(scope.map((s) => idsWithStatus('idx', s)))).flat().sort()
    const page = await getMany('media', ids.slice(offset, offset + 150))
    const items = await Promise.all(
      page.map(async (r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        guestName: r.guestName,
        tableLabel: r.tableLabel,
        originalName: r.originalName,
        size: r.size,
        createdAt: r.createdAt,
        filename: downloadName(r),
        url: await presignDownload(r.originalKey, downloadName(r)),
      })),
    )
    let wishes
    if (offset === 0) {
      const wIds = (await Promise.all(scope.map((s) => idsWithStatus('widx', s)))).flat().sort()
      wishes = await getMany('wish', wIds)
    }
    return json({ total: ids.length, items, wishes, more: offset + 150 < ids.length })
  }

  // Pregled po stolovima: koliko je poslano i odobreno sa svakog stola
  if (route === 'table-stats' && req.method === 'GET') {
    const count = (keys) => keys.reduce((m, k) => ((m[k.split('/')[1]] = (m[k.split('/')[1]] || 0) + 1), m), {})
    const [sent, approved] = await Promise.all([listKeys('tbl/'), listKeys('tapp/')])
    return json({ sent: count(sent), approved: count(approved) })
  }

  if (route === 'tables') {
    if (req.method === 'GET') return json({ tables: await getTables() })
    if (req.method === 'PUT') {
      const body = await readJson(req, 30_000)
      const tables = validateTables(body.tables)
      await setJSON('settings/tables', { tables, updatedAt: new Date().toISOString(), updatedBy: admin.name })
      return json({ tables })
    }
  }

  // Provjera sistema prije objave: veza, privatnost bucketa, prijave, prostor i trošak
  if (route === 'system' && req.method === 'GET') {
    const checks = []
    const add = (name, ok, detail) => checks.push({ name, ok, detail })
    const cfg = configStatus()
    add('Šifra za Šejlu (12+ znakova)', cfg.sejla, 'ADMIN_SEJLA_PASSWORD')
    add('Šifra za Edvina (12+ znakova)', cfg.edvin, 'ADMIN_EDVIN_PASSWORD')
    add('Tajni ključ sesije (32+ znaka)', cfg.session, 'SESSION_SECRET')
    add('Cloudflare R2 podešen', r2Configured(), 'R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
    if (r2Configured()) {
      const bucket = await checkBucket().catch((e) => ({ ok: false, status: e.message }))
      add('Veza sa R2 bucketom', bucket.ok, bucket.ok ? 'radi' : `greška ${bucket.status}`)
      const denied = await checkAnonymousDenied().catch(() => false)
      add('Bucket je privatan (anonimni pristup odbijen)', denied, denied ? 'u redu' : 'UPOZORENJE: bucket je javan – isključite Public access')
    }
    const usage = await getUsage()
    const gb = usage.bytes / GB
    const extraGb = Math.max(0, gb - 10)
    const tables = await getTables()
    add('Stolovi definisani', tables.length > 0, `${tables.length} stolova`)
    return json({
      checks,
      usage,
      limits: {
        storageLimitGB: settings.storageLimitBytes / GB,
        maxImageMB: settings.maxImageBytes / 1048576,
        maxVideoMB: settings.maxVideoBytes / 1048576,
        maxFilesPerHour: settings.maxFilesPerHour,
        maxFilesPerDay: settings.maxFilesPerDay,
      },
      cost: {
        storedGB: Math.round(gb * 100) / 100,
        freeGB: 10,
        estimatedMonthlyUSD: Math.round(extraGb * 0.015 * 100) / 100,
      },
    })
  }

  throw new HttpError(404, 'Nije pronađeno.')
}, ['GET', 'POST', 'PUT'])

export const config = { path: ['/api/admin', '/api/admin/*'] }

