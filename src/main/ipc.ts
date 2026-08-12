/**
 * Puente entre la interfaz y la lógica de negocio.
 *
 * La ventana (el "renderer") no puede consultar MusicBrainz directamente: los
 * navegadores prohíben fijar la cabecera User-Agent, que es justo lo que
 * MusicBrainz exige para identificar a la aplicación. Por eso las consultas
 * salen desde acá, del proceso principal, que es Node y sí puede fijarla.
 *
 * Este archivo solo traduce llamadas: toda la lógica real vive en src/core.
 */

import { ipcMain } from 'electron'
import {
  searchReleases,
  getReleaseDetails,
  type ReleaseCandidate,
  type ReleaseDetails
} from '../core/services/musicbrainz'
import type { Result } from '../core/result'
import { buildAlbumSheet, type AlbumSheet } from '../core/services/albumSheet'

async function attempt<T>(operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await operation() }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
    console.error('[waxbox]', error)
    return { ok: false, error: message }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle(
    'musicbrainz:search',
    (_event, artist: string, album: string): Promise<Result<ReleaseCandidate[]>> =>
      attempt(() => searchReleases(artist, album))
  )

  ipcMain.handle(
    'musicbrainz:details',
    (
      _event,
      musicbrainzId: string,
      physicalFormatId: string
    ): Promise<Result<ReleaseDetails>> =>
      attempt(() => getReleaseDetails(musicbrainzId, physicalFormatId))
  )

  ipcMain.handle(
    'album:sheet',
    (
      _event,
      musicbrainzId: string,
      physicalFormatId: string
    ): Promise<Result<AlbumSheet>> =>
      attempt(() => buildAlbumSheet(musicbrainzId, physicalFormatId))
  )
}
