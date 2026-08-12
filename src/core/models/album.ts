import type { PhysicalFormatId } from './formats'

export type { PhysicalFormatId }

/**
 * Lado o disco donde va la canción.
 * 'A' y 'B' para formatos de dos caras (vinilo, casete).
 * '1' y '2' para formatos numerados por disco (CD).
 * 'N/A' cuando no aplica.
 */
export type DiscSide = 'A' | 'B' | '1' | '2' | 'N/A'

export interface Track {
  id?: number
  albumId?: number
  /**
   * Artista de esta canción en particular.
   * En un álbum normal coincide con el artista del álbum; en un compilatorio
   * (donde el álbum figura como "Various Artists") cada canción tiene el suyo.
   */
  artist: string
  side: DiscSide
  number: number
  title: string
  duration: string | null
  youtubeVideoId: string | null
}

export interface Album {
  id?: number
  /** Formato físico. Ver PHYSICAL_FORMATS en ./formats.ts */
  format: PhysicalFormatId
  /** Artista principal del álbum. En un compilatorio suele ser "Various Artists". */
  artists: string
  title: string
  year: number | null
  genres: string[]
  label: string | null
  /** Ruta a la foto de portada que subió la persona (su copia personal). */
  userCoverFront: string | null
  /** Ruta a la foto de contraportada que subió la persona. */
  userCoverBack: string | null
  /** Portada oficial del catálogo, traída de Cover Art Archive. */
  canonicalCover: string | null
  description: string | null
  descriptionSource: string | null
  musicbrainzId: string | null
  tracks: Track[]
  createdAt?: string
  updatedAt?: string
}
