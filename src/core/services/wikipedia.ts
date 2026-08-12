/**
 * Cliente de Wikidata y Wikipedia.
 *
 * Sirve para traer el párrafo introductorio del álbum (o, si no existe, del
 * artista) y mostrarlo como "datos curiosos" del disco, siempre junto a su
 * fuente y el enlace al artículo original.
 *
 * Cómo encuentra el artículo correcto:
 *   1. MusicBrainz guarda un enlace a Wikidata para muchos álbumes y artistas.
 *   2. Wikidata sabe en qué idiomas existe el artículo de Wikipedia.
 *   3. Wikipedia entrega el resumen de ese artículo.
 *
 * Se sigue esa cadena en vez de buscar por nombre en Wikipedia, porque buscar
 * por nombre confunde discos homónimos y artistas que se llaman igual.
 *
 * Ninguno de estos servicios requiere cuenta ni clave de acceso.
 */

import { USER_AGENT } from '../config'
import { getWikidataId } from './musicbrainz'

/** Idiomas en los que se busca el artículo, en orden de preferencia. */
const PREFERRED_WIKIS = [
  { site: 'eswiki', lang: 'es', label: 'Wikipedia en español' },
  { site: 'enwiki', lang: 'en', label: 'Wikipedia en inglés' }
] as const

export interface WikipediaExcerpt {
  /** Párrafo introductorio del artículo. */
  text: string
  /** Nombre de la fuente, para citarla en la ficha. */
  source: string
  /** Enlace al artículo completo. */
  url: string
  /** Si el texto habla del álbum o del artista. */
  about: 'album' | 'artista'
}

interface WikidataResponse {
  entities?: Record<
    string,
    { sitelinks?: Record<string, { title?: string } | undefined> }
  >
}

interface WikipediaSummary {
  type?: string
  title?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // Sin conexión o servicio caído: se sigue sin reseña.
    return null
  }
}

/** Pregunta a Wikidata en qué idiomas existe el artículo, y con qué título. */
async function getArticleTitles(
  wikidataId: string
): Promise<Array<{ title: string; lang: string; label: string }>> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&format=json&origin=*`
  const data = await fetchJson<WikidataResponse>(url)

  const sitelinks = data?.entities?.[wikidataId]?.sitelinks
  if (!sitelinks) return []

  const found: Array<{ title: string; lang: string; label: string }> = []
  for (const wiki of PREFERRED_WIKIS) {
    const title = sitelinks[wiki.site]?.title
    if (title) found.push({ title, lang: wiki.lang, label: wiki.label })
  }
  return found
}

/** Trae el resumen de un artículo concreto de Wikipedia. */
async function getSummary(
  title: string,
  lang: string,
  label: string
): Promise<Omit<WikipediaExcerpt, 'about'> | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  const data = await fetchJson<WikipediaSummary>(url)

  if (!data?.extract) return null

  // Las páginas de desambiguación listan artículos homónimos; no sirven como reseña.
  if (data.type && data.type !== 'standard') return null

  return {
    text: data.extract,
    source: label,
    url:
      data.content_urls?.desktop?.page ??
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
  }
}

/** Recorre los idiomas disponibles hasta encontrar un resumen utilizable. */
async function firstAvailableSummary(
  wikidataId: string
): Promise<Omit<WikipediaExcerpt, 'about'> | null> {
  for (const article of await getArticleTitles(wikidataId)) {
    const summary = await getSummary(article.title, article.lang, article.label)
    if (summary) return summary
  }
  return null
}

/**
 * Busca una reseña introductoria para el disco.
 *
 * Primero intenta con el álbum. Si el álbum no tiene artículo — algo común en
 * discos poco conocidos — usa el del artista, que suele existir. La ficha indica
 * cuál de los dos se está mostrando.
 *
 * Devuelve null si no hay nada. No es un error: simplemente no todos los discos
 * tienen artículo en Wikipedia.
 */
export async function fetchAlbumExcerpt(
  releaseGroupId: string | null,
  artistId: string | null
): Promise<WikipediaExcerpt | null> {
  if (releaseGroupId) {
    const albumWikidataId = await getWikidataId('release-group', releaseGroupId)
    if (albumWikidataId) {
      const summary = await firstAvailableSummary(albumWikidataId)
      if (summary) return { ...summary, about: 'album' }
    }
  }

  if (artistId) {
    const artistWikidataId = await getWikidataId('artist', artistId)
    if (artistWikidataId) {
      const summary = await firstAvailableSummary(artistWikidataId)
      if (summary) return { ...summary, about: 'artista' }
    }
  }

  return null
}
