// GET /api/gallery?type=media|wishes&kind=image|video&offset=0
// Vraća ISKLJUČIVO odobreno, s kratkotrajnim potpisanim linkovima za prikaz.
// Originali fotografija se nikad ne daju gostima – samo pregledi bez EXIF/GPS.
import { handle, json } from '../lib/core.mjs'
import { galleryIds, getMany } from '../lib/db.mjs'
import { presignView } from '../lib/r2.mjs'

const PAGE = 24

export default handle(async (req) => {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') === 'wishes' ? 'wishes' : 'media'
  const kind = ['image', 'video'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'all'
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0)

  const [photos, videos, wishes] = await Promise.all([galleryIds('gal/image'), galleryIds('gal/video'), galleryIds('galw')])
  const counts = { photos: photos.length, videos: videos.length, wishes: wishes.length }

  if (type === 'wishes') {
    const page = await getMany('wish', wishes.slice(offset, offset + PAGE))
    return json({
      counts,
      items: page.filter((w) => w.status === 'approved').map((w) => ({ id: w.id, guestName: w.guestName, message: w.message, tableLabel: w.tableLabel })),
      more: offset + PAGE < wishes.length,
    })
  }

  const ids = kind === 'image' ? photos : kind === 'video' ? videos : await galleryIds('gal/all')
  const records = await getMany('media', ids.slice(offset, offset + PAGE))
  const items = await Promise.all(
    records
      .filter((m) => m.status === 'approved' && m.publicKeys) // dvostruka provjera
      .map(async (m) => ({
        id: m.id,
        kind: m.kind,
        guestName: m.guestName,
        tableLabel: m.tableLabel,
        width: m.width,
        height: m.height,
        duration: m.duration,
        thumbUrl: m.publicKeys.thumbKey ? await presignView(m.publicKeys.thumbKey) : null,
        previewUrl: m.publicKeys.previewKey ? await presignView(m.publicKeys.previewKey) : null,
        videoUrl: m.publicKeys.videoKey ? await presignView(m.publicKeys.videoKey) : null,
      })),
  )
  return json({ counts, items, more: offset + PAGE < ids.length })
}, ['GET'])

export const config = { path: '/api/gallery' }
