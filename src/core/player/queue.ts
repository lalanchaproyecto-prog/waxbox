/**
 * La lógica del reproductor, sin nada de interfaz.
 *
 * Aquí vive lo que hay que decidir: de dónde suena una canción, cuál es la
 * siguiente, cuál la anterior. Son funciones puras — reciben datos y devuelven
 * datos — así que se pueden razonar y probar sin abrir la app.
 *
 * La interfaz (PlayerProvider) se encarga de lo otro: crear el elemento de
 * audio, mandarle órdenes y redibujar la barra.
 */

import type { DeezerTrackRef } from '../services/deezer'
import type { TrackFile } from '../models/audioFile'
import type { PhysicalFormatId } from '../models/formats'

/** De dónde está sonando algo. */
export type PlaybackSource = 'archivo' | 'deezer' | 'youtube'

/** Una canción tal como la necesita el reproductor. */
export interface PlayableTrack {
  /** Id en la base de datos. Es lo que se registra en el historial. */
  trackId: number
  title: string
  artist: string
  albumTitle: string
  /**
   * En qué formato físico está el disco del que sale esta canción.
   *
   * El reproductor lo necesita para dibujar el objeto correcto cuando se
   * abre a pantalla completa: un vinilo gira con su brazo, un CD gira sin
   * aguja porque no la tiene, y un casete no es un disco.
   *
   * Opcional para no romper ninguna cola armada antes de que esto existiera:
   * sin formato, el reproductor grande simplemente muestra la portada.
   */
  format?: PhysicalFormatId
  /** Portada a mostrar en la barra. Puede ser null. */
  cover: string | null
  /** Archivo propio, si la persona asoció uno. */
  file: TrackFile | null
  /** Referencia de Deezer, si se encontró. */
  deezer: DeezerTrackRef | null
}

/** Cómo va a sonar una canción, ya resuelto. */
export interface ResolvedSource {
  source: PlaybackSource
  /**
   * Qué reproducir.
   * - 'archivo': la dirección waxbox-audio:// de la canción.
   * - 'deezer': el identificador de la canción, con el que se pide el adelanto.
   * - 'youtube': nada todavía; el video se busca en el momento.
   */
  ref: string | number | null
}

/**
 * Decide de dónde suena una canción.
 *
 * EL ORDEN NO ES ARBITRARIO:
 * 1. El archivo propio gana siempre. Suena entero, sin internet y sin gastar
 *    la cuota de nadie. Es, además, el disco que la persona realmente tiene.
 * 2. Deezer va segundo. No necesita clave ni configuración, pero son 30
 *    segundos: es un adelanto, no la canción.
 * 3. YouTube va último. Necesita clave, gasta cuota (100 de 10.000 por
 *    búsqueda) y muestra video, no solo audio.
 *
 * Un archivo que ya no está en su carpeta NO cuenta: se cae al siguiente.
 *
 * @param youtubeDisponible Si hay clave de YouTube configurada. Sin clave,
 *   YouTube no es una opción y la canción sencillamente no se puede escuchar.
 */
export function resolveSource(
  track: PlayableTrack,
  youtubeDisponible: boolean
): ResolvedSource | null {
  if (track.file && !track.file.missing) {
    return { source: 'archivo', ref: `waxbox-audio://track/${track.trackId}` }
  }

  if (track.deezer) {
    return { source: 'deezer', ref: track.deezer.trackId }
  }

  if (youtubeDisponible) {
    return { source: 'youtube', ref: null }
  }

  return null
}

/** Si esta canción se puede escuchar de alguna forma. */
export function isPlayable(track: PlayableTrack, youtubeDisponible: boolean): boolean {
  return resolveSource(track, youtubeDisponible) !== null
}

/**
 * El índice de la canción siguiente, o null si es la última.
 *
 * Se salta las que no se pueden escuchar de ninguna forma, en vez de frenar la
 * cola en seco sobre una canción muda. Si no queda ninguna reproducible más
 * adelante, devuelve null y la reproducción termina.
 */
export function nextIndex(
  queue: PlayableTrack[],
  current: number,
  youtubeDisponible: boolean
): number | null {
  for (let i = current + 1; i < queue.length; i++) {
    if (isPlayable(queue[i], youtubeDisponible)) return i
  }
  return null
}

/** El índice de la canción anterior reproducible, o null si es la primera. */
export function previousIndex(
  queue: PlayableTrack[],
  current: number,
  youtubeDisponible: boolean
): number | null {
  for (let i = current - 1; i >= 0; i--) {
    if (isPlayable(queue[i], youtubeDisponible)) return i
  }
  return null
}

/**
 * El primer índice reproducible desde uno dado, incluyéndolo.
 *
 * Se usa al arrancar una cola: si alguien pone un álbum entero y la primera
 * canción no tiene ninguna fuente, la reproducción empieza en la primera que sí.
 */
export function firstPlayableFrom(
  queue: PlayableTrack[],
  from: number,
  youtubeDisponible: boolean
): number | null {
  if (from < queue.length && from >= 0 && isPlayable(queue[from], youtubeDisponible)) {
    return from
  }
  return nextIndex(queue, from, youtubeDisponible)
}

/** Segundos a "3:07". Para el tiempo que corre en la barra. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
