/**
 * Cliente de la API de MusicBrainz.
 *
 * MusicBrainz es una base de datos abierta de música, mantenida por la comunidad.
 * No requiere cuenta ni clave de acceso, pero sí exige dos cosas:
 *   1. Identificarse con un User-Agent (ver ../config.ts).
 *   2. No hacer más de una petición por segundo (ver ./rateLimiter.ts).
 *
 * Este módulo no depende de Electron ni de Windows: solo usa fetch, que existe
 * tanto en Node como en el navegador.
 *
 * Documentación: https://musicbrainz.org/doc/MusicBrainz_API
 */

import { USER_AGENT, MUSICBRAINZ_MIN_INTERVAL_MS } from '../config'
import { createRateLimiter } from './rateLimiter'
import { formatUsesSides } from '../models/formats'

const API_BASE = 'https://musicbrainz.org/ws/2'

const schedule = createRateLimiter(MUSICBRAINZ_MIN_INTERVAL_MS)

/** Error con un mensaje entendible para mostrar en la interfaz. */
export class MusicBrainzError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MusicBrainzError'
  }
}

// --------------------------------------------------------------------------
// Lo que este módulo devuelve
// --------------------------------------------------------------------------

/** Un candidato de la búsqueda: lo mínimo para que la persona reconozca su edición. */
export interface ReleaseCandidate {
  musicbrainzId: string
  title: string
  artist: string
  year: number | null
  country: string | null
  /** Formato según MusicBrainz, por ejemplo: 12" Vinyl, CD, Cassette. */
  mediaFormat: string | null
  trackCount: number | null
  /** Aclaración de MusicBrainz para distinguir ediciones parecidas. */
  disambiguation: string | null
}

export interface ReleaseTrack {
  /** Artista de esta canción. En un compilatorio cambia de una canción a otra. */
  artist: string
  /** 'A', 'B', 'C'... en vinilo y casete; número de disco en CD; 'N/A' si no se sabe. */
  side: string
  /** Número de la canción dentro de su lado o disco. */
  number: number
  title: string
  /** Duración legible, por ejemplo "4:26". Null si MusicBrainz no la tiene. */
  duration: string | null
}

export interface ReleaseDetails {
  musicbrainzId: string
  /**
   * Identificador del "grupo de lanzamiento": el álbum como obra, por encima de
   * sus ediciones concretas. Sirve para buscar la portada del álbum cuando esta
   * edición en particular no tiene una propia.
   */
  releaseGroupId: string | null
  title: string
  /** Artista principal del álbum. En un compilatorio suele ser "Various Artists". */
  artists: string
  /** Identificador del artista principal en MusicBrainz, para buscar su reseña. */
  artistId: string | null
  /** Año de esta edición en particular. */
  year: number | null
  /** Año en que salió el álbum por primera vez. Difiere si esta copia es una reedición. */
  originalYear: number | null
  genres: string[]
  label: string | null
  tracks: ReleaseTrack[]
}

// --------------------------------------------------------------------------
// Forma de la respuesta de MusicBrainz (solo los campos que usamos)
// --------------------------------------------------------------------------

interface RawArtistCredit {
  name: string
  joinphrase?: string
  artist?: { id?: string }
}

interface RawTrack {
  position: number
  /** Numeración impresa en el disco: "1", "A1", "C4"... */
  number: string
  title: string
  /** Duración en milisegundos. */
  length: number | null
  'artist-credit'?: RawArtistCredit[]
}

interface RawMedium {
  position: number
  format?: string | null
  tracks?: RawTrack[]
}

interface RawGenre {
  name: string
  count: number
}

interface RawRelation {
  type?: string
  url?: { resource?: string }
}

interface RawRelease {
  id: string
  title: string
  date?: string
  country?: string | null
  disambiguation?: string
  'track-count'?: number
  'artist-credit'?: RawArtistCredit[]
  'label-info'?: Array<{ label?: { name?: string } | null }>
  'release-group'?: {
    id?: string
    'first-release-date'?: string
    genres?: RawGenre[]
  }
  genres?: RawGenre[]
  media?: RawMedium[]
}

// --------------------------------------------------------------------------
// Ayudantes
// --------------------------------------------------------------------------

async function request<T>(url: string): Promise<T> {
  const response = await schedule(() =>
    fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      }
    })
  )

  if (response.status === 404) {
    throw new MusicBrainzError('MusicBrainz no encontró ese álbum.')
  }
  if (response.status === 503) {
    throw new MusicBrainzError(
      'MusicBrainz está recibiendo demasiadas consultas. Espera un momento y vuelve a intentar.'
    )
  }
  if (!response.ok) {
    throw new MusicBrainzError(
      `MusicBrainz respondió con un error (${response.status}). Revisa tu conexión a internet.`
    )
  }

  return (await response.json()) as T
}

