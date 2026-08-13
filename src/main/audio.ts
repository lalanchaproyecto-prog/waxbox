/**
 * Archivos de audio propios: elegirlos, comprobarlos y servirlos.
 *
 * Es el único módulo que toca los archivos de audio en el disco. Ni la ventana
 * ni `core/` pueden hacerlo: la ventana no tiene acceso al sistema de archivos
 * (y así debe seguir), y `core/` corre en los dos lados.
 */

import { dialog, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { basename } from 'path'
import {
  AUDIO_EXTENSIONS,
  comparableFileName,
  isSupportedAudio,
  type TrackFile
} from '../core/models/audioFile'

/** Un archivo elegido, listo para emparejar con una canción. */
export interface PickedAudioFile {
  path: string
  fileName: string
  /** El nombre ya limpio, para comparar contra el título de una canción. */
  comparable: string
}

/**
 * Abre el diálogo para elegir archivos de audio.
 *
 * Devuelve lista vacía si la persona cancela, que no es un error.
 */
export async function pickAudioFiles(
  window: BrowserWindow | null
): Promise<PickedAudioFile[]> {
  const options: Electron.OpenDialogOptions = {
    title: 'Elegir los archivos de audio de este disco',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Archivos de audio', extensions: [...AUDIO_EXTENSIONS] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  }

  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled) return []

  // El filtro del diálogo se puede sortear eligiendo "todos los archivos", así
  // que la extensión se vuelve a comprobar aquí.
  return result.filePaths.filter(isSupportedAudio).map((path) => {
    const fileName = basename(path)
    return { path, fileName, comparable: comparableFileName(fileName) }
  })
}

/**
 * Completa si el archivo sigue estando donde se registró.
 *
 * Se comprueba al leer y no al guardar porque la persona puede mover, renombrar
 * o borrar su carpeta de música en cualquier momento. Que la app lo diga es
 * mejor que un botón de reproducir que no hace nada.
 */
export function withMissingFlag(file: TrackFile | null): TrackFile | null {
  if (!file) return null
  return { ...file, missing: !existsSync(file.path) }
}

/** Una canción, con lo justo para emparejarla con un archivo. */
export interface MatchableTrack {
  trackId: number
  title: string
}

export interface FileMatch {
  trackId: number
  path: string
  fileName: string
}

export interface MatchOutcome {
  matched: FileMatch[]
  /** Archivos que no se pudieron atribuir a ninguna canción. */
  unmatched: string[]
  /** Canciones que quedaron sin archivo. */
  tracksWithoutFile: number[]
}

/**
 * Empareja archivos con canciones por el nombre.
 *
 * Los archivos de un disco rippeado casi siempre se llaman como la canción,
 * con el número de pista adelante ("03 - Tema.mp3"), así que comparar los
 * nombres limpios acierta la mayoría de las veces.
 *
 * SE PREFIERE NO ADIVINAR: solo empareja cuando los nombres limpios coinciden
 * exactamente, o cuando uno contiene al otro. Un emparejamiento aproximado
 * pondría el archivo equivocado en la canción equivocada, y eso es peor que no
 * emparejar: la persona escucharía otro tema sin entender por qué.
 *
 * Cada archivo se usa una sola vez, y cada canción recibe uno solo.
 */
export function matchFilesToTracks(
  files: PickedAudioFile[],
  tracks: MatchableTrack[]
): MatchOutcome {
  const takenFiles = new Set<string>()
  const matched: FileMatch[] = []
  const tracksWithoutFile: number[] = []

  for (const track of tracks) {
    const wanted = comparableFileName(track.title)
    if (wanted.length === 0) {
      tracksWithoutFile.push(track.trackId)
      continue
    }

    // Primero se busca coincidencia exacta; solo si no hay, se acepta que uno
    // contenga al otro. Así "Amor" nunca le gana a "Amor de verano" cuando el
    // archivo exacto existe.
    const exact = files.find(
      (file) => !takenFiles.has(file.path) && file.comparable === wanted
    )

    const partial =
      exact ??
      files.find(
        (file) =>
          !takenFiles.has(file.path) &&
          file.comparable.length > 0 &&
          (file.comparable.includes(wanted) || wanted.includes(file.comparable))
      )

    if (partial) {
      takenFiles.add(partial.path)
      matched.push({
        trackId: track.trackId,
        path: partial.path,
        fileName: partial.fileName
      })
    } else {
      tracksWithoutFile.push(track.trackId)
    }
  }

  return {
    matched,
    unmatched: files.filter((file) => !takenFiles.has(file.path)).map((f) => f.fileName),
    tracksWithoutFile
  }
}
