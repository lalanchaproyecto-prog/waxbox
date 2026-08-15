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

/** El nombre de la app tal como se escribe y se muestra, con su circunflejo. */
export const APP_NAME = 'Melôfyle'

/**
 * El eslogan. Va en inglés a propósito: es parte del logotipo, no una frase
 * traducible.
 *
 * Sin punto final. Un eslogan no es una oración que termina, es una marca que
 * se queda; el punto lo cerraba y lo hacía leerse como una frase suelta.
 */
export const APP_SLOGAN = 'Keep your music'

/**
 * El nombre sin acentos, para donde no cabe un carácter que no sea ASCII.
 *
 * Las cabeceras HTTP solo admiten ASCII de forma segura: una ô cruda en el
 * User-Agent viaja mal y hay servidores que directamente rechazan la petición.
 * MusicBrainz es de los que se lo toma en serio, y quedarnos sin catálogo por
 * un acento sería un final tonto.
 */
export const APP_NAME_ASCII = 'Melofyle'

/*
  LA VERSIÓN, Y POR QUÉ EMPIEZA POR 0.9.

  `0.9.0-beta.1` no es un número cualquiera: la parte `-beta.1` la lee
  electron-builder para decidir el CANAL. Con un sufijo de preversión genera
  `beta.yml` en vez de `latest.yml`, y electron-updater solo mira el canal que
  corresponde a la versión instalada.

  Eso es lo que mantiene separados a los dos públicos sin configurar nada más:
  quien tenga la beta recibirá betas, y quien mañana instale la 1.0 estable
  mirará `latest.yml` y no verá jamás una beta.

  TIENE QUE COINCIDIR CON `version` EN package.json. Esta es la que se enseña
  en «Acerca de» y viaja en los informes de fallo; aquella es la que decide qué
  se publica. Si se separan, alguien reportará un problema desde una versión
  que no existe.
*/
export const APP_VERSION = '0.9.0-beta.1'
export const REPO_URL = 'https://github.com/lalanchaproyecto-prog/melofyle'

/** Cabecera User-Agent en el formato que pide MusicBrainz: Nombre/Versión ( contacto ) */
export const USER_AGENT = `${APP_NAME_ASCII}/${APP_VERSION} ( ${REPO_URL} )`

/**
 * MusicBrainz permite como máximo una petición por segundo por aplicación.
 * Superarlo hace que bloqueen temporalmente las consultas.
 */
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100