/**
 * Une los créditos de artista respetando cómo MusicBrainz los separa.
 * Por ejemplo: [{name:'Bee Gees'}] o [{name:'Jay-Z', joinphrase:' feat. '}, {name:'Rihanna'}].
 */
function creditToString(credits: RawArtistCredit[] | undefined): string {
  if (!credits || credits.length === 0) return ''
  return credits.map((credit) => credit.name + (credit.joinphrase ?? '')).join('').trim()
}

/** Saca el año de una fecha de MusicBrainz, que puede ser "1990" o "1990-05-23". */
function parseYear(date: string | undefined): number | null {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

/** Convierte milisegundos a un texto tipo "4:26". */
function formatDuration(lengthMs: number | null): string | null {
  if (!lengthMs || lengthMs <= 0) return null
  const totalSeconds = Math.round(lengthMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Interpreta la numeración impresa en el disco.
 * En vinilo y casete viene como "A1", "B3", "C4" (lado + número).
 * En CD viene como "1", "2", "3" (solo número).
 */
function parseTrackNumber(
  raw: string,
  position: number
): { sideLabel: string | null; number: number } {
  const withSide = /^([A-Za-z]+)\s*(\d+)/.exec(raw ?? '')
  if (withSide) {
    return { sideLabel: withSide[1].toUpperCase(), number: Number.parseInt(withSide[2], 10) }
  }
  const onlyDigits = /(\d+)/.exec(raw ?? '')
  return {
    sideLabel: null,
    number: onlyDigits ? Number.parseInt(onlyDigits[1], 10) : position
  }
}

/** Toma los géneros del álbum. MusicBrainz suele tenerlos en el "release-group". */
function extractGenres(release: RawRelease): string[] {
  const source =
    release.genres && release.genres.length > 0
      ? release.genres
      : (release['release-group']?.genres ?? [])

  return [...source]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((genre) => genre.name)
}

/** Junta los sellos discográficos, sin repetir. */
function extractLabel(release: RawRelease): string | null {
  const names = (release['label-info'] ?? [])
    .map((info) => info.label?.name)
    .filter((name): name is string => Boolean(name))

  const unique = [...new Set(names)]
  return unique.length > 0 ? unique.join(', ') : null
}

// --------------------------------------------------------------------------
// Funciones públicas
// --------------------------------------------------------------------------

/**
 * Busca ediciones que coincidan con el artista y el álbum escritos por la persona.
 * Devuelve varias candidatas porque un mismo álbum suele tener muchas ediciones
 * (distintos países, años y formatos), y solo la persona sabe cuál es la suya.
 */
export async function searchReleases(
  artist: string,
  album: string,
  limit = 10
): Promise<ReleaseCandidate[]> {
  if (!artist.trim() || !album.trim()) {
    throw new MusicBrainzError('Hace falta el artista y el nombre del álbum para buscar.')
  }

  // Las comillas delimitan cada término en el buscador de MusicBrainz,
  // así que hay que escapar las que venga en el texto de la persona.
  const escape = (value: string): string => value.replace(/["\\]/g, '\\$&')
  const query = `artist:"${escape(artist.trim())}" AND release:"${escape(album.trim())}"`
  const url = `${API_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`

  const data = await request<{ releases?: RawRelease[] }>(url)

  return (data.releases ?? []).map((release) => ({
    musicbrainzId: release.id,
    title: release.title,
    artist: creditToString(release['artist-credit']),
    year: parseYear(release.date),
    country: release.country ?? null,
    mediaFormat: release.media?.[0]?.format ?? null,
    trackCount: release['track-count'] ?? null,
    disambiguation: release.disambiguation || null
  }))
}

/** Un enlace oficial del artista, listo para mostrar en la ficha. */
export interface ArtistLink {
  url: string
  /** Nombre de la plataforma, deducido del dominio. */
  platform: string
  /** Emoji que la representa. */
  icon: string
}

/**
 * Deduce a qué plataforma pertenece un enlace, mirando su dominio.
 * Si no se reconoce, se muestra el dominio tal cual, que ya es informativo.
 */
function describeLink(url: string): { platform: string; icon: string } {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      return ''
    }
  })()

  const known: Array<[string, string, string]> = [
    ['facebook.com', 'Facebook', '\u{1F465}'],
    ['instagram.com', 'Instagram', '\u{1F4F7}'],
    ['twitter.com', 'X (Twitter)', '\u{1F426}'],
    ['x.com', 'X (Twitter)', '\u{1F426}'],
    ['youtube.com', 'YouTube', '\u{1F4FA}'],
    ['tiktok.com', 'TikTok', '\u{1F3B5}'],
    ['bandcamp.com', 'Bandcamp', '\u{1F3B8}'],
    ['soundcloud.com', 'SoundCloud', '\u{1F50A}'],
    ['mastodon.social', 'Mastodon', '\u{1F418}'],
    ['bsky.app', 'Bluesky', '\u{1F98B}']
  ]

  for (const [domain, platform, icon] of known) {
    if (host === domain || host.endsWith(`.${domain}`)) return { platform, icon }
  }

  return { platform: host || 'Sitio web', icon: '\u{1F310}' }
}

/**
 * Trae los enlaces oficiales del artista: su página web y sus redes sociales.
 *
 * MusicBrainz ya guarda estos enlaces como relaciones del artista, así que no
 * hace falta consultar ninguna fuente nueva. Se filtran solo los que son
 * oficiales del artista; se dejan fuera bases de datos, tiendas y servicios de
 * streaming, que no son "del artista" sino sitios que hablan de él.
 *
 * Devuelve una lista vacía si no hay ninguno, lo cual es normal.
 */
export async function getArtistLinks(artistId: string): Promise<ArtistLink[]> {
  const url = `${API_BASE}/artist/${artistId}?fmt=json&inc=url-rels`

  let data: { relations?: RawRelation[] }
  try {
    data = await request<{ relations?: RawRelation[] }>(url)
  } catch {
    return []
  }

  const WANTED = new Set(['official homepage', 'social network', 'youtube'])

  const links: ArtistLink[] = []
  const seen = new Set<string>()

  for (const relation of data.relations ?? []) {
    if (!relation.type || !WANTED.has(relation.type)) continue

    const resource = relation.url?.resource
    if (!resource || seen.has(resource)) continue
    seen.add(resource)

    links.push({ url: resource, ...describeLink(resource) })
  }

  return links
}

/**
 * Busca el identificador de Wikidata asociado a un álbum o a un artista.
 *
 * MusicBrainz guarda enlaces a otros sitios, entre ellos Wikidata. Seguir ese
 * enlace es mucho más confiable que buscar el álbum por su nombre en Wikipedia:
 * evita confundir discos que se llaman igual o artistas homónimos.
 *
 * Devuelve null si no hay enlace, que es un caso normal y no un error.
 */
export async function getWikidataId(
  entity: 'release-group' | 'artist',
  mbid: string
): Promise<string | null> {
  const url = `${API_BASE}/${entity}/${mbid}?fmt=json&inc=url-rels`

  let data: { relations?: RawRelation[] }
  try {
    data = await request<{ relations?: RawRelation[] }>(url)
  } catch {
    // Que no exista la reseña no debe impedir registrar el disco.
    return null
  }

  const wikidataUrl = (data.relations ?? []).find(
    (relation) => relation.type === 'wikidata'
  )?.url?.resource

  if (!wikidataUrl) return null

  // El enlace tiene la forma https://www.wikidata.org/wiki/Q5031525
  const match = /\/(Q\d+)\s*$/.exec(wikidataUrl.trim())
  return match ? match[1] : null
}

/**
 * Trae todos los datos de una edición concreta, incluido el tracklist completo.
 *
 * @param physicalFormatId Formato que marcó la persona (vinilo, cd, casete).
 *   Se usa solo para decidir cómo numerar los lados cuando MusicBrainz no lo indica.
 */
export async function getReleaseDetails(
  musicbrainzId: string,
  physicalFormatId: string
): Promise<ReleaseDetails> {
  const inc = 'artist-credits+labels+recordings+release-groups+genres'
  const url = `${API_BASE}/release/${musicbrainzId}?fmt=json&inc=${inc}`

  const release = await request<RawRelease>(url)

  const usesSides = formatUsesSides(physicalFormatId)
  const albumArtist = creditToString(release['artist-credit'])

  const tracks: ReleaseTrack[] = []
  for (const medium of release.media ?? []) {
    for (const track of medium.tracks ?? []) {
      const { sideLabel, number } = parseTrackNumber(track.number, track.position)

      // Si el disco trae la letra impresa (A1, C4) se respeta.
      // Si no, en formatos de dos caras no se puede adivinar el lado; en los
      // numerados por disco se usa el número del disco.
      const side = sideLabel ?? (usesSides ? 'N/A' : String(medium.position))

      tracks.push({
        // Si la canción no trae su propio artista, se asume el del álbum.
        artist: creditToString(track['artist-credit']) || albumArtist,
        side,
        number,
        title: track.title,
        duration: formatDuration(track.length)
      })
    }
  }

  return {
    musicbrainzId: release.id,
    releaseGroupId: release['release-group']?.id ?? null,
    title: release.title,
    artists: albumArtist,
    artistId: release['artist-credit']?.[0]?.artist?.id ?? null,
    year: parseYear(release.date),
    originalYear: parseYear(release['release-group']?.['first-release-date']),
    genres: extractGenres(release),
    label: extractLabel(release),
    tracks
  }
}
