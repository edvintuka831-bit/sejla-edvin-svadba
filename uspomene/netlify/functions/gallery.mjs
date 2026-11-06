// GET /api/gallery?type=media|wishes&kind=image|video&offset=0
// Vraća ISKLJUČIVO odobreno, s kratkotrajnim potpisanim linkovima za prikaz.
// Originali fotografija se nikad ne prikazuju gostima – samo pregledi bez EXIF/GPS.
import { handle, json } from '../lib/core.mjs'
import { getJSON } from '../lib/db.mjs'
import { presignView } from '../lib/r2.mjs'

const PAGE = 24

export default handle(async (req) => {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') === 'wishes' ? 'wishes' : 'media'
  const kind = url.searchParams.get('kind')
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0)

  const media = (await getJSON('pub/media'))?.items || []
  const wishes = (await getJSON('pub/wishes'))?.items || []
  const counts = {
    photos: media.filter((m) => m.kind === 'image').length,
    videos: media.filter((m) => m.kind === 'video').length,
    wishes: wishes.length,
  }

  if (type === 'wishes') {
    const page = wishes.slice(offset, offset + PAGE)
    return json({ counts, items: page, more: offset + PAGE < wishes.length })
  }

  const list = kind === 'image' || kind === 'video' ? media.filter((m) => m.kind === kind) : media
  const page = await Promise.all(
    list.slice(offset, offset + PAGE).map(async (m) => ({
      id: m.id,
      kind: m.kind,
      guestName: m.guestName,
      tableLabel: m.tableLabel,
      width: m.width,
      height: m.height,
      duration: m.duration,
      thumbUrl: m.thumbKey ? await presignView(m.thumbKey) : null,
      previewUrl: m.previewKey ? await presignView(m.previewKey) : null,
      videoUrl: m.videoKey ? await presignView(m.videoKey) : null,
    })),
  )
  return json({ counts, items: page, more: offset + PAGE < list.length })
}, ['GET'])

export const config = { path: '/api/gallery' }
