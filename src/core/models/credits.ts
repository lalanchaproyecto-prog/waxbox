/**
 * Créditos de una canción: quién la compuso, quién la produjo, quién tocó qué.
 *
 * MusicBrainz guarda esta información en dos niveles distintos:
 *   - La OBRA (work): la canción como composición. De ahí salen compositor,
 *     letrista y autor.
 *   - La GRABACIÓN (recording): esta versión concreta. De ahí salen productor,
 *     ingeniero, mezcla, masterización, y los músicos que tocaron.
 *
 * La cobertura es despareja: son datos que carga la comunidad a mano. Discos
 * conocidos suelen tener bastante; los independientes pueden no tener nada.
 * Cuando falta un crédito simplemente no se muestra, y la persona puede
 * agregarlo a mano si lo sabe.
 */

/** De dónde salió un dato. Sirve para distinguir lo automático de lo escrito a mano. */
export type DataSource =
  | 'musicbrainz'
  | 'wikipedia'
  | 'coverartarchive'
  | 'deezer'
  | 'usuario'

export interface Credit {
  /** Papel que cumplió, tal como lo nombra MusicBrainz. Ej: 'composer', 'producer'. */
  role: string
  /** Nombre de la persona o grupo. */
  artist: string
  /**
   * Detalle adicional cuando lo hay: qué instrumento tocó, qué tipo de voz hizo,
   * o si fue asistente. Null cuando no aplica.
   */
  detail: string | null
  /** Si vino de una fuente automática o lo escribió la persona. */
  source: DataSource
}

/**
 * Nombres en español de los papeles que trae MusicBrainz.
 *
 * PARA AGREGAR UNO NUEVO: basta con añadirlo aquí. Los que no estén en esta
 * lista se muestran con el nombre que traiga MusicBrainz, así que nunca se
 * pierde un crédito por no estar traducido.
 */
const ROLE_LABELS: Record<string, string> = {
  composer: 'Compositor',
  lyricist: 'Letrista',
  writer: 'Autor',
  librettist: 'Libretista',
  producer: 'Productor',
  engineer: 'Ingeniero',
  recording: 'Ingeniero de grabación',
  mix: 'Mezcla',
  mastering: 'Masterización',
  instrument: 'Instrumentos',
  vocal: 'Voces',
  performer: 'Intérprete',
  arranger: 'Arreglos',
  orchestrator: 'Orquestación',
  conductor: 'Dirección',
  'phonographic copyright': 'Derechos fonográficos'
}

/** Orden en que se muestran los créditos: primero quién la escribió. */
const ROLE_ORDER = [
  'composer',
  'lyricist',
  'writer',
  'librettist',
  'arranger',
  'orchestrator',
  'conductor',
  'producer',
  'engineer',
  'recording',
  'mix',
  'mastering',
  'performer',
  'vocal',
  'instrument'
]

/** Papeles que la persona puede agregar a mano, cuando MusicBrainz no los tiene. */
export const EDITABLE_ROLES = [
  'composer',
  'lyricist',
  'producer',
  'engineer',
  'mix',
  'mastering',
  'performer',
  'instrument'
] as const

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/** Agrupa los créditos por papel, en un orden que se lee natural. */
export function groupCredits(credits: Credit[]): Array<{ role: string; label: string; credits: Credit[] }> {
  const groups = new Map<string, Credit[]>()
  for (const credit of credits) {
    const existing = groups.get(credit.role)
    if (existing) existing.push(credit)
    else groups.set(credit.role, [credit])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      const indexA = ROLE_ORDER.indexOf(a)
      const indexB = ROLE_ORDER.indexOf(b)
      // Los papeles desconocidos van al final, pero no se pierden.
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
    })
    .map(([role, list]) => ({ role, label: roleLabel(role), credits: list }))
}
