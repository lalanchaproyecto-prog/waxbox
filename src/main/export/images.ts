/**
 * Portadas para los archivos exportados.
 *
 * Las portadas vienen de dos sitios: las fotos que sacó la persona, que son
 * archivos en su disco, y las del Cover Art Archive, que hay que descargar.
 *
 * Las dos se reducen a un tamaño razonable antes de meterlas en el Excel o el
 * PDF. Sin eso, una colección con fotos tomadas con el celular produciría
 * archivos de cientos de megas. El redimensionado usa `nativeImage`, que ya
 * viene dentro de Electron: no hace falta ninguna librería de imágenes.
 */

import { nativeImage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { getPhotosDir } from '../photos'

/** Ancho al que se reducen las portadas. Suficiente para imprimir bien. */
const TARGET_WIDTH = 400

/** Descargas simultáneas. Más que esto no acelera y sí molesta al servidor. */
const MAX_CONCURRENT = 5

export interface CoverImage {
  /** JPEG ya reducido. */
  buffer: Buffer
  /** El mismo JPEG como data URI, para incrustarlo en el HTML del PDF. */
  dataUri: string
}

/** Evita volver a bajar o releer la misma portada dos veces en una exportación. */
type CoverCache = Map<string, CoverImage | null>

export function createCoverCache(): CoverCache {
  return new Map()
}

function shrink(raw: Buffer): CoverImage | null {
  let image = nativeImage.createFromBuffer(raw)
  if (image.isEmpty()) return null

  if (image.getSize().width > TARGET_WIDTH) {
    image = image.resize({ width: TARGET_WIDTH, quality: 'good' })
  }

  const buffer = image.toJPEG(80)
  return {
    buffer,
    dataUri: `data:image/jpeg;base64,${buffer.toString('base64')}`
  }
}

function readUserPhoto(filename: string): CoverImage | null {
  // Mismo cuidado que en el protocolo waxbox-photo: nada de salirse de la carpeta.
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return null
  }

  const path = join(getPhotosDir(), filename)
  if (!existsSync(path)) return null

  try {
    return shrink(readFileSync(path))
  } catch {
    return null
  }
}

async function downloadCover(url: string): Promise<CoverImage | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return shrink(Buffer.from(await response.arrayBuffer()))
  } catch {
    // Sin internet o portada caída: se exporta igual, sin imagen.
    return null
  }
}

/**
 * Resuelve la portada de un álbum, prefiriendo la foto de la persona sobre la
 * del catálogo. Devuelve null si no hay ninguna o si falló, que no es un error:
 * el archivo se exporta igual sin esa imagen.
 */
export async function loadCover(
  cache: CoverCache,
  userCoverFront: string | null,
  canonicalCover: string | null
): Promise<CoverImage | null> {
  const key = userCoverFront ? `file:${userCoverFront}` : canonicalCover ? `url:${canonicalCover}` : null
  if (!key) return null

  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const result = userCoverFront
    ? readUserPhoto(userCoverFront)
    : await downloadCover(canonicalCover as string)

  cache.set(key, result)
  return result
}

/**
 * Resuelve muchas portadas a la vez, de a pocas por vez.
 *
 * `onProgress` se llama tras cada portada resuelta para poder mover una barra
 * de progreso: en una colección grande esto es lo que más tarda.
 */
export async function loadCovers<T>(
  cache: CoverCache,
  items: T[],
  pick: (item: T) => { userCoverFront: string | null; canonicalCover: string | null },
  onProgress?: (done: number, total: number) => void
): Promise<Array<CoverImage | null>> {
  const results: Array<CoverImage | null> = new Array(items.length).fill(null)
  let done = 0
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      const source = pick(items[index])
      results[index] = await loadCover(cache, source.userCoverFront, source.canonicalCover)
      done += 1
      onProgress?.(done, items.length)
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT, items.length) },
    () => worker()
  )
  await Promise.all(workers)

  return results
}
