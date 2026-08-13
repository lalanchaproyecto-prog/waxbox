/**
 * Qué información se puede incluir al exportar.
 *
 * La misma infraestructura sirve para exportar la colección entera y para
 * exportar un setlist: solo cambia la lista de campos que aplica a cada caso.
 *
 * La selección de la persona se recuerda entre sesiones, así que estos
 * identificadores no deberían cambiar una vez publicados: si cambian, la
 * selección guardada deja de reconocerse y vuelve a los valores por omisión.
 */

export type ExportKind = 'collection' | 'setlist'
export type ExportFormat = 'xlsx' | 'pdf'

/**
 * El contrato entre la ventana y el proceso principal.
 *
 * Vive aquí, en core, y no junto al código que exporta, porque el preload
 * también necesita estos tipos y no debe arrastrar módulos del proceso
 * principal — que usan `fs`, `electron` y exceljs — al proyecto de la ventana.
 */
export interface ExportRequest {
  kind: ExportKind
  format: ExportFormat
  fields: string[]
  /** Colección activa. Exportar nunca mezcla discos de colecciones distintas. */
  collectionId: number
  /** Obligatorio cuando kind es 'setlist'. */
  setlistId?: number
}

export interface ExportOutcome {
  /** Dónde quedó el archivo, o null si se canceló el diálogo de guardar. */
  path: string | null
}

/** Aviso de avance para la interfaz: qué se está haciendo y cuánto falta. */
export interface ExportProgress {
  stage: 'covers' | 'building' | 'writing'
  done: number
  total: number
}

export interface ExportFieldDefinition {
  id: string
  label: string
  /** Aclaración de cómo se ve ese campo en el archivo exportado. */
  hint?: string
  /** Si el campo solo tiene sentido en uno de los dos formatos. */
  onlyIn?: ExportFormat
  defaultOn: boolean
}

export const COLLECTION_FIELDS: readonly ExportFieldDefinition[] = [
  { id: 'cover', label: 'Portada', hint: 'Imagen embebida, no un enlace', defaultOn: true },
  { id: 'artist', label: 'Artista', defaultOn: true },
  { id: 'title', label: 'Álbum', defaultOn: true },
  { id: 'year', label: 'Año', defaultOn: true },
  { id: 'genres', label: 'Género', defaultOn: true },
  { id: 'label', label: 'Sello', defaultOn: true },
  { id: 'format', label: 'Formato', hint: 'Vinilo, CD o casete', defaultOn: true },
  { id: 'condition', label: 'Estado de conservación', defaultOn: true },
  { id: 'tags', label: 'Tus etiquetas', defaultOn: false },
  { id: 'notes', label: 'Tus notas', defaultOn: false },
  {
    id: 'tracklist',
    label: 'Tracklist completo',
    hint: 'En Excel va en una segunda hoja, una fila por canción',
    defaultOn: false
  },
  {
    id: 'credits',
    label: 'Créditos de las canciones',
    hint: 'Solo si incluyes el tracklist. Alarga bastante el archivo',
    defaultOn: false
  },
  { id: 'review', label: 'Reseña del álbum', defaultOn: false },
  { id: 'artistLinks', label: 'Enlaces del artista', defaultOn: false }
]

export const SETLIST_FIELDS: readonly ExportFieldDefinition[] = [
  { id: 'position', label: 'Número de orden', defaultOn: true },
  { id: 'title', label: 'Canción', defaultOn: true },
  { id: 'artist', label: 'Artista', defaultOn: true },
  { id: 'duration', label: 'Duración', defaultOn: true },
  { id: 'album', label: 'Álbum de origen', defaultOn: true },
  { id: 'cover', label: 'Portada del álbum', hint: 'Imagen embebida', defaultOn: false },
  {
    id: 'notesColumn',
    label: 'Columna en blanco para notas',
    hint: 'Para anotar a mano sobre el papel impreso',
    onlyIn: 'pdf',
    defaultOn: false
  }
]

export function fieldsFor(kind: ExportKind): readonly ExportFieldDefinition[] {
  return kind === 'collection' ? COLLECTION_FIELDS : SETLIST_FIELDS
}

/** Los campos marcados por omisión, para quien exporta por primera vez. */
export function defaultSelection(kind: ExportKind): string[] {
  return fieldsFor(kind)
    .filter((field) => field.defaultOn)
    .map((field) => field.id)
}

/**
 * Limpia una selección guardada: descarta identificadores que ya no existen y,
 * si no queda nada reconocible, vuelve a los valores por omisión.
 */
export function normalizeSelection(kind: ExportKind, raw: unknown): string[] {
  if (!Array.isArray(raw)) return defaultSelection(kind)

  const valid = new Set(fieldsFor(kind).map((field) => field.id))
  const cleaned = raw.filter(
    (value): value is string => typeof value === 'string' && valid.has(value)
  )

  return cleaned.length > 0 ? cleaned : defaultSelection(kind)
}
