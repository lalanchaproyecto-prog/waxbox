/**
 * Cliente de Cover Art Archive.
 *
 * Cover Art Archive es el archivo de portadas de MusicBrainz. Se consulta con el
 * mismo identificador que ya obtuvimos de MusicBrainz, así que no hace falta
 * buscar de nuevo ni tener cuenta ni clave de acceso.
 *
 * Esta portada es la "oficial" del catálogo. Las fotos que sube la persona son
 * su copia personal y se guardan aparte.
 *
 * Documentación: https://coverartarchive.org/
 */

import { USER_AGENT } from '../config'

const API_BASE = 'https://coverartarchive.org'

export interface CoverArt {
  /** Imagen a tamaño completo. */
  imageUrl: string
  /** Versión pequeña, para mostrar en listados. */
  thumbnailUrl: string | null
  /**
   * De dónde salió la portada:
   * 'edicion' = de esta edición exacta; 'album' = de otra edición del mismo álbum.
   */
  source: 'edicion' | 'album'
}

interface RawImage {
  image?: string
  front?: boolean
  types?: string[]
  thumbnails?: Record<string, string | undefined>
}

/**
 * Cover Art Archive a veces devuelve enlaces http://. Se pasan a https://
 * para que la aplicación no cargue contenido inseguro.
 */
function toHttps(url: string | undefined): string | null {
  if (!url) return null
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

/** Toma la miniatura más útil, probando los nombres que usa el archivo. */
function pickThumbnail(image: RawImage): string | null {
  const thumbnails = image.thumbnails ?? {}
  const candidates = [
    thumbnails['500'],
    thumbnails.large,
    thumbnails['250'],
    thumbnails.small,
    thumbnails['1200']
  ]
  for (const candidate of candidates) {
    const url = toHttps(candidate)
    if (url) return url
  }
  return null
}

/**
 * Elige cuál de todas las imágenes es la portada.
 *
 * Un álbum suele tener varias imágenes (contraportada, disco, librillo). Puede
 * incluso haber más de una marcada como "Front", pero solo una está señalada
 * como la principal, así que esa tiene prioridad.
 */
function pickFrontCover(images: RawImage[]): RawImage | null {
  return (
    images.find((image) => image.front === true) ??
    images.find((image) => image.types?.includes('Front')) ??
    null
  )
}

/** Consulta un endpoint del archivo. Devuelve null si no hay portadas (404). */
async function fetchImages(path: string): Promise<RawImage[] | null> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      }
    })
  } catch {
    // Sin conexión o el servicio no responde: se sigue sin portada, que no es
    // motivo para frenar el registro del disco.
    return null
  }

  if (!response.ok) return null

  try {
    const data = (await response.json()) as { images?: RawImage[] }
    return data.images ?? []
  } catch {
    return null
  }
}

/**
 * Busca la portada oficial del álbum.
 *
 * Primero busca la de la edición exacta. Si esa edición concreta no tiene
 * portada cargada — algo común en prensados poco conocidos — usa la del álbum
 * en general, que suele ser la misma imagen.
 *
 * Devuelve null si no hay ninguna portada disponible. No es un error: muchos
 * álbumes simplemente no tienen imagen en el archivo.
 */
export async function fetchCoverArt(
  musicbrainzReleaseId: string,
  releaseGroupId?: string | null
): Promise<CoverArt | null> {
  const fromRelease = await fetchImages(`/release/${musicbrainzReleaseId}`)
  const releaseCover = fromRelease ? pickFrontCover(fromRelease) : null
  const releaseImageUrl = toHttps(releaseCover?.image)

  if (releaseCover && releaseImageUrl) {
    return {
      imageUrl: releaseImageUrl,
      thumbnailUrl: pickThumbnail(releaseCover),
      source: 'edicion'
    }
  }

  if (!releaseGroupId) return null

  const fromGroup = await fetchImages(`/release-group/${releaseGroupId}`)
  const groupCover = fromGroup ? pickFrontCover(fromGroup) : null
  const groupImageUrl = toHttps(groupCover?.image)

  if (groupCover && groupImageUrl) {
    return {
      imageUrl: groupImageUrl,
      thumbnailUrl: pickThumbnail(groupCover),
      source: 'album'
    }
  }

  return null
}
