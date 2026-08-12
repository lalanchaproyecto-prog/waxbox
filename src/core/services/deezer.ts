/**
 * Cliente de la API pública de Deezer.
 *
 * Deezer permite buscar canciones sin cuenta, sin clave y sin trámite alguno,
 * y devuelve un adelanto de 30 segundos en MP3 de cada una. Por eso es la forma
 * principal de escuchar en Waxbox: funciona de entrada para cualquier persona
 * que instale la aplicación, sin pedirle nada.
 *
 * DETALLE IMPORTANTE — los enlaces de audio caducan:
 * La dirección del adelanto lleva una firma con fecha de vencimiento (unas 5
 * horas). Guardarla en la base de datos dejaría la colección llena de enlaces
 * muertos al día siguiente. Por eso Waxbox guarda el IDENTIFICADOR de la
 * canción en Deezer, que no caduca, y pide una dirección nueva justo en el
 * momento de reproducir.
 *
 * Documentación: https://developers.deezer.com/api
 */

import { createRateLimiter } from './rateLimiter'

const API_BASE = 'https://api.deezer.com'

// Deezer tolera bastantes consultas seguidas, pero se dejan unos milisegundos
// entre una y otra por cortesía, ya que un álbum dispara una por canción.
const schedule = createRateLimiter(120)

/** Referencia estable a una canción en Deezer. Esto es lo que se guarda. */
export interface DeezerTrackRef {
  /** Identificador de la canción en Deezer. No caduca. */
  trackId: number
  /** Título tal como lo tiene Deezer, para poder comprobar que coincide. */
  title: string
  artist: string
  /** Página de la canción en Deezer. */
  deezerUrl: string
}

interface RawTrack {
  id?: number
  title?: string
  link?: string
  preview?: string
  artist?: { name?: string }
}

async function request<T>(path: string): Promise<T | null> {
  try {
    const response = await schedule(() => fetch(`${API_BASE}${path}`))
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // Sin conexión o servicio caído: se sigue sin adelanto, que no es motivo
    // para frenar el registro del disco.
    return null
  }
}

/** Escapa las comillas, que en el buscador de Deezer delimitan cada término. */
function escapeTerm(value: string): string {
  return value.replace(/["\\]/g, ' ').trim()
}

/**
 * Busca una canción en Deezer y devuelve su referencia estable.
 *
 * Recibe el artista de esa canción en particular, no el del álbum: en un
 * compilatorio cada canción es de alguien distinto.
 *
 * Devuelve null si no la encuentra, que es un caso normal y no un error.
 */
export async function findTrack(
  artist: string,
  trackTitle: string
): Promise<DeezerTrackRef | null> {
  const query = `artist:"${escapeTerm(artist)}" track:"${escapeTerm(trackTitle)}"`
  const data = await request<{ data?: RawTrack[] }>(
    `/search?q=${encodeURIComponent(query)}&limit=1`
  )

  const first = data?.data?.[0]
  if (!first?.id) return null

  return {
    trackId: first.id,
    title: first.title ?? trackTitle,
    artist: first.artist?.name ?? artist,
    deezerUrl: first.link ?? `https://www.deezer.com/track/${first.id}`
  }
}

/**
 * Pide una dirección de audio nueva para una canción.
 *
 * Se llama justo antes de reproducir, porque estas direcciones vencen a las
 * pocas horas. Devuelve null si Deezer ya no ofrece adelanto de esa canción.
 */
export async function getPreviewUrl(trackId: number): Promise<string | null> {
  const track = await request<RawTrack>(`/track/${trackId}`)
  const preview = track?.preview
  // Deezer devuelve cadena vacía cuando la canción no tiene adelanto.
  return preview && preview.length > 0 ? preview : null
}

/**
 * Busca los adelantos de varias canciones a la vez.
 *
 * Se hacen de a pocas en paralelo en vez de una por una: un álbum puede tener
 * 17 canciones y hacerlas en fila haría esperar demasiado.
 */
export async function findTracks(
  tracks: Array<{ artist: string; title: string }>,
  concurrency = 5
): Promise<Array<DeezerTrackRef | null>> {
  const results = new Array<DeezerTrackRef | null>(tracks.length).fill(null)
  let next = 0

  async function worker(): Promise<void> {
    while (next < tracks.length) {
      const index = next++
      const track = tracks[index]
      results[index] = await findTrack(track.artist, track.title)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tracks.length) }, worker)
  await Promise.all(workers)

  return results
}
