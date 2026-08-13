import { ipcMain, BrowserWindow } from 'electron'
import { runExport } from './export'
import type { ExportRequest, ExportOutcome } from '../core/models/exportFields'
import {
  searchReleases,
  getReleaseDetails,
  suggestArtists,
  suggestAlbums,
  browseArtistAlbums,
  type ReleaseCandidate,
  type ReleaseDetails,
  type ArtistSuggestion,
  type AlbumSuggestion,
  type ArtistBrowseResult
} from '../core/services/musicbrainz'
import type { Result } from '../core/result'
import { buildAlbumSheet, type AlbumSheet } from '../core/services/albumSheet'
import { checkApiKey, searchTrackVideo, type YouTubeVideo } from '../core/services/youtube'
import { getPreviewUrl, findTracks, type DeezerTrackRef } from '../core/services/deezer'
import {
  getYoutubeApiKey,
  setYoutubeApiKey,
  clearYoutubeApiKey,
  hasYoutubeApiKey,
  isEncryptionAvailable
} from './settings'
import type { SettingsStatus } from '../core/models/settings'
import { getDatabase, persist, openDatabase, closeDatabase } from './database'
import {
  listProfiles,
  createProfile,
  renameProfile,
  deleteProfile,
  setActiveProfile,
  getLastActiveId,
  profileDbPath,
  type Profile
} from './profiles'
import { copyPhoto, deletePhoto } from './photos'
import {
  pickAudioFiles,
  matchFilesToTracks,
  withMissingFlag,
  type MatchableTrack
} from './audio'
import type { PlaybackSource } from '../core/player/queue'
import {
  saveAlbum,
  updateAlbum,
  listAlbums,
  getAlbum,
  deleteAlbum,
  albumCount,
  createSetlist,
  listSetlists,
  getSetlist,
  renameSetlist,
  deleteSetlist,
  addTrackToSetlist,
  removeTrackFromSetlist,
  reorderSetlist,
  setlistUsageForAlbum,
  listAlbumTracks,
  previewGenreSelection,
  pickTracksByGenres,
  createSetlistWithTracks,
  findPossibleDuplicates,
  linkTrackFile,
  unlinkTrackFile,
  recordPlay,
  listCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  countCollections,
  type GenrePreview,
  type CollectionSummary,
  type AlbumSummary,
  type SavedAlbum,
  type SetlistSummary,
  type SetlistDetail,
  type AddToSetlistResult,
  type SetlistUsage,
  type BrowsableTrack,
  type DuplicateCandidate
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
    'musicbrainz:suggestArtists',
    (_event, query: string): Promise<Result<ArtistSuggestion[]>> =>
      attempt(() => suggestArtists(query))
  )

  ipcMain.handle(
    'musicbrainz:suggestAlbums',
    (_event, titleQuery: string, artistHint: string): Promise<Result<AlbumSuggestion[]>> =>
      attempt(() => suggestAlbums(titleQuery, artistHint))
  )

  ipcMain.handle(
    'musicbrainz:browseArtist',
    (_event, artistName: string): Promise<Result<ArtistBrowseResult>> =>
      attempt(() => browseArtistAlbums(artistName))
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

  /**
   * Busca en Deezer los adelantos de una lista de canciones escrita a mano.
   *
   * Existe para los álbumes cargados manualmente: los que vienen de MusicBrainz
   * ya reciben esto dentro de `album:sheet`. Deezer busca por texto (artista +
   * título), así que no necesita ningún identificador de MusicBrainz.
   */
  ipcMain.handle(
    'deezer:findTracks',
    (
      _event,
      tracks: Array<{ artist: string; title: string }>
    ): Promise<Result<Array<DeezerTrackRef | null>>> => attempt(() => findTracks(tracks))
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
      photoPaths: { front: string | null; back: string | null },
      collectionId: number
    ): Result<{ id: number }> =>
      attemptSync(() => {
        const db = getDatabase()

        const photos = {
          front: photoPaths.front ? copyPhoto(photoPaths.front) : null,
          back: photoPaths.back ? copyPhoto(photoPaths.back) : null
        }

        const id = saveAlbum(db, collectionId, album, photos)
        persist()
        return { id }
      })
  )

  ipcMain.handle(
    'collection:update',
    (
      _event,
      albumId: number,
      album: EditableAlbum
    ): Result<void> =>
      attemptSync(() => {
        updateAlbum(getDatabase(), albumId, album)
        persist()
      })
  )

  ipcMain.handle(
    'collection:list',
    (_event, collectionId: number): Result<AlbumSummary[]> =>
      attemptSync(() => listAlbums(getDatabase(), collectionId))
  )

  /*
    Al leer un disco se comprueba, canción por canción, si su archivo de audio
    sigue estando donde se registró. La base guarda la ruta pero no puede mirar
    el disco duro; este proceso sí, y es el momento correcto para hacerlo: la
    persona pudo mover su carpeta de música desde la última vez.
  */
  ipcMain.handle(
    'collection:get',
    (_event, albumId: number): Result<SavedAlbum | null> =>
      attemptSync(() => {
        const album = getAlbum(getDatabase(), albumId)
        if (!album) return null

        return {
          ...album,
          tracks: album.tracks.map((track) => ({
            ...track,
            file: withMissingFlag(track.file)
          }))
        }
      })
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
    (_event, collectionId: number): Result<number> =>
      attemptSync(() => albumCount(getDatabase(), collectionId))
  )

  ipcMain.handle(
    'collection:albumTracks',
    (_event, albumId: number): Result<BrowsableTrack[]> =>
      attemptSync(() => listAlbumTracks(getDatabase(), albumId))
  )

  ipcMain.handle(
    'collection:setlistUsage',
    (_event, albumId: number): Result<SetlistUsage> =>
      attemptSync(() => setlistUsageForAlbum(getDatabase(), albumId))
  )

  ipcMain.handle(
    'collection:findDuplicates',
    (
      _event,
      collectionId: number,
      artists: string,
      title: string,
      excludeAlbumId?: number
    ): Result<DuplicateCandidate[]> =>
      attemptSync(() =>
        findPossibleDuplicates(getDatabase(), collectionId, artists, title, excludeAlbumId)
      )
  )

  // --- Archivos de audio propios -----------------------------------------

  /**
   * Elige archivos y los reparte entre las canciones de un álbum.
   *
   * Todo en un solo paso a propósito: asociar 12 canciones de a una sería
   * abrir el diálogo 12 veces. El emparejamiento es por nombre de archivo y
   * solo cuando es inequívoco; lo que no calza se informa en vez de adivinarse.
   */
  ipcMain.handle(
    'audio:pickForAlbum',
    async (
      event,
      tracks: MatchableTrack[]
    ): Promise<
      Result<{ linked: number; unmatched: string[]; tracksWithoutFile: number[] }>
    > => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const files = await pickAudioFiles(window)

      return attemptSync(() => {
        if (files.length === 0) {
          return { linked: 0, unmatched: [], tracksWithoutFile: [] }
        }

        const outcome = matchFilesToTracks(files, tracks)
        const db = getDatabase()

        for (const match of outcome.matched) {
          linkTrackFile(db, match.trackId, match.path)
        }
        if (outcome.matched.length > 0) persist()

        return {
          linked: outcome.matched.length,
          unmatched: outcome.unmatched,
          tracksWithoutFile: outcome.tracksWithoutFile
        }
      })
    }
  )

  /** Asocia un archivo a UNA canción concreta. */
  ipcMain.handle(
    'audio:pickForTrack',
    async (event, trackId: number): Promise<Result<{ linked: boolean }>> => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const files = await pickAudioFiles(window)

      return attemptSync(() => {
        if (files.length === 0) return { linked: false }
        linkTrackFile(getDatabase(), trackId, files[0].path)
        persist()
        return { linked: true }
      })
    }
  )

  ipcMain.handle(
    'audio:unlink',
    (_event, trackId: number): Result<void> =>
      attemptSync(() => {
        unlinkTrackFile(getDatabase(), trackId)
        persist()
      })
  )

  /**
   * Anota que una canción sonó.
   *
   * Todavía no lo lee nadie; lo van a usar el panel de inicio y las listas
   * inteligentes. Se guarda desde ya porque el historial no se puede
   * reconstruir hacia atrás.
   */
  ipcMain.handle(
    'plays:record',
    (_event, trackId: number, source: PlaybackSource): Result<void> =>
      attemptSync(() => {
        recordPlay(getDatabase(), trackId, source)
        persist()
      })
  )

  // --- Perfiles ----------------------------------------------------------

  ipcMain.handle(
    'profiles:list',
    (): Result<{ profiles: Profile[]; lastActiveId: string | null }> =>
      attemptSync(() => ({ profiles: listProfiles(), lastActiveId: getLastActiveId() }))
  )

  /**
   * Abrir un perfil: cierra la base del anterior guardando lo pendiente y abre
   * la suya. Después de esto la app puede consultar discos y setlists.
   */
  ipcMain.handle(
    'profiles:activate',
    (_event, profileId: string): Promise<Result<void>> =>
      attempt(async () => {
        setActiveProfile(profileId)
        await openDatabase(profileDbPath(profileId))
      })
  )

  ipcMain.handle(
    'profiles:create',
    (_event, name: string, emoji: string | null): Result<Profile> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('El perfil necesita un nombre.')
        return createProfile(trimmed, emoji ?? undefined)
      })
  )

  ipcMain.handle(
    'profiles:rename',
    (_event, profileId: string, name: string, emoji: string | null): Result<void> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('El perfil necesita un nombre.')
        renameProfile(profileId, trimmed, emoji ?? undefined)
      })
  )

  ipcMain.handle(
    'profiles:delete',
    (_event, profileId: string): Result<void> =>
      attemptSync(() => deleteProfile(profileId))
  )

  /** Volver al selector: se guarda y se cierra la base del perfil abierto. */
  ipcMain.handle(
    'profiles:signOut',
    (): Result<void> => attemptSync(() => closeDatabase())
  )

  // --- Colecciones -------------------------------------------------------

  ipcMain.handle(
    'collections:list',
    (): Result<CollectionSummary[]> =>
      attemptSync(() => listCollections(getDatabase()))
  )

  ipcMain.handle(
    'collections:create',
    (_event, name: string): Result<{ id: number }> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('La colección necesita un nombre.')
        const id = createCollection(getDatabase(), trimmed)
        persist()
        return { id }
      })
  )

  ipcMain.handle(
    'collections:rename',
    (_event, collectionId: number, name: string): Result<void> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('La colección necesita un nombre.')
        renameCollection(getDatabase(), collectionId, trimmed)
        persist()
      })
  )

  ipcMain.handle(
    'collections:delete',
    (_event, collectionId: number): Result<void> =>
      attemptSync(() => {
        const db = getDatabase()

        // Siempre tiene que quedar una: la app necesita una colección activa.
        if (countCollections(db) <= 1) {
          throw new Error(
            'No puedes borrar tu única colección. Crea otra antes de borrar esta.'
          )
        }

        const orphanPhotos = deleteCollection(db, collectionId)
        for (const filename of orphanPhotos) deletePhoto(filename)
        persist()
      })
  )

  // --- Setlists ----------------------------------------------------------

  ipcMain.handle(
    'setlist:create',
    (_event, collectionId: number, name: string): Result<{ id: number }> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('El setlist necesita un nombre.')
        const id = createSetlist(getDatabase(), collectionId, trimmed)
        persist()
        return { id }
      })
  )

  ipcMain.handle(
    'setlist:list',
    (_event, collectionId: number): Result<SetlistSummary[]> =>
      attemptSync(() => listSetlists(getDatabase(), collectionId))
  )

  ipcMain.handle(
    'setlist:get',
    (_event, setlistId: number): Result<SetlistDetail | null> =>
      attemptSync(() => getSetlist(getDatabase(), setlistId))
  )

  ipcMain.handle(
    'setlist:rename',
    (_event, setlistId: number, name: string): Result<void> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('El setlist necesita un nombre.')
        renameSetlist(getDatabase(), setlistId, trimmed)
        persist()
      })
  )

  ipcMain.handle(
    'setlist:delete',
    (_event, setlistId: number): Result<void> =>
      attemptSync(() => {
        deleteSetlist(getDatabase(), setlistId)
        persist()
      })
  )

  ipcMain.handle(
    'setlist:addTrack',
    (_event, setlistId: number, trackId: number): Result<AddToSetlistResult> =>
      attemptSync(() => {
        const outcome = addTrackToSetlist(getDatabase(), setlistId, trackId)
        if (outcome === 'added') persist()
        return outcome
      })
  )

  ipcMain.handle(
    'setlist:removeTrack',
    (_event, setlistId: number, trackId: number): Result<void> =>
      attemptSync(() => {
        removeTrackFromSetlist(getDatabase(), setlistId, trackId)
        persist()
      })
  )

  ipcMain.handle(
    'setlist:genrePreview',
    (_event, collectionId: number, genres: string[]): Result<GenrePreview> =>
      attemptSync(() => previewGenreSelection(getDatabase(), collectionId, genres))
  )

  ipcMain.handle(
    'setlist:generate',
    (
      _event,
      collectionId: number,
      name: string,
      genres: string[],
      limit: number | null
    ): Result<{ id: number; trackCount: number }> =>
      attemptSync(() => {
        const trimmed = name.trim()
        if (!trimmed) throw new Error('El setlist necesita un nombre.')

        const db = getDatabase()
        const trackIds = pickTracksByGenres(db, collectionId, genres, limit)
        if (trackIds.length === 0) {
          throw new Error('No hay canciones en esta colección con esos géneros.')
        }

        const id = createSetlistWithTracks(db, collectionId, trimmed, trackIds)
        persist()
        return { id, trackCount: trackIds.length }
      })
  )

  // --- Exportar ----------------------------------------------------------

  ipcMain.handle(
    'export:run',
    (event, request: ExportRequest): Promise<Result<ExportOutcome>> =>
      attempt(() => {
        const window = BrowserWindow.fromWebContents(event.sender)
        return runExport(getDatabase(), window, request, (progress) => {
          // El emisor puede haberse cerrado a mitad de una exportación larga.
          if (!event.sender.isDestroyed()) {
            event.sender.send('export:progress', progress)
          }
        })
      })
  )

  ipcMain.handle(
    'setlist:reorder',
    (_event, setlistId: number, trackIdsInOrder: number[]): Result<void> =>
      attemptSync(() => {
        reorderSetlist(getDatabase(), setlistId, trackIdsInOrder)
        persist()
      })
  )
}
