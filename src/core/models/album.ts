import type { PhysicalFormatId } from './formats'

export type { PhysicalFormatId }

/**
 * Lado o disco donde va la canción.
 * - Letras ('A', 'B', 'C', 'D'...) en formatos de dos caras como vinilo y casete.
 *   Un álbum doble sigue con C y D, por eso no se limita a A y B.
 * - Números ('1', '2'...) en formatos numerados por disco, como un CD doble.
 * - 'N/A' cuando el dato no está disponible.
 */
export type DiscSide = string

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
