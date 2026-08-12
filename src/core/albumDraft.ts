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
import type { AlbumSheet } from './services/albumSheet'
import type { ArtistLink } from './services/musicbrainz'
import type { DeezerTrackRef } from './services/deezer'

export interface EditableTrack {
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

/** Agrega un campo a la lista de editados, sin repetirlo. */
export function markEdited(fields: string[], field: string): string[] {
  return fields.includes(field) ? fields : [...fields, field]
}

/** Dice si un campo fue escrito por la persona y no por una fuente automática. */
export function wasEditedByUser(fields: string[], field: string): boolean {
  return fields.includes(field)
}
