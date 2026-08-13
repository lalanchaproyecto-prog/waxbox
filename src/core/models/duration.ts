/**
 * Duraciones de canciones.
 *
 * MusicBrainz las entrega ya formateadas como "4:26", así que aquí se convierten
 * a segundos para poder sumarlas, y de vuelta a texto para mostrar el total de
 * un setlist.
 */

/** Convierte "4:26" o "1:02:30" a segundos. Null si no hay dato o no se entiende. */
export function durationToSeconds(duration: string | null): number | null {
  if (!duration) return null

  const parts = duration.split(':').map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => !Number.isFinite(part))) return null

  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

/**
 * Texto legible para una suma de duraciones: "48 min", "1 h 12 min".
 * Para listas cortas cae a segundos: "3 min 20 s".
 */
export function formatTotalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '—'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  }
  if (minutes > 0) {
    return `${minutes} min`
  }
  return `${seconds} s`
}
