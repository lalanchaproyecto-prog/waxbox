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

/*
  QUE UN NOMBRE SEA UN ARCHIVO SUELTO Y NO UN CAMINO A OTRA PARTE DEL DISCO.

  Todo lo que aquí se llama «nombre de archivo» se junta con una carpeta usando
  `join`, y `join` no protege de nada: `join(fotos, '../../../algo')` sale
  tranquilamente de la carpeta. Un nombre con `..` o con barras no es un nombre,
  es un camino.

  Vive aquí, y no en el manejador del protocolo donde nació, porque el problema
  no era del protocolo: es de cualquiera que combine una carpeta nuestra con un
  nombre que venga de fuera. Tenerlo en el módulo que manda en estas carpetas es
  lo que hace que se use en los cuatro sitios y no solo en el que se revisó.
*/
export function esNombreSeguro(filename: string): boolean {
  return (
    filename.length > 0 &&
    !filename.includes('..') &&
    !filename.includes('/') &&
    !filename.includes('\\')
  )
}

export function copyPhoto(sourcePath: string): string {
  const ext = extname(sourcePath).toLowerCase() || '.jpg'
  const name = `${Date.now()}_${randomBytes(4).toString('hex')}${ext}`
  const dest = join(photosDir(), name)
  copyFileSync(sourcePath, dest)
  return name
}

/*
  Hoy el nombre que llega aquí sale siempre de la base de datos, no de la
  ventana: se borra la foto DE un disco, DE una colección o DE un setlist, y el
  proceso principal busca cuál era. Así que la comprobación no tapa ningún
  agujero conocido.

  Está igual por dos motivos. El primero es que sí existe un camino en dos
  pasos: `collections:setImage` acepta una imagen desde la ventana y guarda su
  nombre; si ese nombre fuera un camino, la siguiente vez que se cambie la
  imagen se borraría lo que ese camino apunte. El segundo es que «el nombre
  viene de la base» es cierto hoy y nadie lo va a comprobar mañana antes de
  añadir la quinta llamada.

  Se ignora en silencio en vez de fallar: un nombre así solo puede venir de un
  error nuestro o de algo peor, y en ninguno de los dos casos ayuda romperle la
  app a quien solo estaba borrando una foto.
*/
export function deletePhoto(filename: string): void {
  if (!esNombreSeguro(filename)) return
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

/** Mismo cuidado que en `deletePhoto`, y por los mismos motivos. */
export function deleteAvatar(filename: string): void {
  if (!esNombreSeguro(filename)) return
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
