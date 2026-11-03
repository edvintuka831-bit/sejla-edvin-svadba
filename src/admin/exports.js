import { strToU8, zipSync } from 'fflate'

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Sarajevo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Uvijek "26.10.2026. 14:32" po sarajevskom vremenu, bez obzira na jezik telefona.
export function formatDate(iso) {
  if (!iso) return ''
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}.${p.month}.${p.year}. ${p.hour}:${p.minute}`
}

const HEADER = ['Ime i prezime', 'Kategorija', 'Dolazak', 'Broj osoba', 'Napomena', 'Datum potvrde', 'Zadnja izmjena']

const rows = (list) =>
  list.map((r) => [
    r.name,
    r.group || 'GOSTI KOD MLADOŽENJE',
    r.attending ? 'Dolazi' : 'Ne dolazi',
    r.attending ? r.guests : 0,
    r.note || '',
    formatDate(r.createdAt),
    r.updatedAt && r.updatedAt !== r.createdAt ? formatDate(r.updatedAt) : '',
  ])

const fileName = (ext) => `potvrde-kod-mladozenje-${new Date().toISOString().slice(0, 10)}.${ext}`

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// CSV (UTF-8 s BOM-om da se Š, Č, Ć, Ž, Đ ispravno prikažu).
export function downloadCsv(list) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const text = [HEADER, ...rows(list)].map((r) => r.map(esc).join(',')).join('\r\n')
  download(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), fileName('csv'))
}

// Pravi Excel (.xlsx) – otvara se u Excelu, Google Sheets, Numbers i pregledu fajlova na mobitelu.
export function downloadXlsx(list) {
  const xmlEsc = (v) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  const col = (i) => String.fromCharCode(65 + i)
  const all = [HEADER, ...rows(list)]
  const totalGuests = list.reduce((s, r) => s + (r.attending ? r.guests : 0), 0)
  all.push([], ['Ukupno osoba koje dolaze', '', '', totalGuests])

  const sheetRows = all
    .map((row, ri) => {
      const cells = row
        .map((v, ci) => {
          const ref = `${col(ci)}${ri + 1}`
          const style = ri === 0 ? ' s="1"' : ''
          if (typeof v === 'number') return `<c r="${ref}"${style}><v>${v}</v></c>`
          if (v === '') return ''
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${ri + 1}">${cells}</row>`
    })
    .join('')

  const widths = [28, 18, 12, 12, 45, 18, 18].map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')

  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Potvrde" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  }

  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
  download(
    new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName('xlsx'),
  )
}
