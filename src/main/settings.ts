/**
 * Guardado de la configuración personal, en el computador de cada quien.
 *
 * La clave de YouTube se guarda CIFRADA usando safeStorage de Electron, que en
 * Windows usa DPAPI: el sistema operativo cifra el dato con las credenciales de
 * la sesión de Windows. En la práctica eso significa que el archivo solo puede
 * descifrarse desde la cuenta de usuario que lo guardó — si alguien copia el
 * archivo a otro computador, no le sirve de nada.
 *
 * Esto es bastante mejor que ofuscar el texto: ofuscar solo disimula, mientras
 * que esto es cifrado real y respaldado por Windows.
 *
 * Este archivo es específico de Electron a propósito. La lógica de negocio no
 * sabe dónde vive la clave: la recibe como parámetro.
 */

import { safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { activeProfileDir } from './profiles'
import { escribirAtomico } from './escrituraAtomica'

interface StoredSettings {
  /** Clave cifrada, en base64. */
  youtubeApiKey?: string
  /** false cuando el sistema no ofreció cifrado y hubo que guardar en claro. */
  youtubeApiKeyEncrypted?: boolean
}

/**
 * Los ajustes son de cada perfil, no de la instalación.
 *
 * Eso incluye la clave de YouTube: cada persona pone la suya y usa su propia
 * cuota diaria de Google, en vez de compartir una y quedarse sin búsquedas por
 * culpa de otra.
 */
function settingsPath(): string {
  return join(activeProfileDir(), 'settings.json')
}

function read(): StoredSettings {
  const path = settingsPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as StoredSettings
  } catch {
    // Archivo dañado o escrito a mano: se empieza de cero en vez de romper la app.
    return {}
  }
}

/*
  Atómico como los otros dos archivos de datos, aunque aquí lo que está en
  juego es mucho menos: si esto se corrompe, `read()` lo detecta, devuelve
  vacío y la persona vuelve a pegar su clave de YouTube. Molesto, no grave.

  Se hace igual porque la alternativa es dejar el único sitio del proyecto
  donde escribir un archivo se hace «de la otra manera», y esa excepción es
  justo lo que el día de mañana se copia y pega a un archivo que sí importe.
*/
function write(settings: StoredSettings): void {
  escribirAtomico(settingsPath(), JSON.stringify(settings, null, 2))
}

/** Indica si el sistema puede cifrar. En Windows normalmente sí. */
export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function hasYoutubeApiKey(): boolean {
  return Boolean(read().youtubeApiKey)
}

/**
 * Devuelve la clave descifrada, o null si no hay ninguna guardada.
 * Solo se usa dentro del proceso principal: la clave nunca se envía a la ventana.
 */
export function getYoutubeApiKey(): string | null {
  const settings = read()
  if (!settings.youtubeApiKey) return null

  if (settings.youtubeApiKeyEncrypted === false) {
    return settings.youtubeApiKey
  }

  try {
    return safeStorage.decryptString(Buffer.from(settings.youtubeApiKey, 'base64'))
  } catch {
    // Puede pasar si se copió el archivo desde otro computador o cuenta.
    return null
  }
}

export function setYoutubeApiKey(apiKey: string): void {
  const key = apiKey.trim()
  const settings = read()

  if (isEncryptionAvailable()) {
    settings.youtubeApiKey = safeStorage.encryptString(key).toString('base64')
    settings.youtubeApiKeyEncrypted = true
  } else {
    // Sin cifrado del sistema no hay forma honesta de proteger el dato aquí.
    // Se guarda tal cual y la interfaz avisa de la situación.
    settings.youtubeApiKey = key
    settings.youtubeApiKeyEncrypted = false
  }

  write(settings)
}

export function clearYoutubeApiKey(): void {
  const settings = read()
  delete settings.youtubeApiKey
  delete settings.youtubeApiKeyEncrypted

  if (Object.keys(settings).length === 0) {
    const path = settingsPath()
    if (existsSync(path)) unlinkSync(path)
    return
  }
  write(settings)
}
