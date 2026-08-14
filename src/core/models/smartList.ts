/**
 * Listas inteligentes: un filtro guardado con nombre.
 *
 * No guardan discos, guardan CRITERIOS. "Vinilos de los 70 en muy buen
 * estado" no es una lista de veinte discos congelada el día que se creó: es
 * una pregunta que se vuelve a hacer cada vez que se mira, así que un disco
 * que compres mañana y cumpla las condiciones entra solo, y uno que prestes
 * y devuelvas no se cae.
 *
 * Es la diferencia con un setlist, que sí es una lista de canciones elegidas
 * a mano y en un orden que la persona decidió.
 */

import type { PhysicalFormatId } from './formats'
import type { ConditionId } from './condition'

/**
 * Las condiciones de una lista.
 *
 * Son exactamente las mismas que los filtros de la pantalla de colección, y
 * eso es a propósito: una lista inteligente se crea guardando lo que ya
 * tienes filtrado, así que no puede haber criterios que la pantalla no sepa
 * expresar ni al revés.
 *
 * Todos opcionales, y se cumplen TODOS a la vez (y lógico). Un disco entra
 * solo si pasa cada condición que esté puesta.
 */
export interface SmartCriteria {
  /** Texto libre: busca en título, artista, sello y año. */
  texto?: string
  formato?: PhysicalFormatId | null
  genero?: string | null
  /** La década como año redondo: 1970, 1980... */
  decada?: number | null
  estado?: ConditionId | null
  etiqueta?: string | null
}

export interface SmartList {
  id: number
  name: string
  criteria: SmartCriteria
  /** Cuántos discos cumplen las condiciones AHORA. Se recalcula al leerla. */
  count: number
}

/** Lo mínimo que necesita `matches` de un disco. */
export interface FiltrableAlbum {
  title: string
  artists: string
  label: string | null
  year: number | null
  format: PhysicalFormatId
  condition: ConditionId | null
  genres: string[]
  tags: string[]
}

/** La década de un año: 1987 → 1980. Null cuando no hay año. */
export function decadeOf(year: number | null): number | null {
  if (year === null || !Number.isFinite(year)) return null
  return Math.floor(year / 10) * 10
}

/**
 * ¿Este disco cumple las condiciones?
 *
 * Vive en `core` y no en la pantalla porque lo usan los dos lados: la
 * colección para filtrar lo que se ve, y el inicio para contar cuántos hay
 * en cada lista. Si cada uno tuviera su copia, tarde o temprano dirían
 * números distintos sobre lo mismo.
 */
export function matches(album: FiltrableAlbum, criteria: SmartCriteria): boolean {
  const texto = criteria.texto?.trim().toLowerCase()
  if (texto) {
    const enAlgunCampo =
      album.title.toLowerCase().includes(texto) ||
      album.artists.toLowerCase().includes(texto) ||
      (album.label ?? '').toLowerCase().includes(texto) ||
      (album.year?.toString() ?? '').includes(texto)
    if (!enAlgunCampo) return false
  }

  if (criteria.formato && album.format !== criteria.formato) return false
  if (criteria.genero && !album.genres.includes(criteria.genero)) return false
  if (
    criteria.decada !== null &&
    criteria.decada !== undefined &&
    decadeOf(album.year) !== criteria.decada
  ) {
    return false
  }
  if (criteria.estado && album.condition !== criteria.estado) return false
  if (criteria.etiqueta && !album.tags.includes(criteria.etiqueta)) return false

  return true
}

/** Si no hay ninguna condición puesta, la lista sería "todos los discos". */
export function isEmpty(criteria: SmartCriteria): boolean {
  return (
    !criteria.texto?.trim() &&
    !criteria.formato &&
    !criteria.genero &&
    (criteria.decada === null || criteria.decada === undefined) &&
    !criteria.estado &&
    !criteria.etiqueta
  )
}

/**
 * Un nombre sugerido a partir de las condiciones.
 *
 * Se ofrece como valor inicial y se puede cambiar: lo automático acierta en
 * los casos simples y en los raros al menos ahorra escribir desde cero.
 */
export function suggestName(criteria: SmartCriteria, formatLabel?: string): string {
  const partes: string[] = []
  if (formatLabel) partes.push(formatLabel + 's')
  if (criteria.genero) partes.push(`de ${criteria.genero}`)
  if (criteria.decada !== null && criteria.decada !== undefined) {
    partes.push(`de los ${criteria.decada}`)
  }
  if (criteria.etiqueta) partes.push(`«${criteria.etiqueta}»`)
  if (criteria.texto?.trim()) partes.push(`que digan «${criteria.texto.trim()}»`)
  if (partes.length === 0) return 'Mi lista'
  const texto = partes.join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
