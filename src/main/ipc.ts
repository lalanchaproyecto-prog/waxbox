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
import { getDatabase, persist } from './database'
import { copyPhoto, deletePhoto } from './photos'
import {
  saveAlbum,
  listAlbums,
  getAlbum,
  deleteAlbum,
  albumCount,
  type AlbumSummary,
  type SavedAlbum
} from '../core/database/db'
import type { EditableAlbum } from '../core/albumDraft'

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

function attemptSync<T>(operation: () => T): Result<T> {
  try {
    return { ok: true, data: operation() }
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

  ipcMain.handle(
    'deezer:previewUrl',
    (_event, trackId: number): Promise<Result<string | null>> =>
      attempt(() => getPreviewUrl(trackId))
  )

  // --- Configuración -----------------------------------------------------

  ipcMain.handle('settings:status', (): SettingsStatus => ({
    youtubeConfigured: hasYoutubeApiKey(),
    youtubeKeyEncrypted: isEncryptionAvailable()
  }))

  ipcMain.handle(
    'settings:saveYoutubeKey',
    async (_event, apiKey: string): Promise<Result<SettingsStatus>> => {
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

  // --- Colección ---------------------------------------------------------

  ipcMain.handle(
    'collection:save',
    (
      _event,
      album: EditableAlbum,
      photoPaths: { front: string | null; back: string | null }
    ): Result<{ id: number }> =>
      attemptSync(() => {
        const db = getDatabase()

        const photos = {
          front: photoPaths.front ? copyPhoto(photoPaths.front) : null,
          back: photoPaths.back ? copyPhoto(photoPaths.back) : null
        }

        const id = saveAlbum(db, album, photos)
        persist()
        return { id }
      })
  )

  ipcMain.handle(
    'collection:list',
    (): Result<AlbumSummary[]> =>
      attemptSync(() => listAlbums(getDatabase()))
  )

  ipcMain.handle(
    'collection:get',
    (_event, albumId: number): Result<SavedAlbum | null> =>
      attemptSync(() => getAlbum(getDatabase(), albumId))
  )

  ipcMain.handle(
    'collection:delete',
    (_event, albumId: number): Result<void> =>
      attemptSync(() => {
        const db = getDatabase()
        const album = getAlbum(db, albumId)
        if (album) {
          if (album.userCoverFront) deletePhoto(album.userCoverFront)
          if (album.userCoverBack) deletePhoto(album.userCoverBack)
          deleteAlbum(db, albumId)
          persist()
        }
      })
  )

  ipcMain.handle(
    'collection:count',
    (): Result<number> =>
      attemptSync(() => albumCount(getDatabase()))
  )
}
