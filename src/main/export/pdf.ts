/**
 * Generación de los PDF.
 *
 * En vez de sumar una librería de PDF, se aprovecha que Electron ya lleva
 * Chromium adentro: el documento se maqueta en HTML y CSS, se carga en una
 * ventana oculta y se imprime con `printToPDF`.
 *
 * La ventaja no es solo ahorrarse una dependencia. Maquetar una ficha con
 * portada, columnas y saltos de página es trivial en CSS y penoso en las
 * librerías que dibujan por coordenadas.
 *
 * Las imágenes van incrustadas como data URI a propósito: así el documento no
 * depende de la red al momento de imprimirse y no hay que esperar descargas
 * dentro de la ventana oculta.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'
import type { SavedAlbum, SetlistDetail } from '../../core/database/db'
import { getFormat } from '../../core/models/formats'
import { conditionLabel } from '../../core/models/condition'
import { durationToSeconds, formatTotalDuration } from '../../core/models/duration'
import type { CoverImage } from './images'

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  )
}

const BASE_CSS = `
  @page { size: A4; margin: 14mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    font-size: 10pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc-header {
    border-bottom: 2px solid #6d28d9;
    padding-bottom: 8pt;
    margin-bottom: 14pt;
  }

  .doc-title { font-size: 20pt; font-weight: 700; color: #4c1d95; }
  .doc-sub { font-size: 9pt; color: #666; margin-top: 2pt; }

  .doc-footer {
    margin-top: 16pt;
    padding-top: 6pt;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #888;
    text-align: center;
  }
`

const COLLECTION_CSS = `
  .album {
    display: flex;
    gap: 12pt;
    padding: 10pt 0;
    border-bottom: 1px solid #e5e5e5;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .album-cover {
    width: 108pt;
    height: 108pt;
    flex-shrink: 0;
    object-fit: cover;
    border: 1px solid #ddd;
    border-radius: 3pt;
    background: #f4f4f4;
  }

  .album-cover-empty {
    width: 108pt;
    height: 108pt;
    flex-shrink: 0;
    border: 1px dashed #ccc;
    border-radius: 3pt;
    background: #fafafa;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bbb;
    font-size: 8pt;
  }

  .album-body { flex: 1; min-width: 0; }
  .album-title { font-size: 13pt; font-weight: 700; color: #111; }
  .album-artist { font-size: 10.5pt; color: #6d28d9; margin-bottom: 4pt; }

  .album-facts { font-size: 9pt; color: #444; }
  .album-facts span { display: inline-block; margin-right: 10pt; }
  .album-facts b { color: #666; font-weight: 600; }

  .album-notes,
  .album-review {
    margin-top: 5pt;
    font-size: 8.5pt;
    color: #555;
    line-height: 1.45;
  }

  .album-notes b, .album-review b { color: #6d28d9; }

  .album-links { margin-top: 4pt; font-size: 8pt; color: #777; word-break: break-all; }

  .tracklist { margin-top: 6pt; }

  .tracklist-title {
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    color: #999;
    margin-bottom: 2pt;
  }

  .track {
    display: flex;
    gap: 6pt;
    font-size: 8.5pt;
    padding: 1pt 0;
    border-bottom: 1px dotted #eee;
  }

  .track-place { color: #aaa; min-width: 20pt; }
  .track-name { flex: 1; }
  .track-time { color: #888; }
  .track-credits { font-size: 7.5pt; color: #999; padding-left: 26pt; }
`

const SETLIST_CSS = `
  .setlist-table { width: 100%; border-collapse: collapse; }

  .setlist-table thead th {
    background: #6d28d9;
    color: #fff;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    text-align: left;
    padding: 5pt 6pt;
  }

  .setlist-table tbody tr {
    border-bottom: 1px solid #e5e5e5;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .setlist-table tbody tr:nth-child(even) { background: #faf8ff; }

  .setlist-table td { padding: 6pt; vertical-align: middle; }

  .col-pos { width: 26pt; font-size: 12pt; font-weight: 700; color: #6d28d9; text-align: center; }
  .col-cover { width: 44pt; }
  .col-cover img { width: 36pt; height: 36pt; object-fit: cover; border-radius: 2pt; border: 1px solid #ddd; }
  .col-song { font-size: 11pt; font-weight: 600; color: #111; }
  .col-song .from { display: block; font-size: 8pt; font-weight: 400; color: #888; }
  .col-artist { font-size: 9.5pt; color: #444; }
  .col-time { width: 44pt; font-size: 10pt; color: #444; text-align: right; }
  .col-notes { width: 130pt; border-left: 1px solid #ddd; }
  .notes-lines { height: 26pt; border-bottom: 1px solid #ddd; }
`

function docShell(title: string, subtitle: string, css: string, body: string): string {
  const stamp = new Date().toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${BASE_CSS}${css}</style></head>
<body>
  <header class="doc-header">
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-sub">${esc(subtitle)}</div>
  </header>
  ${body}
  <footer class="doc-footer">Generado con Melôfyle el ${esc(stamp)}</footer>
</body></html>`
}

// --------------------------------------------------------------------------
// Colección
// --------------------------------------------------------------------------

export function renderCollectionHtml(
  albums: SavedAlbum[],
  covers: Array<CoverImage | null>,
  fields: Set<string>
): string {
  const cards = albums
    .map((album, index) => {
      const cover = covers[index]

      const coverHtml = fields.has('cover')
        ? cover
          ? `<img class="album-cover" src="${cover.dataUri}" alt="">`
          : '<div class="album-cover-empty">Sin portada</div>'
        : ''

      const facts: string[] = []
      if (fields.has('year') && album.year) facts.push(`<span><b>Año:</b> ${esc(album.year)}</span>`)
      if (fields.has('format'))
        facts.push(`<span><b>Formato:</b> ${esc(getFormat(album.format)?.label ?? album.format)}</span>`)
      if (fields.has('label') && album.label)
        facts.push(`<span><b>Sello:</b> ${esc(album.label)}</span>`)
      if (fields.has('genres') && album.genres.length > 0)
        facts.push(`<span><b>Género:</b> ${esc(album.genres.join(', '))}</span>`)
      if (fields.has('condition'))
        facts.push(`<span><b>Estado:</b> ${esc(conditionLabel(album.condition))}</span>`)
      if (fields.has('tags') && album.tags.length > 0)
        facts.push(`<span><b>Etiquetas:</b> ${esc(album.tags.join(', '))}</span>`)

      const notes =
        fields.has('notes') && album.notes
          ? `<div class="album-notes"><b>Tus notas:</b> ${esc(album.notes)}</div>`
          : ''

      const review =
        fields.has('review') && album.description
          ? `<div class="album-review">${esc(album.description)}</div>`
          : ''

      const links =
        fields.has('artistLinks') && album.artistLinks.length > 0
          ? `<div class="album-links">${album.artistLinks.map((link) => esc(link.url)).join(' · ')}</div>`
          : ''

      const tracklist =
        fields.has('tracklist') && album.tracks.length > 0
          ? `<div class="tracklist">
               <div class="tracklist-title">Tracklist</div>
               ${album.tracks
                 .map((track) => {
                   const place =
                     track.side !== 'N/A' ? `${track.side}${track.number}` : String(track.number)
                   const creditsHtml =
                     fields.has('credits') && track.credits.length > 0
                       ? `<div class="track-credits">${esc(
                           track.credits
                             .map((credit) => `${credit.role}: ${credit.artist}`)
                             .join(' · ')
                         )}</div>`
                       : ''
                   return `<div class="track">
                       <span class="track-place">${esc(place)}</span>
                       <span class="track-name">${esc(track.title)}</span>
                       <span class="track-time">${esc(track.duration ?? '')}</span>
                     </div>${creditsHtml}`
                 })
                 .join('')}
             </div>`
          : ''

      return `<article class="album">
          ${coverHtml}
          <div class="album-body">
            ${fields.has('title') ? `<div class="album-title">${esc(album.title)}</div>` : ''}
            ${fields.has('artist') ? `<div class="album-artist">${esc(album.artists)}</div>` : ''}
            ${facts.length > 0 ? `<div class="album-facts">${facts.join('')}</div>` : ''}
            ${notes}${review}${links}${tracklist}
          </div>
        </article>`
    })
    .join('')

  const subtitle = `${albums.length} ${albums.length === 1 ? 'disco' : 'discos'} en la colección`
  return docShell('Mi colección', subtitle, COLLECTION_CSS, cards)
}

// --------------------------------------------------------------------------
// Setlist
// --------------------------------------------------------------------------

export function renderSetlistHtml(
  setlist: SetlistDetail,
  covers: Array<CoverImage | null>,
  fields: Set<string>
): string {
  const headers: string[] = []
  if (fields.has('cover')) headers.push('<th class="col-cover"></th>')
  if (fields.has('position')) headers.push('<th class="col-pos">#</th>')
  if (fields.has('title')) headers.push('<th>Canción</th>')
  if (fields.has('artist')) headers.push('<th>Artista</th>')
  if (fields.has('duration')) headers.push('<th class="col-time">Dur.</th>')
  if (fields.has('notesColumn')) headers.push('<th class="col-notes">Notas</th>')

  const rows = setlist.tracks
    .map((track, index) => {
      const cells: string[] = []

      if (fields.has('cover')) {
        const cover = covers[index]
        cells.push(
          `<td class="col-cover">${cover ? `<img src="${cover.dataUri}" alt="">` : ''}</td>`
        )
      }
      if (fields.has('position')) cells.push(`<td class="col-pos">${index + 1}</td>`)
      if (fields.has('title')) {
        const from =
          fields.has('album') && track.albumTitle
            ? `<span class="from">${esc(track.albumTitle)}</span>`
            : ''
        cells.push(`<td class="col-song">${esc(track.title)}${from}</td>`)
      }
      if (fields.has('artist')) cells.push(`<td class="col-artist">${esc(track.artist)}</td>`)
      if (fields.has('duration'))
        cells.push(`<td class="col-time">${esc(track.duration ?? '—')}</td>`)
      if (fields.has('notesColumn'))
        cells.push('<td class="col-notes"><div class="notes-lines"></div></td>')

      return `<tr>${cells.join('')}</tr>`
    })
    .join('')

  const totalSeconds = setlist.tracks.reduce(
    (sum, track) => sum + (durationToSeconds(track.duration) ?? 0),
    0
  )
  const count = setlist.tracks.length
  const subtitle =
    `${count} ${count === 1 ? 'canción' : 'canciones'}` +
    (totalSeconds > 0 ? ` · ${formatTotalDuration(totalSeconds)}` : '')

  const table = `<table class="setlist-table">
      <thead><tr>${headers.join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`

  return docShell(setlist.name, subtitle, SETLIST_CSS, table)
}

// --------------------------------------------------------------------------
// Impresión
// --------------------------------------------------------------------------

/**
 * Convierte HTML en PDF usando una ventana oculta.
 *
 * El HTML se escribe a un archivo temporal en vez de pasarlo como data URL
 * porque los data URL tienen un tope de longitud que una colección grande
 * supera sin problema.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const tempPath = join(app.getPath('temp'), `waxbox-export-${Date.now()}.html`)
  writeFileSync(tempPath, html, 'utf-8')

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      // El documento es nuestro y no necesita ejecutar nada.
      javascript: false,
      sandbox: true
    }
  })

  try {
    await win.loadFile(tempPath)
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    })
  } finally {
    win.destroy()
    try {
      unlinkSync(tempPath)
    } catch {
      // Si el temporal no se puede borrar, no vale la pena romper la exportación.
    }
  }
}
