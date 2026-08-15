/**
 * Funciones que la persona puede encender o apagar.
 *
 * IMPORTANTE: esto es solo visibilidad. Apagar una función esconde su acceso en
 * la interfaz, pero no borra nada ni deja de guardar datos. Si alguien apaga los
 * setlists y meses después los vuelve a encender, sus listas siguen ahí tal como
 * las dejó.
 *
 * PARA AGREGAR UNA FUNCIÓN NUEVA:
 * 1. Agrega su identificador a `FeatureId`.
 * 2. Agrega su entrada a `FEATURES`.
 * Las preferencias guardadas de versiones anteriores siguen sirviendo: cualquier
 * función que no aparezca en lo guardado arranca encendida.
 */

export type FeatureId =
  | 'setlists'
  | 'credits'
  | 'playback'
  | 'artistLinks'
  | 'review'
  | 'wishlist'
  | 'loans'
  | 'smartLists'

export interface FeatureDefinition {
  id: FeatureId
  label: string
  description: string
}

export const FEATURES: readonly FeatureDefinition[] = [
  {
    id: 'setlists',
    label: 'Setlists',
    description:
      'Armar listas de canciones tomadas de distintos discos. Al apagarlo se esconde la pantalla de setlists y el botón + de cada canción; las listas que ya creaste quedan guardadas.'
  },
  {
    id: 'credits',
    label: 'Créditos de las canciones',
    description:
      'Quién compuso, produjo y tocó en cada tema. Al apagarlo, el detalle de la canción no muestra esa sección, pero los datos se siguen guardando.'
  },
  {
    id: 'playback',
    label: 'Escuchar canciones',
    description:
      'El adelanto de 30 segundos de Deezer y el enlace al video de YouTube. Al apagarlo desaparecen los botones de reproducción del tracklist.'
  },
  {
    id: 'artistLinks',
    label: 'Enlaces del artista',
    description:
      'La página oficial y las redes sociales del artista, arriba en la ficha del disco.'
  },
  {
    id: 'review',
    label: 'Reseña del álbum',
    description:
      'El texto de Wikipedia sobre el disco, o el que hayas escrito tú, en la sección "Sobre el álbum".'
  },
  {
    id: 'wishlist',
    label: 'Lista de deseos',
    description:
      'La sección donde anotas los discos que buscas. Al apagarlo se esconde del menú, pero la lista sigue guardada.'
  },
  {
    id: 'loans',
    label: 'Préstamos',
    description:
      'Llevar el registro de a quién le prestaste tus discos. Al apagarlo se esconde del menú; los préstamos activos siguen registrados.'
  },
  {
    id: 'smartLists',
    label: 'Listas inteligentes',
    description:
      'Filtros guardados que se recalculan solos conforme cambia tu colección. Al apagarlo se esconde el botón de crear listas, pero las que ya existen se conservan.'
  }
]

export type FeatureFlags = Record<FeatureId, boolean>

/** Todo encendido: es lo que ve quien nunca entró a configurar esto. */
export const DEFAULT_FEATURES: FeatureFlags = {
  setlists: true,
  credits: true,
  playback: true,
  artistLinks: true,
  review: true,
  wishlist: true,
  loans: true,
  smartLists: true
}

/**
 * Convierte lo que había guardado en una configuración válida.
 *
 * Tolera basura, archivos de versiones viejas y funciones que todavía no
 * existían: cualquier cosa que no sea exactamente `false` se toma como
 * encendida, para que estrenar una función no la deje apagada sin querer.
 */
export function normalizeFeatures(raw: unknown): FeatureFlags {
  const stored = (raw ?? {}) as Partial<Record<FeatureId, unknown>>
  const result = { ...DEFAULT_FEATURES }

  for (const feature of FEATURES) {
    if (stored[feature.id] === false) result[feature.id] = false
  }

  return result
}
