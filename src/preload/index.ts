import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Result } from '../core/result'
import type { ReleaseCandidate, ReleaseDetails } from '../core/services/musicbrainz'
import type { AlbumSheet } from '../core/services/albumSheet'
import type { YouTubeVideo } from '../core/services/youtube'
import type { SettingsStatus } from '../core/models/settings'
import type { EditableAlbum } from '../core/albumDraft'
import type { AlbumSummary, SavedAlbum } from '../core/database/db'

const api = {
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

  saveAlbum: (
    album: EditableAlbum,
    photoPaths: { front: string | null; back: string | null }
  ): Promise<Result<{ id: number }>> =>
    ipcRenderer.invoke('collection:save', album, photoPaths),

  listAlbums: (): Promise<Result<AlbumSummary[]>> =>
    ipcRenderer.invoke('collection:list'),

  getAlbum: (albumId: number): Promise<Result<SavedAlbum | null>> =>
    ipcRenderer.invoke('collection:get', albumId),

  deleteAlbum: (albumId: number): Promise<Result<void>> =>
    ipcRenderer.invoke('collection:delete', albumId),

  albumCount: (): Promise<Result<number>> =>
    ipcRenderer.invoke('collection:count')
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
