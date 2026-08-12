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
import { checkApiKey, searchTrackVideo, type YouTubeVideo } from '../core/services/youtube'
import { getPreviewUrl } from '../core/services/deezer'
import {
  getYoutubeApiKey,
  setYoutubeApiKey,
  clearYoutubeApiKey,
  hasYoutubeApiKey,
  isEncryptionAvailable
} from './settings'
import type { SettingsStatus } from '../core/models/settings'

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

  // --- Deezer ------------------------------------------------------------
  // La dirección del audio caduca a las pocas horas, así que se pide una nueva
  // justo cuando se va a reproducir, a partir del identificador guardado.

  ipcMain.handle(
    'deezer:previewUrl',
    (_event, trackId: number): Promise<Result<string | null>> =>
      attempt(() => getPreviewUrl(trackId))
  )

  // --- Configuración -----------------------------------------------------
  // La clave de YouTube nunca sale del proceso principal: a la ventana solo se
  // le dice si hay una configurada o no.

  ipcMain.handle('settings:status', (): SettingsStatus => ({
    youtubeConfigured: hasYoutubeApiKey(),
    youtubeKeyEncrypted: isEncryptionAvailable()
  }))

  ipcMain.handle(
    'settings:saveYoutubeKey',
    async (_event, apiKey: string): Promise<Result<SettingsStatus>> => {
      // Se comprueba contra YouTube antes de guardar, para no dejar guardada
      // una clave que no sirve.
      const check = await checkApiKey(apiKey)
      if (!check.ok) return { ok: false, error: check.reason }

      return attempt(async () => {
        setYoutubeApiKey(apiKey)
        return {
          youtubeConfigured: hasYoutubeApiKey(),
          youtubeKeyEncrypted: isEncryptionAvailable()
        }
      })
    }
  )

  ipcMain.handle('settings:clearYoutubeKey', (): Promise<Result<SettingsStatus>> =>
    attempt(async () => {
      clearYoutubeApiKey()
      return {
        youtubeConfigured: hasYoutubeApiKey(),
        youtubeKeyEncrypted: isEncryptionAvailable()
      }
    })
  )

  // --- YouTube -----------------------------------------------------------

  ipcMain.handle(
    'youtube:searchTrack',
    (_event, artist: string, trackTitle: string): Promise<Result<YouTubeVideo | null>> =>
      attempt(async () => {
        const apiKey = getYoutubeApiKey()
        if (!apiKey) {
          throw new Error(
            'Todavía no has configurado tu clave de YouTube. Ve a Configuración para agregarla.'
          )
        }
        return searchTrackVideo(apiKey, artist, trackTitle)
      })
  )
}
