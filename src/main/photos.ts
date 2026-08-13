import { app } from 'electron'
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
