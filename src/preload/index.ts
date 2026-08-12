import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Result } from '../core/result'
import type { ReleaseCandidate, ReleaseDetails } from '../core/services/musicbrainz'
import type { AlbumSheet } from '../core/services/albumSheet'

/**
 * Lo único que la ventana puede pedirle al proceso principal.
 *
 * Se expone una lista corta y explícita de funciones en vez de acceso general
 * al sistema: así, si alguna vez la interfaz cargara contenido de terceros,
 * no podría hacer nada más que esto.
 */
const api = {
  /** Busca ediciones del álbum en MusicBrainz. */
  searchReleases: (artist: string, album: string): Promise<Result<ReleaseCandidate[]>> =>
    ipcRenderer.invoke('musicbrainz:search', artist, album),

  /** Trae los datos completos de una edición, con su tracklist. */
  getReleaseDetails: (
    musicbrainzId: string,
    physicalFormatId: string
  ): Promise<Result<ReleaseDetails>> =>
    ipcRenderer.invoke('musicbrainz:details', musicbrainzId, physicalFormatId),

  /** Arma la ficha completa del álbum: datos, tracklist y portada oficial. */
  getAlbumSheet: (
    musicbrainzId: string,
    physicalFormatId: string
  ): Promise<Result<AlbumSheet>> =>
    ipcRenderer.invoke('album:sheet', musicbrainzId, physicalFormatId)
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
  // Camino alterno por si el aislamiento de contexto estuviera apagado.
  // No es nuestro caso: Waxbox lo deja encendido, que es lo seguro.
  const shared = globalThis as unknown as { electron: unknown; api: unknown }
  shared.electron = electronAPI
  shared.api = api
}
