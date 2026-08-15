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
import type { UpdateState } from '../core/models/update'
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
  DuplicateCandidate,
  WishlistItem,
  WishlistDraft,
  VariantSibling,
  ActiveLoan,
  CollectionStats
} from '../core/database/db'
import type { DashboardData } from '../core/database/dashboard'
import type { SmartCriteria, SmartList } from '../core/models/smartList'
import type { Loan } from '../core/models/loan'
import type { DeezerTrackRef } from '../core/services/deezer'
import type { PlaybackSource } from '../core/player/queue'
import type { CommonsImage } from '../core/services/wikimediaCommons'
import type { ImageRef } from '../core/models/imageRef'

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

  // --- Imágenes de perfil, colección y setlist ---------------------------

  /** Busca imágenes libres en Wikimedia Commons. */
  searchCommonsImages: (query: string): Promise<Result<CommonsImage[]>> =>
    ipcRenderer.invoke('commons:search', query),

  /** Abre el diálogo para elegir una imagen propia y la guarda. */
  pickImageFile: (destino: 'archivo' | 'avatar'): Promise<Result<ImageRef | null>> =>
    ipcRenderer.invoke('image:pickFile', destino),

  /**
   * Deja una imagen lista para guardar: si viene de Commons la descarga, para
   * que se pueda ver sin conexión. El campo `offline` del resultado dice si
   * quedó guardada de verdad en el computador.
   */
  prepareImage: (
    image: ImageRef | null,
    destino: 'archivo' | 'avatar'
  ): Promise<Result<{ image: ImageRef | null; offline: boolean }>> =>
    ipcRenderer.invoke('image:prepare', image, destino),

  setCollectionImage: (collectionId: number, image: ImageRef | null): Promise<Result<void>> =>
    ipcRenderer.invoke('collections:setImage', collectionId, image),

  setSetlistImage: (setlistId: number, image: ImageRef | null): Promise<Result<void>> =>
    ipcRenderer.invoke('setlist:setImage', setlistId, image),

  setProfileImage: (profileId: string, image: ImageRef | null): Promise<Result<void>> =>
    ipcRenderer.invoke('profiles:setImage', profileId, image),

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

  collectionStats: (collectionId: number): Promise<Result<CollectionStats>> =>
    ipcRenderer.invoke('collections:stats', collectionId),

  /** Los paneles del inicio. La fecha va desde aquí: es la local de quien usa la app. */
  dashboardData: (
    collectionId: number,
    hoy: string,
    anoActual: number
  ): Promise<Result<DashboardData>> =>
    ipcRenderer.invoke('collections:dashboard', collectionId, hoy, anoActual),

  /* Listas inteligentes: filtros guardados que se recalculan al leerlos. */
  listSmartLists: (collectionId: number): Promise<Result<SmartList[]>> =>
    ipcRenderer.invoke('smartlists:list', collectionId),

  createSmartList: (
    collectionId: number,
    name: string,
    criteria: SmartCriteria
  ): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('smartlists:create', collectionId, name, criteria),

  renameSmartList: (listId: number, name: string): Promise<Result<void>> =>
    ipcRenderer.invoke('smartlists:rename', listId, name),

  /** Cambia QUE incluye la lista: no toca discos, cambia la pregunta. */
  updateSmartListCriteria: (listId: number, criteria: SmartCriteria): Promise<Result<void>> =>
    ipcRenderer.invoke('smartlists:updateCriteria', listId, criteria),

  deleteSmartList: (listId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('smartlists:delete', listId),

  listAlbumTracks: (albumId: number): Promise<Result<BrowsableTrack[]>> =>
    ipcRenderer.invoke('collection:albumTracks', albumId),

  setlistUsageForAlbum: (albumId: number): Promise<Result<SetlistUsage>> =>
    ipcRenderer.invoke('collection:setlistUsage', albumId),

  // --- Archivos de audio propios -----------------------------------------

  /** Elige archivos y los reparte entre las canciones de un álbum por nombre. */
  pickAudioForAlbum: (
    tracks: Array<{ trackId: number; title: string }>
  ): Promise<Result<{ linked: number; unmatched: string[]; tracksWithoutFile: number[] }>> =>
    ipcRenderer.invoke('audio:pickForAlbum', tracks),

  pickAudioForTrack: (trackId: number): Promise<Result<{ linked: boolean }>> =>
    ipcRenderer.invoke('audio:pickForTrack', trackId),

  unlinkAudio: (trackId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('audio:unlink', trackId),

  /** Anota que una canción sonó, para el historial de escucha. */
  recordPlay: (trackId: number, source: PlaybackSource): Promise<Result<void>> =>
    ipcRenderer.invoke('plays:record', trackId, source),

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

  // --- Lista de deseos ---------------------------------------------------

  listWishlist: (collectionId: number): Promise<Result<WishlistItem[]>> =>
    ipcRenderer.invoke('wishlist:list', collectionId),

  addWishlistItem: (collectionId: number, draft: WishlistDraft): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('wishlist:add', collectionId, draft),

  updateWishlistItem: (itemId: number, draft: WishlistDraft): Promise<Result<void>> =>
    ipcRenderer.invoke('wishlist:update', itemId, draft),

  removeWishlistItem: (itemId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('wishlist:remove', itemId),

  wishlistCount: (collectionId: number): Promise<Result<number>> =>
    ipcRenderer.invoke('wishlist:count', collectionId),

  // --- Variantes --------------------------------------------------------

  variantsOf: (albumId: number): Promise<Result<VariantSibling[]>> =>
    ipcRenderer.invoke('variants:of', albumId),

  linkVariants: (albumId: number, otherAlbumId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('variants:link', albumId, otherAlbumId),

  unlinkVariant: (albumId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('variants:unlink', albumId),

  suggestedVariants: (collectionId: number, albumId: number): Promise<Result<VariantSibling[]>> =>
    ipcRenderer.invoke('variants:suggested', collectionId, albumId),

  // --- Préstamos --------------------------------------------------------

  loansOf: (albumId: number): Promise<Result<Loan[]>> =>
    ipcRenderer.invoke('loans:of', albumId),

  activeLoans: (collectionId: number): Promise<Result<ActiveLoan[]>> =>
    ipcRenderer.invoke('loans:active', collectionId),

  lendAlbum: (
    albumId: number,
    person: string,
    lentAt: string,
    dueAt: string | null,
    notes: string | null
  ): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('loans:lend', albumId, person, lentAt, dueAt, notes),

  returnLoan: (loanId: number, returnedAt: string): Promise<Result<void>> =>
    ipcRenderer.invoke('loans:return', loanId, returnedAt),

  deleteLoan: (loanId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('loans:delete', loanId),

  // --- Exportar ----------------------------------------------------------

  runExport: (request: ExportRequest): Promise<Result<ExportOutcome>> =>
    ipcRenderer.invoke('export:run', request),

  /** Avisa del avance de una exportación. Devuelve la función para dejar de escuchar. */
  onExportProgress: (listener: (progress: ExportProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, progress: ExportProgress): void =>
      listener(progress)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.off('export:progress', handler)
  },

  /**
   * Avisa cuando hay una actualización bajando o ya lista para instalar.
   *
   * Va en un solo sentido, del proceso principal a la ventana: la interfaz no
   * pide nada ni decide nada sobre la actualización, solo se entera para
   * poder mostrarlo. La instalación la hace electron-updater al cerrar.
   */
  onUpdateState: (listener: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, state: UpdateState): void => listener(state)
    ipcRenderer.on('actualizacion:estado', handler)
    return () => ipcRenderer.off('actualizacion:estado', handler)
  }
}

export type MelofyleApi = typeof api

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
