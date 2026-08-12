export type ConditionId = 'nuevo' | 'muy-bueno' | 'bueno' | 'regular'

export interface ConditionOption {
  id: ConditionId
  label: string
  short: string
}

export const CONDITIONS: readonly ConditionOption[] = [
  { id: 'nuevo', label: 'Nuevo / Sellado', short: 'Nuevo' },
  { id: 'muy-bueno', label: 'Muy bueno', short: 'Muy bueno' },
  { id: 'bueno', label: 'Bueno', short: 'Bueno' },
  { id: 'regular', label: 'Regular', short: 'Regular' }
]

export function conditionLabel(id: string | null): string {
  if (!id) return 'Sin evaluar'
  return CONDITIONS.find((c) => c.id === id)?.label ?? id
}

export function conditionShort(id: string | null): string {
  if (!id) return '—'
  return CONDITIONS.find((c) => c.id === id)?.short ?? id
}
