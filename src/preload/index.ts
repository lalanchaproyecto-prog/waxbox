import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  ExportRequest,
  ExportOutcome,
  ExportProgress
} from '../core/models/exportFields'
import { electronAPI } from '@electron-toolkit/preload'
import type { Result } from '../core/result'
import type {
  ReleaseCandidate,
  ReleaseDetails,
  ArtistSuggestion,
  AlbumSuggestion,
  ArtistBrowseResult
} from '../core/services/musicbrainz'
import type { Profile } from '../core/models/profile'
import type { AlbumSheet } from '../core/services/albumSheet'
import type { YouTubeVideo } from '../core/services/youtube'
import type { SettingsStatus } from '../core/models/settings'
import type { EditableAlbum } from '../core/albumDraft'
import type {
  AlbumSummary,
  SavedAlbum,
  SetlistSummary,
  SetlistDetail,
  AddToSetlistResult,
  SetlistUsage,
  BrowsableTrack,
  GenrePreview,
  CollectionSummary,
  DuplicateCandidate
} from '../core/database/db'
import type { DeezerTrackRef } from '../core/services/deezer'

const api = {
  suggestArtists: (query: string): Promise<Result<ArtistSuggestion[]>> =>
    ipcRenderer.invoke('musicbrainz:suggestArtists', query),

  suggestAlbums: (titleQuery: string, artistHint: string): Promise<Result<AlbumSuggestion[]>> =>
    ipcRenderer.invoke('musicbrainz:suggestAlbums', titleQuery, artistHint),

  browseArtistAlbums: (artistName: string): Promise<Result<ArtistBrowseResult>> =>
    ipcRenderer.invoke('musicbrainz:browseArtist', artistName),

  searchReleases: (artist: string, album: string): Promise<Result<ReleaseCandidate[]>> =>
    ipcRenderer.invoke('musicbrainz:search', artist, album),

  getReleaseDetails: (
    musicbrainzId: string,
    physicalFormatId: string
  ): Promise<Result<ReleaseDetails>> =>
    ipcRenderer.invoke('musicbrainz:details', musicbrainzId, physicalFormatId),

  getAlbumSheet: (
    musicbrainzId: string,
    physicalFormatId: string
  ): Promise<Result<AlbumSheet>> =>
    ipcRenderer.invoke('album:sheet', musicbrainzId, physicalFormatId),

  getPreviewUrl: (trackId: number): Promise<Result<string | null>> =>
    ipcRenderer.invoke('deezer:previewUrl', trackId),

  /** Busca adelantos de Deezer para un tracklist escrito a mano. */
  findDeezerTracks: (
    tracks: Array<{ artist: string; title: string }>
  ): Promise<Result<Array<DeezerTrackRef | null>>> =>
    ipcRenderer.invoke('deezer:findTracks', tracks),

  getSettingsStatus: (): Promise<SettingsStatus> => ipcRenderer.invoke('settings:status'),

  saveYoutubeKey: (apiKey: string): Promise<Result<SettingsStatus>> =>
    ipcRenderer.invoke('settings:saveYoutubeKey', apiKey),

  clearYoutubeKey: (): Promise<Result<SettingsStatus>> =>
    ipcRenderer.invoke('settings:clearYoutubeKey'),

  searchTrackVideo: (
    artist: string,
    trackTitle: string
  ): Promise<Result<YouTubeVideo | null>> =>
    ipcRenderer.invoke('youtube:searchTrack', artist, trackTitle),

  // --- Colección ---------------------------------------------------------

  updateAlbum: (albumId: number, album: EditableAlbum): Promise<Result<void>> =>
    ipcRenderer.invoke('collection:update', albumId, album),

  saveAlbum: (
    album: EditableAlbum,
    photoPaths: { front: string | null; back: string | null },
    collectionId: number
  ): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('collection:save', album, photoPaths, collectionId),

  listAlbums: (collectionId: number): Promise<Result<AlbumSummary[]>> =>
    ipcRenderer.invoke('collection:list', collectionId),

  getAlbum: (albumId: number): Promise<Result<SavedAlbum | null>> =>
    ipcRenderer.invoke('collection:get', albumId),

  deleteAlbum: (albumId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('collection:delete', albumId),

  albumCount: (collectionId: number): Promise<Result<number>> =>
    ipcRenderer.invoke('collection:count', collectionId),

  // --- Perfiles ----------------------------------------------------------

  listProfiles: (): Promise<Result<{ profiles: Profile[]; lastActiveId: string | null }>> =>
    ipcRenderer.invoke('profiles:list'),

  activateProfile: (profileId: string): Promise<Result<void>> =>
    ipcRenderer.invoke('profiles:activate', profileId),

  createProfile: (name: string, emoji: string | null): Promise<Result<Profile>> =>
    ipcRenderer.invoke('profiles:create', name, emoji),

  renameProfile: (
    profileId: string,
    name: string,
    emoji: string | null
  ): Promise<Result<void>> => ipcRenderer.invoke('profiles:rename', profileId, name, emoji),

  deleteProfile: (profileId: string): Promise<Result<void>> =>
    ipcRenderer.invoke('profiles:delete', profileId),

  signOutProfile: (): Promise<Result<void>> => ipcRenderer.invoke('profiles:signOut'),

  // --- Colecciones -------------------------------------------------------

  listCollections: (): Promise<Result<CollectionSummary[]>> =>
    ipcRenderer.invoke('collections:list'),

  createCollection: (name: string): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('collections:create', name),

  renameCollection: (collectionId: number, name: string): Promise<Result<void>> =>
    ipcRenderer.invoke('collections:rename', collectionId, name),

  deleteCollection: (collectionId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('collections:delete', collectionId),

  listAlbumTracks: (albumId: number): Promise<Result<BrowsableTrack[]>> =>
    ipcRenderer.invoke('collection:albumTracks', albumId),

  setlistUsageForAlbum: (albumId: number): Promise<Result<SetlistUsage>> =>
    ipcRenderer.invoke('collection:setlistUsage', albumId),

  /** Discos ya guardados con el mismo artista y título. Solo para avisar. */
  findPossibleDuplicates: (
    collectionId: number,
    artists: string,
    title: string,
    excludeAlbumId?: number
  ): Promise<Result<DuplicateCandidate[]>> =>
    ipcRenderer.invoke(
      'collection:findDuplicates',
      collectionId,
      artists,
      title,
      excludeAlbumId
    ),

  // --- Setlists ----------------------------------------------------------

  createSetlist: (collectionId: number, name: string): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('setlist:create', collectionId, name),

  listSetlists: (collectionId: number): Promise<Result<SetlistSummary[]>> =>
    ipcRenderer.invoke('setlist:list', collectionId),

  getSetlist: (setlistId: number): Promise<Result<SetlistDetail | null>> =>
    ipcRenderer.invoke('setlist:get', setlistId),

  renameSetlist: (setlistId: number, name: string): Promise<Result<void>> =>
    ipcRenderer.invoke('setlist:rename', setlistId, name),

  deleteSetlist: (setlistId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('setlist:delete', setlistId),

  addTrackToSetlist: (
    setlistId: number,
    trackId: number
  ): Promise<Result<AddToSetlistResult>> =>
    ipcRenderer.invoke('setlist:addTrack', setlistId, trackId),

  removeTrackFromSetlist: (setlistId: number, trackId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('setlist:removeTrack', setlistId, trackId),

  reorderSetlist: (setlistId: number, trackIdsInOrder: number[]): Promise<Result<void>> =>
    ipcRenderer.invoke('setlist:reorder', setlistId, trackIdsInOrder),

  previewGenreSelection: (
    collectionId: number,
    genres: string[]
  ): Promise<Result<GenrePreview>> =>
    ipcRenderer.invoke('setlist:genrePreview', collectionId, genres),

  generateSetlist: (
    collectionId: number,
    name: string,
    genres: string[],
    limit: number | null
  ): Promise<Result<{ id: number; trackCount: number }>> =>
    ipcRenderer.invoke('setlist:generate', collectionId, name, genres, limit),

  // --- Exportar ----------------------------------------------------------

  runExport: (request: ExportRequest): Promise<Result<ExportOutcome>> =>
    ipcRenderer.invoke('export:run', request),

  /** Avisa del avance de una exportación. Devuelve la función para dejar de escuchar. */
  onExportProgress: (listener: (progress: ExportProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, progress: ExportProgress): void =>
      listener(progress)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.off('export:progress', handler)
  }
}

export type WaxboxApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const shared = globalThis as unknown as { electron: unknown; api: unknown }
  shared.electron = electronAPI
  shared.api = api
}
