/**
 * La imagen de un perfil, una colección o un setlist.
 *
 * Es una sola forma para los dos orígenes posibles — un archivo que subió la
 * persona o una imagen de Wikimedia Commons — para que quien la muestre no
 * tenga que preguntarse de dónde vino: pide la dirección y listo.
 *
 * POR QUÉ LA ATRIBUCIÓN VIAJA CON LA IMAGEN:
 * las imágenes de Commons son libres pero casi todas exigen crédito al autor y
 * mención de la licencia. Si aquí se guardara solo la dirección, esos datos se
 * perderían para siempre en el momento de elegirla y la app quedaría
 * incumpliendo la licencia sin manera de arreglarlo. Por eso `author`,
 * `license` y `sourceUrl` viajan pegados a la imagen desde el primer momento.
 */

/**
 * DÓNDE está guardada la imagen. Ojo: no es de dónde vino.
 *
 * Las dos cosas son independientes a propósito. Una imagen de Wikimedia
 * Commons, una vez descargada, es un archivo local como cualquier otro — pero
 * sigue necesitando su crédito. Por eso el origen no vive aquí sino en los
 * campos de atribución, que pueden acompañar a cualquier tipo.
 *
 * - 'archivo': carpeta de fotos del perfil abierto.
 * - 'avatar' : carpeta compartida de perfiles. Existe aparte porque el selector
 *   de perfiles se dibuja ANTES de abrir ninguno, y en ese momento no hay
 *   "carpeta del perfil abierto" de la que leer.
 * - 'commons': la imagen sigue en internet, sin descargar. Es el respaldo para
 *   cuando la descarga falla, y lo que tienen las imágenes elegidas antes de
 *   que la app supiera descargarlas.
 * - 'icono'  : no es una imagen. Es un emoji elegido de una lista corta, y es
 *   lo ÚNICO que pueden tener hoy los perfiles y las colecciones.
 *
 *   Va aquí dentro y no en una columna nueva a propósito: el sitio donde se
 *   guarda ya existe, así que cambiar a íconos no obliga a migrar ninguna base
 *   de datos ya creada. Las imágenes viejas siguen leyéndose sin romperse —
 *   simplemente ya no se pueden elegir.
 */
export type ImageKind = 'archivo' | 'avatar' | 'commons' | 'icono'

export interface ImageRef {
  kind: ImageKind
  /**
   * Cómo llegar a la imagen: el nombre del archivo local, o la dirección
   * completa cuando el tipo es 'commons'.
   */
  value: string
  /** Quién hizo la imagen. Solo cuando vino de Commons. */
  author?: string | null
  /** Nombre corto de la licencia. Solo cuando vino de Commons. */
  license?: string | null
  /** Página del archivo en Commons, con la información completa. */
  sourceUrl?: string | null
  /** Título del archivo en Commons. */
  title?: string | null
}

/**
 * Si esta imagen vino de Wikimedia Commons, esté descargada o no.
 *
 * Se mira la atribución y NO el tipo: una imagen de Commons ya descargada tiene
 * tipo 'archivo', y seguiría necesitando su crédito igual.
 */
export function isFromCommons(image: ImageRef | null): boolean {
  return Boolean(image && (image.sourceUrl || image.author || image.license))
}

/**
 * Convierte lo guardado en la base en una imagen utilizable.
 *
 * Tolera basura y formatos viejos: ante cualquier duda devuelve null, que
 * significa "sin imagen" y es un estado perfectamente válido.
 */
export function parseImageRef(raw: unknown): ImageRef | null {
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return parseImageRef(JSON.parse(raw))
    } catch {
      return null
    }
  }

  if (!raw || typeof raw !== 'object') return null

  const candidate = raw as Partial<ImageRef>
  const kinds: ImageKind[] = ['archivo', 'avatar', 'commons', 'icono']
  if (!candidate.kind || !kinds.includes(candidate.kind)) return null
  if (typeof candidate.value !== 'string' || candidate.value.length === 0) return null

  return {
    kind: candidate.kind,
    value: candidate.value,
    author: candidate.author ?? null,
    license: candidate.license ?? null,
    sourceUrl: candidate.sourceUrl ?? null,
    title: candidate.title ?? null
  }
}

/**
 * La dirección lista para poner en un `src`.
 *
 * Un ícono devuelve null porque no es una imagen que se cargue: es un carácter
 * que se escribe. Quien dibuje esto tiene que probar `imageIcon()` antes de
 * dar por hecho que no hay nada.
 */
export function imageSrc(image: ImageRef | null): string | null {
  if (!image) return null

  switch (image.kind) {
    case 'archivo':
      return `melofyle-photo://${image.value}`
    case 'avatar':
      return `melofyle-avatar://${image.value}`
    case 'commons':
      return image.value
    case 'icono':
      return null
  }
}

/** El emoji elegido, o null si esto no es un ícono. */
export function imageIcon(image: ImageRef | null): string | null {
  return image?.kind === 'icono' ? image.value : null
}

/** Envuelve un emoji para poder guardarlo donde antes iba una imagen. */
export function iconRef(emoji: string): ImageRef {
  return { kind: 'icono', value: emoji }
}

/**
 * Los íconos que pueden representar un perfil o una colección.
 *
 * Son objetos de música y de guardar música, que es de lo que va la app. La
 * lista es corta a propósito: elegir entre ocho es inmediato, elegir entre
 * cien es otra tarea.
 */
export const ICONOS = [
  '💿', '📀', '🎧', '🎸', '🎹', '🎤', '🥁', '🎺',
  '📻', '🎷', '🎻', '📼', '🗃️', '📦', '⭐', '🏠'
] as const

/**
 * El crédito que hay que mostrar junto a la imagen, o null si no hace falta.
 *
 * Una foto propia no lleva crédito: es de quien usa la app. Una de Commons sí,
 * y lo sigue llevando después de descargarla — tenerla en el disco duro no
 * cambia de quién es.
 */
export function imageCredit(image: ImageRef | null): string | null {
  if (!isFromCommons(image)) return null

  const partes = [image!.author, image!.license].filter(Boolean)
  if (partes.length === 0) return 'Wikimedia Commons'

  return `${partes.join(' · ')} — Wikimedia Commons`
}

/** Para guardar en la base. null se guarda como null, no como "null". */
export function serializeImageRef(image: ImageRef | null): string | null {
  return image ? JSON.stringify(image) : null
}
