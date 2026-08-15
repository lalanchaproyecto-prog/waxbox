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
import { APP_NAME, APP_SLOGAN } from '../../core/config'
import { logotipoSvg, ROJO, ROJO_TEXTO, TINTA, type ContextoDocumento } from './marca'

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  )
}

/*
  La hoja hereda el sistema de la app: papel casi blanco, tinta casi negra,
  un solo acento rojo y la mono para los datos de catálogo.

  Los tipos de letra son los del sistema y no los de la app. Incrustar
  Archivo e IBM Plex Mono como base64 sumaría más de 100 KB a cada PDF y
  obligaría a esperar a que carguen antes de imprimir. Se eligen en su lugar
  las más parecidas que Windows ya trae: una grotesca de palo seco para el
  texto y Consolas para las cifras, que es exactamente el papel que hace la
  mono en la interfaz.
*/
const BASE_CSS = `
  @page { size: A4; margin: 14mm; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  /*
    EL DOCUMENTO ES SIEMPRE CLARO, PASE LO QUE PASE EN EL SISTEMA.

    El PDF se imprime desde una ventana oculta de Chromium, y esa ventana
    hereda el tema del sistema operativo. Sin estas dos líneas, quien tuviera
    Windows en modo oscuro exportaba un PDF con el fondo negro y el texto casi
    invisible — y no se enteraba hasta abrirlo o, peor, hasta imprimirlo.

    \`color-scheme: light\` impide que Chromium reinterprete los colores, y el
    fondo blanco explícito es lo que de verdad va al papel: el blanco por
    omisión de la página no se dibuja al imprimir, el nuestro sí, porque
    \`printBackground\` está activado.
  */
  :root { color-scheme: light; }

  body {
    background: #ffffff;
    font-family: "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, sans-serif;
    color: ${TINTA};
    font-size: 10pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .numeric {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }

  /*
    La cabecera lleva el logotipo a la izquierda y de qué es el documento a la
    derecha. La línea gruesa de abajo es el mismo gesto de marco que separa
    las piezas en la app.
  */
  .doc-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16pt;
    border-bottom: 2pt solid ${TINTA};
    padding-bottom: 8pt;
    margin-bottom: 16pt;
  }

  .doc-marca { display: flex; flex-direction: column; gap: 3pt; }

  .doc-eslogan {
    font-size: 6.5pt;
    letter-spacing: 1pt;
    text-transform: uppercase;
    color: #6f6d68;
  }

  .doc-datos { text-align: right; }

  .doc-title { font-size: 17pt; font-weight: 700; letter-spacing: -0.3pt; }

  .doc-sub {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 8pt;
    color: #55585d;
    margin-top: 2pt;
  }

  /*
    De quién es y de cuándo. Va en su propia banda bajo la cabecera, con el
    rótulo en mayúsculas pequeñas: son datos de identificación del documento,
    no del contenido, y conviene que se lean como tales.
  */
  .doc-contexto {
    display: flex;
    gap: 22pt;
    padding: 7pt 9pt;
    margin-bottom: 14pt;
    background: #f4f3f0;
    border: 0.75pt solid #cbc9c4;
    border-radius: 4pt;
  }

  .doc-contexto div { display: flex; flex-direction: column; gap: 1pt; }

  .doc-contexto dt {
    font-size: 6.5pt;
    letter-spacing: 0.8pt;
    text-transform: uppercase;
    color: #6f6d68;
  }

  .doc-contexto dd {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 8.5pt;
    color: ${TINTA};
  }

  .doc-footer {
    margin-top: 18pt;
    padding-top: 6pt;
    border-top: 0.75pt solid #cbc9c4;
    font-size: 7.5pt;
    color: #6f6d68;
    text-align: center;
  }
`

const COLLECTION_CSS = `
  .album {
    display: flex;
    gap: 12pt;
    padding: 10pt 0;
    border-bottom: 0.75pt solid #cbc9c4;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .album-cover {
    width: 108pt;
    height: 108pt;
    flex-shrink: 0;
    object-fit: cover;
    border: 1pt solid ${TINTA};
    border-radius: 4pt;
    background: #f4f3f0;
  }

  .album-cover-empty {
    width: 108pt;
    height: 108pt;
    flex-shrink: 0;
    border: 1pt dashed #a9a7a1;
    border-radius: 4pt;
    background: #f4f3f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6f6d68;
    font-size: 7.5pt;
  }

  .album-body { flex: 1; min-width: 0; }
  .album-title { font-size: 13pt; font-weight: 700; letter-spacing: -0.2pt; }
  .album-artist { font-size: 10.5pt; color: #3a3d42; margin-bottom: 4pt; }

  /* Los datos de catálogo van en mono, igual que en la ficha de la app. */
  .album-facts {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 8pt;
    color: #3a3d42;
  }
  .album-facts span { display: inline-block; margin-right: 10pt; }
  .album-facts b { color: #6f6d68; font-weight: 400; }

  .album-notes,
  .album-review {
    margin-top: 5pt;
    font-size: 8.5pt;
    color: #4d5055;
    line-height: 1.45;
  }

  /*
    Lo que anotaste tú lleva una barra roja al costado.

    Es la misma distinción que hace la app entre el catálogo —igual para todo
    el mundo— y tu copia. En papel, donde no hay paneles ni fondos, una barra
    de color es lo que deja ver de un vistazo qué parte de esta ficha la
    escribiste tú.
  */
  .album-notes {
    border-left: 2pt solid ${ROJO};
    padding-left: 6pt;
  }

  .album-notes b { color: ${ROJO_TEXTO}; font-weight: 700; }

  .album-links { margin-top: 4pt; font-size: 7.5pt; color: #6f6d68; word-break: break-all; }

  .tracklist { margin-top: 6pt; }

  .tracklist-title {
    font-size: 6.5pt;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.9pt;
    color: #6f6d68;
    margin-bottom: 3pt;
  }

  .track {
    display: flex;
    gap: 6pt;
    font-size: 8.5pt;
    padding: 1.5pt 0;
    border-bottom: 0.5pt solid #e4e2df;
  }

  .track-place {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    color: #6f6d68;
    min-width: 22pt;
  }
  .track-name { flex: 1; }
  .track-time {
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    color: #6f6d68;
  }
  .track-credits { font-size: 7pt; color: #6f6d68; padding-left: 28pt; }
`

