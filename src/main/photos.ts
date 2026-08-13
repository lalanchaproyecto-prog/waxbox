import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs'
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
