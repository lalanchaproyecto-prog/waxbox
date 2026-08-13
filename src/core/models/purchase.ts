/**
 * Registro de compra de una copia.
 *
 * Es la historia de CÓMO llegó ese disco al estante: dónde se compró, cuándo y
 * cuánto costó. Los tres campos son opcionales por separado — la mayoría de la
 * gente recuerda la feria pero no el día exacto, o el precio pero no la fecha.
 *
 * POR QUÉ EL PRECIO ES TEXTO Y NO UN NÚMERO:
 * porque la gente escribe "$12.000", "15 lucas", "me lo regalaron", "cambio por
 * dos casetes". Forzar un número obligaría a rechazar todo eso, y el valor de
 * este campo es justamente el recuerdo, no la contabilidad. Si algún día hace
 * falta sumar precios, se puede extraer el número de los que lo tengan sin
 * haber perdido los demás.
 */

export interface Purchase {
  /** Dónde: la tienda, la feria, la persona. */
  place: string | null
  /**
   * Cuándo, en formato AAAA-MM-DD.
   *
   * Se guarda así y no como fecha del sistema para que ordene bien como texto y
   * para no arrastrar zonas horarias a un dato que no las necesita.
   */
  date: string | null
  /** Cuánto, tal como lo escriba la persona. */
  price: string | null
}

export const EMPTY_PURCHASE: Purchase = { place: null, date: null, price: null }

/** Si hay algo que mostrar. Un registro vacío no ocupa sitio en la ficha. */
export function hasPurchase(purchase: Purchase): boolean {
  return Boolean(purchase.place || purchase.date || purchase.price)
}

/** El año de compra, para agrupar. Null si no hay fecha o no se entiende. */
export function purchaseYear(purchase: Purchase): number | null {
  if (!purchase.date) return null
  const year = Number.parseInt(purchase.date.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

/** Fecha legible en español: "1970-03-15" → "15 de marzo de 1970". */
export function formatPurchaseDate(date: string | null): string | null {
  if (!date) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return date

  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]

  const mes = meses[Number.parseInt(match[2], 10) - 1]
  if (!mes) return date

  return `${Number.parseInt(match[3], 10)} de ${mes} de ${match[1]}`
}
