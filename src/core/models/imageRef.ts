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
 * De dónde sale la imagen, que además decide dónde está guardada.
 *
 * 'avatar' existe aparte de 'archivo' por una razón concreta: las fotos
 * normales viven en la carpeta del perfil abierto, pero la imagen de un perfil
 * hay que poder dibujarla en el SELECTOR de perfiles, cuando todavía no hay
 * ninguno abierto. Por eso los avatares van a una carpeta compartida y se
 * sirven por su propio camino.
 */
export type ImageKind = 'archivo' | 'avatar' | 'commons'

export interface ImageRef {
  kind: ImageKind
  /**
   * Cómo llegar a la imagen.
   * - 'archivo': nombre del archivo en la carpeta de fotos del perfil abierto.
   * - 'avatar': nombre del archivo en la carpeta compartida de perfiles.
   * - 'commons': la dirección completa de la imagen en Wikimedia.
   */
  value: string
  /** Solo en 'commons'. Quién hizo la imagen. */
  author?: string | null
  /** Solo en 'commons'. Nombre corto de la licencia. */
  license?: string | null
  /** Solo en 'commons'. Página del archivo, con la información completa. */
  sourceUrl?: string | null
  /** Solo en 'commons'. Título del archivo, para poder nombrarlo. */
  title?: string | null
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
  const kinds: ImageKind[] = ['archivo', 'avatar', 'commons']
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

/** La dirección lista para poner en un `src`. */
export function imageSrc(image: ImageRef | null): string | null {
  if (!image) return null

  switch (image.kind) {
    case 'archivo':
      return `waxbox-photo://${image.value}`
    case 'avatar':
      return `waxbox-avatar://${image.value}`
    case 'commons':
      return image.value
  }
}

/**
 * El crédito que hay que mostrar junto a la imagen, o null si no hace falta.
 *
 * Un archivo propio no lleva crédito: es de quien usa la app.
 */
export function imageCredit(image: ImageRef | null): string | null {
  if (!image || image.kind !== 'commons') return null

  const partes = [image.author, image.license].filter(Boolean)
  if (partes.length === 0) return 'Wikimedia Commons'

  return `${partes.join(' · ')} — Wikimedia Commons`
}

/** Para guardar en la base. null se guarda como null, no como "null". */
export function serializeImageRef(image: ImageRef | null): string | null {
  return image ? JSON.stringify(image) : null
}
