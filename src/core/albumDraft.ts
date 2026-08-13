/**
 * La ficha editable de un álbum: lo que la persona revisa y corrige antes de
 * guardar, y lo que después podrá seguir editando desde su colección.
 *
 * Por qué existe aparte de AlbumSheet:
 * AlbumSheet es lo que dijeron las fuentes automáticas, tal cual. Este borrador
 * es lo que la persona decidió que quedara guardado. Separarlos permite saber
 * siempre qué dato vino de una fuente y cuál escribió ella.
 *
 * Cómo se marca lo editado a mano:
 * Cada ficha lleva una lista con los nombres de los campos que la persona tocó.
 * Se guarda a nivel de dato, aunque la interfaz no siempre lo muestre. Los
 * créditos, al ser una lista, llevan la marca en cada uno (campo `source`).
 */

import type { PhysicalFormatId } from './models/formats'
import type { ConditionId } from './models/condition'
import type { Credit } from './models/credits'
import type { AlbumSource } from './models/albumSource'
import type { AlbumSheet } from './services/albumSheet'
import type { ArtistLink } from './services/musicbrainz'
import type { DeezerTrackRef } from './services/deezer'

export interface EditableTrack {
  /**
   * Identificador en la base de datos. Solo existe si el álbum ya está
   * guardado; en un borrador recién traído de MusicBrainz todavía no hay id.
   * Es lo que permite agregar la canción a un setlist.
   */
  id?: number
  artist: string
  side: string
  number: number
  title: string
  duration: string | null
  credits: Credit[]
  /** Referencia a Deezer para escuchar 30 segundos. No se edita a mano. */
  deezer: DeezerTrackRef | null
  /** Campos de esta canción que la persona corrigió a mano. */
  userEditedFields: string[]
}

export interface EditableAlbum {
  format: PhysicalFormatId
  title: string
  artists: string
  year: number | null
  genres: string[]
  label: string | null
  /** Reseña de Wikipedia, o la que escriba la persona. */
  description: string | null
  descriptionSource: string | null
  descriptionUrl: string | null
  /** Portada oficial del catálogo. */
  canonicalCover: string | null
  /** Fotos de la copia de la persona. Se llenan al guardar. */
  userCoverFront: string | null
  userCoverBack: string | null
  musicbrainzId: string
  /**
   * Si el álbum vino de un catálogo o se cargó entero a mano.
   * Ver src/core/models/albumSource.ts.
   */
  source: AlbumSource
  artistLinks: ArtistLink[]
  tracks: EditableTrack[]
  /** Campos del álbum que la persona corrigió a mano. */
  userEditedFields: string[]
  /** Estado de conservación de la copia física. Null si no se evaluó. */
  condition: ConditionId | null
  /** Notas personales sobre esta copia. */
  notes: string | null
}

/** Arma el borrador editable a partir de lo que devolvieron las fuentes. */
export function draftFromSheet(
  sheet: AlbumSheet,
  format: PhysicalFormatId
): EditableAlbum {
  return {
    format,
    title: sheet.release.title,
    artists: sheet.release.artists,
    year: sheet.release.year,
    genres: [...sheet.release.genres],
    label: sheet.release.label,
    description: sheet.excerpt?.text ?? null,
    descriptionSource: sheet.excerpt?.source ?? null,
    descriptionUrl: sheet.excerpt?.url ?? null,
    canonicalCover: sheet.cover?.imageUrl ?? null,
    userCoverFront: null,
    userCoverBack: null,
    musicbrainzId: sheet.release.musicbrainzId,
    source: 'musicbrainz',
    artistLinks: sheet.artistLinks,
    tracks: sheet.tracks.map((track) => ({
      artist: track.artist,
      side: track.side,
      number: track.number,
      title: track.title,
      duration: track.duration,
      credits: track.credits,
      deezer: track.deezer,
      userEditedFields: []
    })),
    userEditedFields: [],
    condition: null,
    notes: null
  }
}

/**
 * Ficha en blanco para cargar un disco entero a mano.
 *
 * Es lo que se usa cuando MusicBrainz no encontró nada: ediciones raras,
 * autoproducidas o de sellos chicos que sencillamente no están en el catálogo.
 *
 * Todo lo que depende del identificador de MusicBrainz queda vacío a propósito y
 * no se va a intentar consultar: portada oficial, reseña de Wikipedia y enlaces
 * del artista se buscan con ese identificador, y aquí no hay ninguno. Las fotos
 * de la persona y el adelanto de Deezer sí funcionan, porque no dependen de él.
 */
export function emptyManualDraft(
  format: PhysicalFormatId,
  artists: string,
  title: string
): EditableAlbum {
  return {
    format,
    title,
    artists,
    year: null,
    genres: [],
    label: null,
    description: null,
    descriptionSource: null,
    descriptionUrl: null,
    canonicalCover: null,
    userCoverFront: null,
    userCoverBack: null,
    musicbrainzId: '',
    source: 'manual',
    artistLinks: [],
    tracks: [],
    userEditedFields: [],
    condition: null,
    notes: null
  }
}

/**
 * Una canción vacía para el tracklist manual.
 *
 * Nace con todos sus campos marcados como escritos por la persona, porque eso es
 * literalmente lo que son: no hay ninguna fuente detrás.
 */
export function emptyManualTrack(
  number: number,
  side: string,
  artist: string
): EditableTrack {
  return {
    artist,
    side,
    number,
    title: '',
    duration: null,
    credits: [],
    deezer: null,
    userEditedFields: ['title', 'artist', 'duration', 'side', 'number']
  }
}

/**
 * Renumera las canciones dentro de cada lado, respetando el orden de la lista.
 *
 * El número no se escribe a mano en ninguna parte: el tracklist se muestra
 * agrupado por lado y ordenado por número, así que un número fuera de secuencia
 * haría que la canción apareciera donde nadie la espera. Se recalcula después de
 * agregar, quitar, mover o cambiar de lado una canción.
 */
export function renumberTracks(tracks: EditableTrack[]): EditableTrack[] {
  const counters = new Map<string, number>()
  return tracks.map((track) => {
    const next = (counters.get(track.side) ?? 0) + 1
    counters.set(track.side, next)
    return { ...track, number: next }
  })
}

/** Agrega un campo a la lista de editados, sin repetirlo. */
export function markEdited(fields: string[], field: string): string[] {
  return fields.includes(field) ? fields : [...fields, field]
}

/** Dice si un campo fue escrito por la persona y no por una fuente automática. */
export function wasEditedByUser(fields: string[], field: string): boolean {
  return fields.includes(field)
}
