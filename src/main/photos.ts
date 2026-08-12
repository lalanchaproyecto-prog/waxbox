import { app } from 'electron'
import { join, extname } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'fs'
import { randomBytes } from 'crypto'

function photosDir(): string {
  const dir = join(app.getPath('userData'), 'photos')
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
