/**
 * Formatos físicos que Waxbox puede catalogar.
 *
 * Waxbox es exclusivamente para música en formato físico: algo que la persona posee
 * y puede tocar. Música digital, streaming y archivos de audio quedan fuera del alcance.
 *
 * PARA AGREGAR UN FORMATO NUEVO:
 * 1. Agrega su identificador al tipo `PhysicalFormatId` de abajo.
 * 2. Agrega su entrada a `PHYSICAL_FORMATS`.
 * No hace falta tocar nada más: el formulario, la base de datos y la ficha del álbum
 * leen esta lista y se adaptan solos.
 */

export type PhysicalFormatId = 'vinilo' | 'cd' | 'casete'

export interface PhysicalFormat {
  /** Identificador estable. Es lo que se guarda en la base de datos, nunca cambia. */
  id: PhysicalFormatId
  /** Nombre que ve la persona en la interfaz. */
  label: string
  /**
   * Si el formato tiene dos caras físicas (lado A / lado B).
   * El vinilo y el casete sí; el CD no, se numera por disco.
   */
  usesSides: boolean
  /** Emoji que representa el formato en la interfaz. */
  icon: string
}

export const PHYSICAL_FORMATS: readonly PhysicalFormat[] = [
  { id: 'vinilo', label: 'Vinilo', usesSides: true, icon: '\u{1F4C0}' },
  { id: 'cd', label: 'CD', usesSides: false, icon: '\u{1F4BF}' },
  { id: 'casete', label: 'Casete', usesSides: true, icon: '\u{1F4FC}' }
]

/** Devuelve la definición de un formato, o `undefined` si el identificador no existe. */
export function getFormat(id: string): PhysicalFormat | undefined {
  return PHYSICAL_FORMATS.find((format) => format.id === id)
}

/** Comprueba que un texto cualquiera sea un identificador de formato válido. */
export function isValidFormatId(id: string): id is PhysicalFormatId {
  return PHYSICAL_FORMATS.some((format) => format.id === id)
}

/**
 * Indica si el tracklist de este formato debe organizarse por lados (A/B).
 * Se usa al armar el tracklist que viene de MusicBrainz.
 */
export function formatUsesSides(id: string): boolean {
  return getFormat(id)?.usesSides ?? false
}

/**
 * Lados que se pueden elegir al escribir un tracklist a mano.
 *
 * En vinilo y casete son caras (A, B, C, D); en los formatos numerados por
 * disco, como el CD, son discos (1, 2, 3). 'N/A' es la salida para cuando el
 * dato no está impreso en ninguna parte, y es el mismo valor que usa el
 * tracklist que llega de MusicBrainz cuando tampoco puede saberlo.
 */
export function sideOptionsFor(id: string): Array<{ value: string; label: string }> {
  const options = formatUsesSides(id)
    ? ['A', 'B', 'C', 'D'].map((letter) => ({ value: letter, label: `Lado ${letter}` }))
    : ['1', '2', '3'].map((number) => ({ value: number, label: `Disco ${number}` }))

  return [...options, { value: 'N/A', label: 'Sin especificar' }]
}

/** Lado por omisión al agregar una canción a mano. */
export function defaultSideFor(id: string): string {
  return formatUsesSides(id) ? 'A' : '1'
}
