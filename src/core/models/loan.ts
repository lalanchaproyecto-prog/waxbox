/**
 * Préstamos de un disco.
 *
 * "Se lo presté a alguien" es de las cosas que más se olvidan en una colección
 * física, y de las que peor se recuperan: cuando te acuerdas ya no sabes a
 * quién fue.
 *
 * Hay historial y no solo el préstamo actual porque un disco se presta muchas
 * veces a lo largo de los años, y saber que siempre termina donde el mismo
 * amigo es justamente parte de la historia del disco.
 */

export interface Loan {
  id: number
  albumId: number
  /** A quién. Texto libre: no hay libreta de contactos ni hace falta. */
  person: string
  /** Cuándo salió, en AAAA-MM-DD. */
  lentAt: string
  /** Cuándo debería volver. Null si no se acordó nada. */
  dueAt: string | null
  /** Cuándo volvió. Null mientras siga afuera. */
  returnedAt: string | null
  notes: string | null
}

/** Un préstamo en curso es el que todavía no volvió. */
export function isActive(loan: Loan): boolean {
  return loan.returnedAt === null
}

/** La fecha de hoy en el formato que se guarda. */
export function today(): string {
  const now = new Date()
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const dia = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mes}-${dia}`
}

/**
 * Cuántos días pasaron de la fecha acordada. Negativo si todavía no llega.
 *
 * Null cuando no hay fecha acordada: sin fecha no hay retraso posible, y
 * mostrar "0 días" ahí sería inventarse un compromiso que nadie hizo.
 */
export function daysOverdue(loan: Loan, reference: string = today()): number | null {
  if (!loan.dueAt || loan.returnedAt) return null

  const vence = Date.parse(`${loan.dueAt}T00:00:00`)
  const hoy = Date.parse(`${reference}T00:00:00`)
  if (!Number.isFinite(vence) || !Number.isFinite(hoy)) return null

  return Math.round((hoy - vence) / 86400000)
}

/**
 * El aviso que se muestra sobre un préstamo en curso.
 *
 * Devuelve también qué tan urgente es, para que la interfaz decida el color sin
 * tener que repetir aquí las reglas de cuándo algo va tarde.
 */
export function loanStatus(loan: Loan): { text: string; tone: 'ok' | 'pronto' | 'tarde' } {
  const retraso = daysOverdue(loan)

  if (retraso === null) {
    return { text: `Prestado a ${loan.person}`, tone: 'ok' }
  }
  if (retraso > 0) {
    return {
      text: `Prestado a ${loan.person} — ${retraso === 1 ? 'hace 1 día que' : `hace ${retraso} días que`} debía volver`,
      tone: 'tarde'
    }
  }
  if (retraso === 0) {
    return { text: `Prestado a ${loan.person} — debería volver hoy`, tone: 'pronto' }
  }
  const faltan = -retraso
  return {
    text: `Prestado a ${loan.person} — vuelve en ${faltan === 1 ? '1 día' : `${faltan} días`}`,
    tone: faltan <= 7 ? 'pronto' : 'ok'
  }
}
