/**
 * Generación de los archivos Excel.
 *
 * Se usa exceljs porque es la única librería mantenida que sabe incrustar
 * imágenes dentro de la hoja; las alternativas solo escriben texto, y la
 * portada tenía que ir como imagen de verdad y no como un enlace.
 */

import ExcelJS from 'exceljs'
import type { SavedAlbum, SetlistDetail } from '../../core/database/db'
import { getFormat } from '../../core/models/formats'
import { conditionLabel } from '../../core/models/condition'
import type { CoverImage } from './images'

/** Morado de la app, para los encabezados. */
const HEADER_COLOR = 'FF6D28D9'
const COVER_PX = 64

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_COLOR } }
  header.alignment = { vertical: 'middle', horizontal: 'left' }
  header.height = 22
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function autoBorder(sheet: ExcelJS.Worksheet): void {
  sheet.eachRow((row, index) => {
    if (index === 1) return
    row.alignment = { vertical: 'middle', wrapText: true }
  })
}

function embedCover(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  cover: CoverImage | null,
  rowNumber: number
): void {
  if (!cover) return

  const imageId = workbook.addImage({
    buffer: cover.buffer as unknown as ExcelJS.Buffer,
    extension: 'jpeg'
  })

  sheet.addImage(imageId, {
    tl: { col: 0.15, row: rowNumber - 1 + 0.1 },
    ext: { width: COVER_PX, height: COVER_PX }
  })
  sheet.getRow(rowNumber).height = COVER_PX * 0.78
}

// --------------------------------------------------------------------------
// Colección
// --------------------------------------------------------------------------

export function buildCollectionWorkbook(
  albums: SavedAlbum[],
  covers: Array<CoverImage | null>,
  fields: Set<string>
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Waxbox'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Colección')

  const columns: Partial<ExcelJS.Column>[] = []
  if (fields.has('cover')) columns.push({ header: 'Portada', key: 'cover', width: 11 })
  if (fields.has('artist')) columns.push({ header: 'Artista', key: 'artist', width: 28 })
  if (fields.has('title')) columns.push({ header: 'Álbum', key: 'title', width: 32 })
  if (fields.has('year')) columns.push({ header: 'Año', key: 'year', width: 8 })
  if (fields.has('genres')) columns.push({ header: 'Género', key: 'genres', width: 22 })
  if (fields.has('label')) columns.push({ header: 'Sello', key: 'label', width: 22 })
  if (fields.has('format')) columns.push({ header: 'Formato', key: 'format', width: 11 })
  if (fields.has('condition')) columns.push({ header: 'Estado', key: 'condition', width: 15 })
  if (fields.has('notes')) columns.push({ header: 'Tus notas', key: 'notes', width: 40 })
  if (fields.has('review')) columns.push({ header: 'Reseña', key: 'review', width: 60 })
  if (fields.has('artistLinks'))
    columns.push({ header: 'Enlaces del artista', key: 'artistLinks', width: 40 })

  sheet.columns = columns

  albums.forEach((album, index) => {
    const row = sheet.addRow({
      cover: '',
      artist: album.artists,
      title: album.title,
      year: album.year ?? '',
      genres: album.genres.join(', '),
      label: album.label ?? '',
      format: getFormat(album.format)?.label ?? album.format,
      condition: conditionLabel(album.condition),
      notes: album.notes ?? '',
      review: album.description ?? '',
      artistLinks: album.artistLinks.map((link) => link.url).join('\n')
    })

    if (fields.has('cover')) embedCover(workbook, sheet, covers[index], row.number)
  })

  autoBorder(sheet)
  styleHeader(sheet)

  if (fields.has('tracklist')) {
    addTracksSheet(workbook, albums, fields.has('credits'))
  }

  return workbook
}

/**
 * El tracklist va en su propia hoja, una fila por canción.
 *
 * Meterlo apretujado en la fila del álbum haría la hoja principal ilegible y,
 * sobre todo, impediría filtrar y ordenar por canción, que es justamente para
 * lo que sirve tener esto en una planilla.
 */
function addTracksSheet(
  workbook: ExcelJS.Workbook,
  albums: SavedAlbum[],
  withCredits: boolean
): void {
  const sheet = workbook.addWorksheet('Canciones')

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Artista', key: 'albumArtist', width: 26 },
    { header: 'Álbum', key: 'album', width: 30 },
    { header: 'Ubicación', key: 'place', width: 11 },
    { header: 'Canción', key: 'title', width: 36 },
    { header: 'Intérprete', key: 'artist', width: 26 },
    { header: 'Duración', key: 'duration', width: 10 }
  ]
  if (withCredits) columns.push({ header: 'Créditos', key: 'credits', width: 60 })

  sheet.columns = columns

  for (const album of albums) {
    for (const track of album.tracks) {
      sheet.addRow({
        albumArtist: album.artists,
        album: album.title,
        place: track.side !== 'N/A' ? `${track.side}${track.number}` : String(track.number),
        title: track.title,
        artist: track.artist,
        duration: track.duration ?? '',
        credits: withCredits
          ? track.credits
              .map((credit) =>
                credit.detail
                  ? `${credit.role}: ${credit.artist} (${credit.detail})`
                  : `${credit.role}: ${credit.artist}`
              )
              .join('\n')
          : ''
      })
    }
  }

  autoBorder(sheet)
  styleHeader(sheet)
}

// --------------------------------------------------------------------------
// Setlist
// --------------------------------------------------------------------------

export function buildSetlistWorkbook(
  setlist: SetlistDetail,
  covers: Array<CoverImage | null>,
  fields: Set<string>
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Waxbox'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(setlist.name.slice(0, 30) || 'Setlist')

  const columns: Partial<ExcelJS.Column>[] = []
  if (fields.has('cover')) columns.push({ header: 'Portada', key: 'cover', width: 11 })
  if (fields.has('position')) columns.push({ header: '#', key: 'position', width: 6 })
  if (fields.has('title')) columns.push({ header: 'Canción', key: 'title', width: 38 })
  if (fields.has('artist')) columns.push({ header: 'Artista', key: 'artist', width: 28 })
  if (fields.has('duration')) columns.push({ header: 'Duración', key: 'duration', width: 10 })
  if (fields.has('album')) columns.push({ header: 'Álbum', key: 'album', width: 32 })

  sheet.columns = columns

  setlist.tracks.forEach((track, index) => {
    const row = sheet.addRow({
      cover: '',
      position: index + 1,
      title: track.title,
      artist: track.artist,
      duration: track.duration ?? '',
      album: track.albumTitle
    })

    if (fields.has('cover')) embedCover(workbook, sheet, covers[index], row.number)
  })

  autoBorder(sheet)
  styleHeader(sheet)

  return workbook
}
