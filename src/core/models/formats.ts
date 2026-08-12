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
