/**
 * Cliente de la YouTube Data API v3.
 *
 * A diferencia de las demás fuentes, YouTube sí exige una clave de acceso.
 * Cada persona usa la suya, gratuita, que configura desde la pantalla de
 * Configuración de Melôfyle. La clave nunca viaja a ningún servidor nuestro:
 * se guarda cifrada en el computador de cada quien.
 *
 * Esta función es OPCIONAL. Sin clave, Melôfyle funciona completo; lo único que
 * no aparece es el botón de escuchar cada canción.
 *
 * Este módulo no guarda ni conoce dónde vive la clave: la recibe como
 * parámetro, para no depender de Electron ni del sistema de archivos.
 *
 * Documentación: https://developers.google.com/youtube/v3
 */

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface YouTubeVideo {
  videoId: string
  title: string
  /** Enlace listo para abrir en el navegador. */
  url: string
}

export type KeyCheckResult = { ok: true } | { ok: false; reason: string }

interface GoogleErrorBody {
  error?: {
    code?: number
    message?: string
    errors?: Array<{ reason?: string }>
    details?: Array<{ reason?: string }>
  }
}

/**
 * Traduce los errores de Google a un mensaje que se entienda.
 *
 * Nunca incluye la clave ni la dirección consultada en el mensaje, para que no
 * termine copiada en un reporte de error o en la consola.
 */
function explainError(status: number, body: GoogleErrorBody | null): string {
  const reasons = [
    ...(body?.error?.details ?? []).map((detail) => detail.reason),
    ...(body?.error?.errors ?? []).map((error) => error.reason)
  ].filter(Boolean)

  const has = (needle: string): boolean =>
    reasons.some((reason) => reason?.toLowerCase().includes(needle.toLowerCase()))

  if (has('API_KEY_INVALID') || has('keyInvalid')) {
    return 'La clave no es válida. Revisa que la hayas copiado completa, sin espacios al inicio ni al final.'
  }
  if (has('SERVICE_DISABLED') || has('accessNotConfigured')) {
    return 'La clave es válida, pero falta habilitar "YouTube Data API v3" en tu proyecto de Google Cloud. Revisa el paso 4 de la guía.'
  }
  if (has('quotaExceeded') || has('RATE_LIMIT_EXCEEDED') || has('dailyLimitExceeded')) {
    return 'Se agotó tu cuota diaria de YouTube. Vuelve a intentar mañana; la cuota se reinicia sola.'
  }
  if (has('API_KEY_HTTP_REFERRER_BLOCKED') || has('API_KEY_IP_ADDRESS_BLOCKED')) {
    return 'La clave tiene restricciones que bloquean a Melôfyle. En Google Cloud, deja la restricción de aplicación en "Ninguna" y restringe solo por API.'
  }
  if (status === 403) {
    return 'Google rechazó la consulta. Revisa que la API esté habilitada y que la clave no tenga restricciones.'
  }
  if (status === 400) {
    return 'La clave no es válida. Revisa que la hayas copiado completa.'
  }
  return `YouTube respondió con un error (${status}). Revisa tu conexión a internet.`
}

/** Hace la consulta y devuelve el cuerpo, o lanza un error ya traducido. */
async function request<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}?${query}`)
  } catch {
    throw new Error('No se pudo conectar con YouTube. Revisa tu conexión a internet.')
  }

  if (!response.ok) {
    let body: GoogleErrorBody | null = null
    try {
      body = (await response.json()) as GoogleErrorBody
    } catch {
      body = null
    }
    throw new Error(explainError(response.status, body))
  }

  return (await response.json()) as T
}

/**
 * Comprueba que la clave sirva, sin gastar cuota apreciable.
 *
 * Se consulta un video conocido en vez de hacer una búsqueda: consultar cuesta
 * 1 unidad de las 10.000 diarias, mientras que buscar cuesta 100. Así, probar
 * la clave no le quita a la persona búsquedas que podría usar para su música.
 */
export async function checkApiKey(apiKey: string): Promise<KeyCheckResult> {
  const key = apiKey.trim()
  if (!key) {
    return { ok: false, reason: 'Escribe tu clave antes de guardar.' }
  }

  try {
    await request('/videos', { part: 'id', id: 'dQw4w9WgXcQ', key })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'No se pudo verificar la clave.'
    }
  }
}

interface SearchResponse {
  items?: Array<{
    id?: { videoId?: string }
    snippet?: { title?: string }
  }>
}

/**
 * Busca en YouTube el video de una canción.
 *
 * Recibe el artista de esa canción en particular, no el del álbum: en un
 * compilatorio cada canción es de alguien distinto, y buscar por el artista
 * correcto es lo que hace que el resultado sea el acertado.
 *
 * Devuelve null si no hay resultados. Cada búsqueda gasta 100 de las 10.000
 * unidades diarias, por eso solo se llama cuando la persona lo pide.
 */
export async function searchTrackVideo(
  apiKey: string,
  artist: string,
  trackTitle: string
): Promise<YouTubeVideo | null> {
  const key = apiKey.trim()
  if (!key) {
    throw new Error('Falta configurar tu clave de YouTube en Configuración.')
  }

  const data = await request<SearchResponse>('/search', {
    part: 'snippet',
    q: `${artist} ${trackTitle}`.trim(),
    type: 'video',
    maxResults: '1',
    key
  })

  const first = data.items?.[0]
  const videoId = first?.id?.videoId
  if (!videoId) return null

  return {
    videoId,
    title: first?.snippet?.title ?? trackTitle,
    url: `https://www.youtube.com/watch?v=${videoId}`
  }
}
