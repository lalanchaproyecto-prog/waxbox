/**
 * Datos de identificación de la aplicación.
 *
 * MusicBrainz y Cover Art Archive exigen que las aplicaciones que consultan sus
 * servicios se identifiquen con un nombre, una versión y una forma de contacto.
 * Usamos la URL del repositorio como contacto, así cumplimos el requisito sin
 * poner un correo personal en el código fuente.
 *
 * Ver https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */

export const APP_NAME = 'Waxbox'
export const APP_VERSION = '1.0.0'
export const REPO_URL = 'https://github.com/lalanchaproyecto-prog/waxbox'

/** Cabecera User-Agent en el formato que pide MusicBrainz: Nombre/Versión ( contacto ) */
export const USER_AGENT = `${APP_NAME}/${APP_VERSION} ( ${REPO_URL} )`

/**
 * MusicBrainz permite como máximo una petición por segundo por aplicación.
 * Superarlo hace que bloqueen temporalmente las consultas.
 */
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100
