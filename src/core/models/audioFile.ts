/**
 * Archivos de audio propios de la persona.
 *
 * QUÉ SON Y QUÉ NO:
 * Son el audio de un disco que la persona YA TIENE en la mano — el código de
 * descarga que venía dentro del vinilo, o el CD que rippeó. No es streaming ni
 * una biblioteca digital: Waxbox sigue catalogando objetos físicos, y esto es
 * poder escuchar el objeto que ya está en el estante.
 *
 * POR QUÉ ESTOS FORMATOS Y NO OTROS:
 * La app reproduce con el motor que ya trae Electron por dentro (Chromium), sin
 * ninguna librería de audio. La lista de abajo es exactamente lo que ese motor
 * sabe decodificar. Agregar ALAC, WMA o AIFF no sería sumar una línea aquí:
 * habría que empaquetar un decodificador aparte.
 */

export interface AudioFormat {
  /** Extensión en minúsculas, sin el punto. Es lo que se guarda en la base. */
  id: string
  label: string
  /** Tipo MIME, para servir el archivo con la cabecera correcta. */
  mime: string
}

export const AUDIO_FORMATS: readonly AudioFormat[] = [
  { id: 'mp3', label: 'MP3', mime: 'audio/mpeg' },
  { id: 'm4a', label: 'M4A / AAC', mime: 'audio/mp4' },
  { id: 'aac', label: 'AAC', mime: 'audio/aac' },
  { id: 'flac', label: 'FLAC', mime: 'audio/flac' },
  { id: 'wav', label: 'WAV', mime: 'audio/wav' },
  { id: 'ogg', label: 'OGG', mime: 'audio/ogg' },
  { id: 'opus', label: 'Opus', mime: 'audio/ogg' }
]

/** Las extensiones sueltas, para el diálogo de elegir archivos. */
export const AUDIO_EXTENSIONS: readonly string[] = AUDIO_FORMATS.map((f) => f.id)

/** Saca la extensión de una ruta, en minúsculas y sin el punto. */
export function extensionOf(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path.trim())
  return match ? match[1].toLowerCase() : ''
}

export function isSupportedAudio(path: string): boolean {
  return AUDIO_FORMATS.some((format) => format.id === extensionOf(path))
}

export function mimeFor(format: string): string {
  return AUDIO_FORMATS.find((f) => f.id === format)?.mime ?? 'application/octet-stream'
}

/** El archivo propio asociado a una canción. */
export interface TrackFile {
  path: string
  format: string
  /**
   * Si el archivo sigue estando donde se registró. Se comprueba al leerlo, no
   * al guardarlo: la persona puede mover o borrar la carpeta en cualquier
   * momento, y la app tiene que decirlo en vez de fallar sin explicación.
   */
  missing: boolean
}

/**
 * Normaliza un nombre para emparejar un archivo con una canción.
 *
 * Se usa al asociar una carpeta entera de golpe: los archivos suelen llamarse
 * "03 - Título de la canción.mp3" o "Artista - Título.flac", así que hay que
 * quitar el número de pista, la extensión y la puntuación antes de comparar.
 */
export function comparableFileName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    // Número de pista al principio: "03 ", "03. ", "03 - ", "A1 ".
    .replace(/^\s*[a-d]?\d{1,3}\s*[-._)]*\s*/i, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