/*
  El setlist es una tabla porque se usa de pie, mirándola de reojo mientras
  suena algo. La cabecera va en tinta plana con el texto en claro: el rojo de
  marca no aguanta texto blanco encima, igual que en la app.
*/
const SETLIST_CSS = `
  .setlist-table {
    width: 100%;
    border-collapse: collapse;
    border: 1pt solid ${TINTA};
  }

  .setlist-table thead th {
    background: ${TINTA};
    color: #f4f3f0;
    font-size: 6.5pt;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.9pt;
    text-align: left;
    padding: 6pt;
  }

  .setlist-table tbody tr {
    border-bottom: 0.5pt solid #cbc9c4;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Rayado tenue para no perder la fila al recorrer la tabla con el dedo. */
  .setlist-table tbody tr:nth-child(even) { background: #f4f3f0; }

  .setlist-table td { padding: 6pt; vertical-align: middle; }

  /* El número va en rojo: es lo que buscas cuando cantas "vamos por la 7". */
  .col-pos {
    width: 26pt;
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 12pt;
    font-weight: 700;
    color: ${ROJO_TEXTO};
    text-align: center;
  }
  .col-cover { width: 44pt; }
  .col-cover img {
    width: 36pt;
    height: 36pt;
    object-fit: cover;
    border-radius: 3pt;
    border: 0.75pt solid ${TINTA};
  }
  .col-song { font-size: 11pt; font-weight: 600; }
  .col-song .from { display: block; font-size: 7.5pt; font-weight: 400; color: #6f6d68; }
  .col-artist { font-size: 9.5pt; color: #3a3d42; }
  .col-time {
    width: 44pt;
    font-family: Consolas, "Cascadia Mono", ui-monospace, monospace;
    font-size: 9.5pt;
    color: #3a3d42;
    text-align: right;
  }
  .col-notes { width: 130pt; border-left: 0.75pt solid #cbc9c4; }
  .notes-lines { height: 26pt; border-bottom: 0.5pt solid #cbc9c4; }
`

function docShell(
  title: string,
  subtitle: string,
  css: string,
  body: string,
  contexto: ContextoDocumento
): string {
  const ahora = new Date()
  const fechaLarga = ahora.toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  /* En la banda de datos va la fecha corta, en mono: ahí es un dato de
     catálogo más y tiene que alinear con los de al lado. */
  const fechaCorta = ahora.toLocaleDateString('es-CL')

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${BASE_CSS}${css}</style></head>
<body>
  <header class="doc-header">
    <div class="doc-marca">
      ${logotipoSvg(24)}
      <span class="doc-eslogan">${esc(APP_SLOGAN)}</span>
    </div>
    <div class="doc-datos">
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-sub">${esc(subtitle)}</div>
    </div>
  </header>

  <dl class="doc-contexto">
    <div><dt>Colección de</dt><dd>${esc(contexto.perfil)}</dd></div>
    <div><dt>Colección</dt><dd>${esc(contexto.coleccion)}</dd></div>
    <div><dt>Exportado</dt><dd>${esc(fechaCorta)}</dd></div>
  </dl>

  ${body}
  <footer class="doc-footer">Generado con ${esc(APP_NAME)} el ${esc(fechaLarga)}</footer>
</body></html>`
}

// --------------------------------------------------------------------------
// Colección
// --------------------------------------------------------------------------

export function renderCollectionHtml(
  albums: SavedAlbum[],
  covers: Array<CoverImage | null>,
  fields: Set<string>,
  contexto: ContextoDocumento
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

  const subtitle = `${albums.length} ${albums.length === 1 ? 'disco' : 'discos'}`
  return docShell(contexto.coleccion, subtitle, COLLECTION_CSS, cards, contexto)
}

// --------------------------------------------------------------------------
// Setlist
// --------------------------------------------------------------------------

export function renderSetlistHtml(
  setlist: SetlistDetail,
  covers: Array<CoverImage | null>,
  fields: Set<string>,
  contexto: ContextoDocumento
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

  return docShell(setlist.name, subtitle, SETLIST_CSS, table, contexto)
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
  const tempPath = join(app.getPath('temp'), `melofyle-export-${Date.now()}.html`)
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
