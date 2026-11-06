// POST /api/admin – moderacija (samo za prijavljene administratore)
// Zahtjev nosi Supabase pristupni token administratora (Authorization: Bearer ...).
// Server provjerava token kod Supabase Autha i da li je korisnik u tabeli admins,
// pa tek onda secret ključem kopira/briše datoteke između bucketa.
import { HttpError, WEB_IMAGE_TYPES, adminClient, handle, json, readJson } from '../lib/core.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 50

async function requireAdmin(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) throw new HttpError(401, 'Niste prijavljeni.')
  const supabase = adminClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, 'Prijava je istekla. Prijavite se ponovo.')
  const { data: admin } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (!admin) throw new HttpError(403, 'Nemate administratorska prava.')
  return data.user
}

function publicPaths(row) {
  return [row.public_preview_path, row.public_thumb_path, row.public_video_path].filter(Boolean)
}

async function copyToGallery(supabase, from, to) {
  const { error } = await supabase.storage
    .from('uploads')
    .copy(from, to, { destinationBucket: 'gallery' })
  if (error && !/exists|duplicate/i.test(error.message)) throw error
}

async function approve(supabase, row, userId) {
  const update = { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId }
  const p = (name) => `${row.id}/${name}`

  if (row.kind === 'image') {
    // U javnu galeriju idu samo pregledi bez EXIF/GPS podataka (napravljeni u pregledniku).
    let source = row.preview_path
    let target = p('preview.jpg')
    if (!source) {
      if (!WEB_IMAGE_TYPES.has(row.mime_type)) {
        throw new HttpError(422, `„${row.original_name}“ nema pregled za galeriju (format ${row.mime_type}). Original možete preuzeti, ali se ne može objaviti.`)
      }
      source = row.original_path
      target = p(row.original_path.split('/').pop())
    }
    await copyToGallery(supabase, source, target)
    update.public_preview_path = target
    if (row.thumb_path) {
      await copyToGallery(supabase, row.thumb_path, p('thumb.jpg'))
      update.public_thumb_path = p('thumb.jpg')
    } else {
      update.public_thumb_path = target
    }
  } else {
    const target = p(row.original_path.split('/').pop().replace('original', 'video'))
    await copyToGallery(supabase, row.original_path, target)
    update.public_video_path = target
    if (row.thumb_path) {
      await copyToGallery(supabase, row.thumb_path, p('poster.jpg'))
      update.public_thumb_path = p('poster.jpg')
    }
  }

  const { error } = await supabase.from('media').update(update).eq('id', row.id)
  if (error) {
    await supabase.storage.from('gallery').remove(publicPaths(update))
    throw error
  }
}

async function unpublish(supabase, row, status, userId) {
  const paths = publicPaths(row)
  if (paths.length) {
    const { error } = await supabase.storage.from('gallery').remove(paths)
    if (error) throw error
  }
  const { error } = await supabase
    .from('media')
    .update({
      status,
      public_preview_path: null,
      public_thumb_path: null,
      public_video_path: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq('id', row.id)
  if (error) throw error
}

async function destroy(supabase, row) {
  const pub = publicPaths(row)
  if (pub.length) {
    const { error } = await supabase.storage.from('gallery').remove(pub)
    if (error) throw error
  }
  const priv = [row.original_path, row.preview_path, row.thumb_path].filter(Boolean)
  const { error: privError } = await supabase.storage.from('uploads').remove(priv)
  if (privError) throw privError
  const { error } = await supabase.from('media').delete().eq('id', row.id)
  if (error) throw error
}

export default handle(async (req) => {
  const user = await requireAdmin(req)
  const body = await readJson(req)
  const action = String(body.action || '')
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))] : []
  if (!ids.length || ids.length > MAX_IDS || !ids.every((id) => UUID.test(id))) {
    throw new HttpError(400, 'Neispravan izbor stavki.')
  }
  const supabase = adminClient()

  // ---- Čestitke
  if (action.startsWith('wish-')) {
    const now = new Date().toISOString()
    let query
    if (action === 'wish-approve' || action === 'wish-reject') {
      query = supabase
        .from('wishes')
        .update({
          status: action === 'wish-approve' ? 'approved' : 'rejected',
          reviewed_at: now,
          reviewed_by: user.id,
        })
        .in('id', ids)
    } else if (action === 'wish-delete') {
      query = supabase.from('wishes').delete().in('id', ids)
    } else {
      throw new HttpError(400, 'Nepoznata radnja.')
    }
    const { error } = await query
    if (error) throw error
    return json({ results: Object.fromEntries(ids.map((id) => [id, { ok: true }])) })
  }

  // ---- Fotografije i videozapisi
  if (!['approve', 'reject', 'delete'].includes(action)) throw new HttpError(400, 'Nepoznata radnja.')
  const { data: rows, error } = await supabase.from('media').select('*').in('id', ids)
  if (error) throw error

  const results = {}
  for (const row of rows) {
    try {
      if (action === 'approve') {
        if (row.status === 'uploading') throw new HttpError(409, 'Datoteka se još šalje.')
        if (row.status !== 'approved') await approve(supabase, row, user.id)
      } else if (action === 'reject') {
        await unpublish(supabase, row, 'rejected', user.id)
      } else {
        await destroy(supabase, row)
      }
      results[row.id] = { ok: true }
    } catch (err) {
      console.error(action, row.id, err)
      results[row.id] = {
        ok: false,
        error: err instanceof HttpError ? err.message : 'Radnja nije uspjela. Pokušajte ponovo.',
      }
    }
  }
  for (const id of ids) results[id] ??= { ok: false, error: 'Stavka nije pronađena.' }
  return json({ results })
})

export const config = { path: '/api/admin' }
