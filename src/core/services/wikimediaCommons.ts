/**
 * Cliente de Wikimedia Commons.
 *
 * Commons es el archivo de imágenes libres de Wikimedia: millones de fotos que
 * se pueden reusar legalmente. No pide cuenta, ni clave, ni trámite — igual que
 * MusicBrainz o Wikipedia.
 *
 * PARA QUÉ SE USA AQUÍ:
 * para que la persona le ponga una imagen a su perfil, a una colección o a un
 * setlist sin tener que salir a buscar una foto por su cuenta. Escribe "jazz" o
 * "tocadiscos" y elige.
 *
 * LA ATRIBUCIÓN NO ES OPCIONAL:
 * las imágenes de Commons son libres, pero casi todas exigen crédito al autor y
 * mención de la licencia. Por eso este módulo NUNCA devuelve una dirección de
 * imagen suelta: siempre trae autor, licencia y enlace a la página original, y
 * quien la muestre tiene que poder enseñar esos datos. Guardar solo la URL
 * dejaría a la app incumpliendo la licencia.
 *
 * Documentación: https://commons.wikimedia.org/w/api.php
 */

import { USER_AGENT } from '../config'
import { createRateLimiter } from './rateLimiter'

const API = 'https://commons.wikimedia.org/w/api.php'

// Wikimedia pide no atropellar sus servidores. Como esto se dispara mientras la
// persona escribe, el espaciado importa más que en una consulta suelta.
const schedule = createRateLimiter(250)

export interface CommonsImage {
  /** Título del archivo en Commons. Sirve de identificador. */
  title: string
  /** Miniatura para la cuadrícula de resultados. */
  thumbUrl: string
  /** La imagen en un tamaño usable como fondo. */
  imageUrl: string
  /** Quién la hizo. Puede venir vacío en archivos mal documentados. */
  author: string | null
  /** Nombre corto de la licencia. Ej: "CC BY-SA 4.0". */
  license: string | null
  /** Página del archivo en Commons, donde está la información completa. */
  descriptionUrl: string
  width: number
  height: number
}

interface RawResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string
        imageinfo?: Array<{
          url?: string
          thumburl?: string
          descriptionurl?: string
          thumbwidth?: number
          thumbheight?: number
          width?: number
          height?: number
          extmetadata?: Record<string, { value?: string } | undefined>
        }>
      }
    >
  }
}

/**
 * Quita las etiquetas HTML que Commons mete en los campos de autor.
 *
 * El campo Artist suele venir como `<a href="...">Nombre</a>` o con varias
 * etiquetas anidadas. Mostrarlo tal cual dejaría el HTML a la vista.
 */
function stripHtml(value: string | undefined): string | null {
  if (!value) return null
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0 ? text : null
}

/**
 * Busca imágenes en Commons.
 *
 * `gsrnamespace=6` limita la búsqueda a archivos; sin eso vendrían también
 * páginas de texto, que no sirven para ilustrar nada.
 *
 * Devuelve lista vacía ante cualquier problema — sin conexión, servicio caído o
 * búsqueda sin resultados. Que no haya imágenes no es un error: la persona
 * siempre puede subir un archivo propio.
 */
export async function searchImages(query: string, limit = 24): Promise<CommonsImage[]> {
  const term = query.trim()
  if (term.length < 2) return []

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    // Una miniatura para la cuadrícula y un tamaño grande para usar de fondo.
    iiurlwidth: '320'
  })

  let data: RawResponse | null = null
  try {
    const response = await schedule(() =>
      fetch(`${API}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
      })
    )
    if (!response.ok) return []
    data = (await response.json()) as RawResponse
  } catch {
    return []
  }

  const pages = data?.query?.pages
  if (!pages) return []

  const images: CommonsImage[] = []

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0]
    if (!info?.url || !info.thumburl) continue

    const meta = info.extmetadata ?? {}

    images.push({
      title: page.title ?? 'Archivo de Commons',
      thumbUrl: info.thumburl,
      imageUrl: info.url,
      author: stripHtml(meta['Artist']?.value),
      license: stripHtml(meta['LicenseShortName']?.value),
      descriptionUrl: info.descriptionurl ?? info.url,
      width: info.width ?? 0,
      height: info.height ?? 0
    })
  }

  return images
}

/**
 * Arma un término de búsqueda a partir de lo que la persona está escribiendo.
 *
 * Se usa para sugerir sin que nadie tenga que pensar qué buscar: el nombre de
 * la colección o del setlist ya dice bastante, y para un setlist generado por
 * género el género es mejor pista que el nombre.
 */
export function suggestedQuery(name: string, genres: string[] = []): string {
  const limpio = name.trim()

  // El género manda cuando existe: "Setlist Rock — 20 canciones" buscado tal
  // cual no daría nada, y "rock" sí.
  if (genres.length > 0) return genres.slice(0, 2).join(' ')

  /*
    Se quitan los adornos que no ayudan a buscar una imagen.

    La palabra con números se borra ENTERA y no solo sus dígitos: quitar solo
    los dígitos de "80s" dejaba una "s" suelta dando vueltas en la búsqueda.
  */
  return limpio
    .replace(/\b\w*\d\w*\b/g, ' ')
    .replace(/[—–\-_·|]+/g, ' ')
    .replace(/\b(setlist|colecci[oó]n|mi|de|del|la|el|los|las)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
