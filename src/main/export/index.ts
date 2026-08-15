/**
 * Orquestación de las exportaciones.
 *
 * Este archivo decide el orden de las cosas; el trabajo concreto lo hacen
 * `excel.ts` y `pdf.ts`. La misma tubería sirve para la colección y para un
 * setlist: solo cambia de dónde salen los datos y qué campos aplican.
 *
 * Se pregunta dónde guardar ANTES de ponerse a trabajar. Descargar las portadas
 * de una colección grande toma su tiempo, y sería feo hacer esperar a alguien
 * para que al final descubra que iba a cancelar.
 */

import { dialog, type BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import type { Database } from 'sql.js'
import type ExcelJS from 'exceljs'
import { listAlbums, getAlbum, getSetlist, type SavedAlbum } from '../../core/database/db'
import type {
  ExportFormat,
  ExportRequest,
  ExportOutcome,
  ExportProgress
} from '../../core/models/exportFields'
import { createCoverCache, loadCovers, type CoverImage } from './images'
import { buildCollectionWorkbook, buildSetlistWorkbook } from './excel'
import { renderCollectionHtml, renderSetlistHtml, htmlToPdf } from './pdf'

export type ProgressReporter = (progress: ExportProgress) => void

/** Windows no acepta estos caracteres en un nombre de archivo. */
function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Melôfyle'
}

async function askWhereToSave(
  window: BrowserWindow | null,
  suggestedName: string,
  format: ExportFormat
): Promise<string | null> {
  const filters =
    format === 'xlsx'
      ? [{ name: 'Libro de Excel', extensions: ['xlsx'] }]
      : [{ name: 'Documento PDF', extensions: ['pdf'] }]

  const result = window
    ? await dialog.showSaveDialog(window, {
        title: 'Guardar exportación',
        defaultPath: `${suggestedName}.${format}`,
        filters
      })
    : await dialog.showSaveDialog({
        title: 'Guardar exportación',
        defaultPath: `${suggestedName}.${format}`,
        filters
      })

  return result.canceled || !result.filePath ? null : result.filePath
}

function loadFullCollection(db: Database, collectionId: number): SavedAlbum[] {
  const albums: SavedAlbum[] = []
  for (const summary of listAlbums(db, collectionId)) {
    const album = getAlbum(db, summary.id)
    if (album) albums.push(album)
  }
  return albums
}

export async function runExport(
  db: Database,
  window: BrowserWindow | null,
  request: ExportRequest,
  report: ProgressReporter
): Promise<ExportOutcome> {
  const fields = new Set(request.fields)
  const wantsCovers = fields.has('cover')
  const cache = createCoverCache()

  if (request.kind === 'collection') {
    const albums = loadFullCollection(db, request.collectionId)
    if (albums.length === 0) {
      throw new Error('Esta colección está vacía, no hay nada que exportar.')
    }

    const path = await askWhereToSave(window, 'Melôfyle - Mi colección', request.format)
    if (!path) return { path: null }

    const covers: Array<CoverImage | null> = wantsCovers
      ? await loadCovers(
          cache,
          albums,
          (album) => ({
            userCoverFront: album.userCoverFront,
            canonicalCover: album.canonicalCover
          }),
          (done, total) => report({ stage: 'covers', done, total })
        )
      : albums.map(() => null)

    report({ stage: 'building', done: 0, total: 1 })

    if (request.format === 'xlsx') {
      const workbook = buildCollectionWorkbook(albums, covers, fields)
      await writeWorkbook(workbook, path)
    } else {
      const pdf = await htmlToPdf(renderCollectionHtml(albums, covers, fields))
      report({ stage: 'writing', done: 0, total: 1 })
      writeFileSync(path, pdf)
    }

    return { path }
  }

  // --- Setlist ------------------------------------------------------------

  if (request.setlistId === undefined) {
    throw new Error('No se indicó qué setlist exportar.')
  }

  const setlist = getSetlist(db, request.setlistId)
  if (!setlist) throw new Error('Ese setlist ya no existe.')
  if (setlist.tracks.length === 0) {
    throw new Error('Ese setlist está vacío, no hay nada que exportar.')
  }

  const path = await askWhereToSave(
    window,
    `Melôfyle - ${safeFileName(setlist.name)}`,
    request.format
  )
  if (!path) return { path: null }

  const covers: Array<CoverImage | null> = wantsCovers
    ? await loadCovers(
        cache,
        setlist.tracks,
        (track) => ({
          userCoverFront: track.userCoverFront,
          canonicalCover: track.canonicalCover
        }),
        (done, total) => report({ stage: 'covers', done, total })
      )
    : setlist.tracks.map(() => null)

  report({ stage: 'building', done: 0, total: 1 })

  if (request.format === 'xlsx') {
    const workbook = buildSetlistWorkbook(setlist, covers, fields)
    await writeWorkbook(workbook, path)
  } else {
    const pdf = await htmlToPdf(renderSetlistHtml(setlist, covers, fields))
    report({ stage: 'writing', done: 0, total: 1 })
    writeFileSync(path, pdf)
  }

  return { path }
}

async function writeWorkbook(workbook: ExcelJS.Workbook, path: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  writeFileSync(path, Buffer.from(buffer as ArrayBuffer))
}
