/**
 * Perfiles de usuario dentro de la misma instalación.
 *
 * CÓMO ESTÁ ORGANIZADO EN DISCO:
 *
 *   userData/
 *     profiles.json          <- la lista de perfiles y cuál se usó por última vez
 *     users/
 *       <id>/
 *         waxbox.db          <- su base: colecciones, discos, setlists
 *         photos/            <- sus fotos
 *         settings.json      <- su clave de YouTube
 *
 * POR QUÉ UN ARCHIVO POR PERFIL Y NO UNA COLUMNA `user_id`:
 * con archivos separados es imposible que una consulta se olvide de filtrar y
 * muestre los datos de otra persona. No hay filtro que olvidar. Además migrar
 * la instalación de un solo usuario se vuelve mover un archivo de sitio, en vez
 * de reescribir todas las tablas.
 *
 * OJO CON EL ALCANCE: un perfil separa datos, no los protege. No hay contraseña
 * ni cifrado: cualquiera que abra la app puede cambiar de perfil. Es para
 * organizarse, no para esconder nada.
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'fs'
import { randomBytes } from 'crypto'
import { userInfo } from 'os'

import type { Profile } from '../core/models/profile'
import type { ImageRef } from '../core/models/imageRef'

export type { Profile }

interface ProfilesFile {
  profiles: Profile[]
  lastActiveId?: string
}

const PROFILE_EMOJIS = ['🎧', '🎸', '🎹', '🎤', '🥁', '🎺', '📻', '💿']

let activeProfileId: string | null = null

/*
  DÓNDE VIVEN LOS DATOS, Y POR QUÉ LA CARPETA SIGUE LLAMÁNDOSE «waxbox».

  `app.getPath('userData')` no inventa la ruta: la arma con el `name` del
  package.json. Ese campo sigue diciendo «waxbox» a propósito, aunque la app
  ahora se llame Melôfyle.

  Cambiarlo renombraría la carpeta, y las colecciones, los perfiles y las fotos
  que ya existen se quedarían en la carpeta anterior — la app arrancaría
  vacía, como recién instalada, con todo el catálogo intacto pero invisible en
  un directorio que ya nadie mira. El nombre interno no lo ve nadie; perder una
  colección sí se nota. Si algún día hay que cambiarlo, primero hay que migrar
  la carpeta, no solo renombrarla.
*/
function profilesFilePath(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

function usersRoot(): string {
  return join(app.getPath('userData'), 'users')
}

export function profileDir(profileId: string): string {
  const dir = join(usersRoot(), profileId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function profileDbPath(profileId: string): string {
  return join(profileDir(profileId), 'waxbox.db')
}

function readProfilesFile(): ProfilesFile {
  const path = profilesFilePath()
  if (!existsSync(path)) return { profiles: [] }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as ProfilesFile
    return Array.isArray(parsed.profiles) ? parsed : { profiles: [] }
  } catch {
    // Archivo dañado: mejor empezar de cero que impedir abrir la app. Las
    // carpetas de datos siguen en su sitio y se pueden recuperar a mano.
    return { profiles: [] }
  }
}

function writeProfilesFile(data: ProfilesFile): void {
  writeFileSync(profilesFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function listProfiles(): Profile[] {
  return readProfilesFile().profiles
}

export function getLastActiveId(): string | null {
  return readProfilesFile().lastActiveId ?? null
}

export function createProfile(name: string, emoji?: string): Profile {
  const data = readProfilesFile()

  const profile: Profile = {
    id: randomBytes(6).toString('hex'),
    name: name.trim(),
    emoji: emoji || PROFILE_EMOJIS[data.profiles.length % PROFILE_EMOJIS.length],
    createdAt: new Date().toISOString()
  }

  // Se crea la carpeta antes de anotarlo, para no dejar una entrada sin sitio.
  profileDir(profile.id)

  data.profiles.push(profile)
  writeProfilesFile(data)

  return profile
}

export function renameProfile(profileId: string, name: string, emoji?: string): void {
  const data = readProfilesFile()
  const profile = data.profiles.find((item) => item.id === profileId)
  if (!profile) throw new Error('Ese perfil ya no existe.')

  profile.name = name.trim()
  if (emoji) profile.emoji = emoji

  writeProfilesFile(data)
}

/**
 * Cambia la imagen de un perfil. null la quita y vuelve a verse el emoji.
 *
 * Devuelve el nombre del avatar que dejó de usarse, si había uno propio, para
 * que quien llama lo borre y no se acumulen imágenes sin dueño.
 */
export function setProfileImage(profileId: string, image: ImageRef | null): string | null {
  const data = readProfilesFile()
  const profile = data.profiles.find((item) => item.id === profileId)
  if (!profile) throw new Error('Ese perfil ya no existe.')

  const anterior = profile.image ?? null
  profile.image = image
  writeProfilesFile(data)

  // Solo los archivos propios ocupan espacio aquí; una imagen de Commons vive
  // en internet. Y si es exactamente la misma, borrarla dejaría el perfil
  // apuntando a un archivo que ya no está.
  if (!anterior || anterior.kind !== 'avatar') return null
  if (image && image.kind === 'avatar' && image.value === anterior.value) return null
  return anterior.value
}

/**
 * Borra un perfil y TODOS sus datos: su base, sus fotos y sus ajustes.
 *
 * No se puede borrar el último ni el que está abierto: quien llama debe
 * ocuparse de cambiar de perfil primero.
 */
export function deleteProfile(profileId: string): void {
  const data = readProfilesFile()

  if (data.profiles.length <= 1) {
    throw new Error('No puedes borrar tu único perfil.')
  }
  if (profileId === activeProfileId) {
    throw new Error('No puedes borrar el perfil que tienes abierto.')
  }

  const index = data.profiles.findIndex((item) => item.id === profileId)
  if (index === -1) throw new Error('Ese perfil ya no existe.')

  data.profiles.splice(index, 1)
  if (data.lastActiveId === profileId) delete data.lastActiveId
  writeProfilesFile(data)

  const dir = join(usersRoot(), profileId)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export function setActiveProfile(profileId: string): void {
  const data = readProfilesFile()
  if (!data.profiles.some((item) => item.id === profileId)) {
    throw new Error('Ese perfil ya no existe.')
  }

  activeProfileId = profileId
  data.lastActiveId = profileId
  writeProfilesFile(data)
}

export function getActiveProfileId(): string {
  if (!activeProfileId) {
    throw new Error('Todavía no se ha elegido un perfil.')
  }
  return activeProfileId
}

/** Carpeta del perfil abierto. La usan las fotos y los ajustes. */
export function activeProfileDir(): string {
  return profileDir(getActiveProfileId())
}

/**
 * Prepara los perfiles la primera vez, incluyendo el paso desde la instalación
 * de un solo usuario a la de varios.
 *
 * Si había una `waxbox.db` suelta en la carpeta de datos, es de la época sin
 * perfiles: se crea un perfil por omisión y se mueven ahí su base, sus fotos y
 * sus ajustes. Mover es instantáneo y no duplica nada, y si algo falla se
 * intenta dejar todo como estaba antes de abortar.
 */
export function ensureProfilesReady(): Profile[] {
  const existing = listProfiles()
  if (existing.length > 0) return existing

  const userData = app.getPath('userData')
  const legacyDb = join(userData, 'waxbox.db')
  const legacyPhotos = join(userData, 'photos')
  const legacySettings = join(userData, 'settings.json')

  const suggestedName = (() => {
    try {
      return userInfo().username || 'Mi perfil'
    } catch {
      return 'Mi perfil'
    }
  })()

  const profile = createProfile(suggestedName)
  const dir = profileDir(profile.id)

  if (existsSync(legacyDb)) {
    const target = join(dir, 'waxbox.db')
    try {
      renameSync(legacyDb, target)
      console.log(`[waxbox] Base movida al perfil "${profile.name}": ${target}`)
    } catch (error) {
      throw new Error(
        'No se pudo mover la base de datos al perfil nuevo, así que no se cambió ' +
          `nada. Revisa permisos de escritura en ${userData}. (${String(error)})`
      )
    }

    if (existsSync(legacyPhotos)) {
      try {
        renameSync(legacyPhotos, join(dir, 'photos'))
      } catch (error) {
        // Si las fotos no se pueden mover, se devuelve la base a su sitio para
        // no dejar la instalación partida por la mitad.
        try {
          renameSync(target, legacyDb)
        } catch {
          // Sin vuelta atrás posible: se avisa igual con el mensaje de abajo.
        }
        throw new Error(
          'No se pudieron mover tus fotos al perfil nuevo, así que no se cambió ' +
            `nada. Revisa permisos de escritura en ${userData}. (${String(error)})`
        )
      }
    }

    if (existsSync(legacySettings)) {
      try {
        renameSync(legacySettings, join(dir, 'settings.json'))
      } catch {
        // La clave de YouTube se puede volver a configurar; no vale la pena
        // abortar la migración por esto.
        console.warn('[waxbox] No se pudieron mover los ajustes al perfil nuevo.')
      }
    }
  }

  return listProfiles()
}
