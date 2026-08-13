import { app, nativeImage, net } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { activeProfileDir } from './profiles'

/**
 * Las fotos viven dentro de la carpeta del perfil abierto.
 *
 * Como los álbumes guardan solo el nombre del archivo, es esta función la que
 * decide en qué carpeta buscarlo. Al cambiar de perfil cambia la carpeta, y por
 * eso las fotos de un perfil nunca se ven desde otro.
 */
function photosDir(): string {
  const dir = join(activeProfileDir(), 'photos')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getPhotosDir(): string {
  return photosDir()
}

export function copyPhoto(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase() || '.jpg'
  const name = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`
  const dest = join(photosDir(), name)
  copyFileSync(sourcePath, dest)
  return name
}

export function deletePhoto(filename: string): void {
  const path = join(photosDir(), filename)
  if (existsSync(path)) unlinkSync(path)
}

/**
 * Carpeta compartida de imágenes de perfil.
 *
 * Va aparte de las fotos de cada perfil por un motivo muy concreto: el selector
 * de perfiles se dibuja ANTES de abrir ninguno, así que en ese momento no hay
 * "carpeta del perfil abierto" de la que sacar nada. Los avatares tienen que
 * poder leerse sin perfil activo.
 */
function avatarsDir(): string {
  const dir = join(app.getPath('userData'), 'profile-images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getAvatarsDir(): string {
  return avatarsDir()
}

export function copyAvatar(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase() || '.jpg'
  const name = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`
  copyFileSync(sourcePath, join(avatarsDir(), name))
  return name
}

export function deleteAvatar(filename: string): void {
  const path = join(avatarsDir(), filename)
  if (existsSync(path)) unlinkSync(path)
}

/**
 * Ancho al que se reducen las imágenes descargadas de internet.
 *
 * Los archivos originales de Wikimedia Commons suelen ser escaneos enormes: no
 * es raro que una sola foto pese 20 o 30 MB. Como aquí se usan de fondo o de
 * miniatura, guardarlas a tamaño completo llenaría el disco a cambio de nada.
 */
const MAX_ANCHO = 1600

/**
 * Descarga una imagen y la deja guardada, reducida, en el computador.
 *
 * Es lo que hace que las imágenes de Wikimedia Commons funcionen sin conexión:
 * al elegirlas dejan de ser un enlace y pasan a ser un archivo propio. El
 * crédito del autor viaja aparte y no se pierde — ver models/imageRef.ts.
 *
 * Devuelve null si no se pudo descargar. No es un error que deba frenar nada:
 * quien llama se queda con la dirección de internet, que sigue funcionando
 * mientras haya conexión.
 */
export async function downloadImage(
  url: string,
  destino: 'archivo' | 'avatar'
): Promise<string | null> {
  try {
    const response = await net.fetch(url)
    if (!response.ok) return null

    const original = Buffer.from(await response.arrayBuffer())

    // `nativeImage` ya viene dentro de Electron: no hace falta ninguna
    // librería de imágenes para reducirla.
    let image = nativeImage.createFromBuffer(original)
    if (image.isEmpty()) return null

    if (image.getSize().width > MAX_ANCHO) {
      image = image.resize({ width: MAX_ANCHO, quality: 'good' })
    }

    const name = `${Date.now()}_${randomBytes(4).toString('hex')}.jpg`
    const dir = destino === 'avatar' ? avatarsDir() : photosDir()
    writeFileSync(join(dir, name), image.toJPEG(86))

    return name
  } catch {
    // Sin conexión, imagen caída o formato que no se pudo leer.
    return null
  }
}
