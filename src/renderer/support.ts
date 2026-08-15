/*
  ENLACES DE CONTACTO CON EL PROYECTO.

  La app no tiene servidor propio ni sistema de mensajería, y no hace falta:
  el repositorio en GitHub ya es el sitio donde se reciben fallos y
  sugerencias, y donde quedan a la vista de cualquiera. Estas funciones solo
  arman la dirección correcta con el formulario ya rellenado.

  POR QUÉ SE RELLENA EL INFORME SOLO:

  Un fallo sin la versión de la app ni el sistema operativo obliga a una ronda
  de preguntas antes de poder mirarlo siquiera. La persona que reporta rara
  vez sabe qué datos hacen falta —no tiene por qué saberlo— así que se los
  ponemos nosotros y ella escribe lo único que solo ella sabe: qué esperaba
  que pasara y qué pasó.

  Nada de esto se envía a ningún lado desde la app: se abre el navegador con
  el formulario escrito, y quien decide si lo publica es la persona. Si cierra
  la pestaña, no se manda nada.
*/

import { APP_NAME, APP_VERSION, REPO_URL } from '@core/config'

/**
 * Datos técnicos del entorno, sacados del identificador del navegador.
 *
 * Se lee de `navigator.userAgent` y no de un puente al proceso principal a
 * propósito: ahí ya viene la versión de Electron, la de Chromium y el sistema
 * operativo, que es exactamente lo que hace falta para reproducir un fallo.
 * Montar un canal IPC nuevo para conseguir lo mismo sería trabajo de más.
 *
 * Si algún dato no aparece, se dice «desconocido» en vez de fallar: un
 * informe incompleto sigue siendo más útil que un botón que no funciona.
 */
function datosDelSistema(): string {
  const ua = navigator.userAgent

  const electron = ua.match(/Electron\/([\d.]+)/)?.[1] ?? 'desconocida'
  const chrome = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? 'desconocida'

  const sistema = ua.includes('Windows NT 10.0')
    ? 'Windows 10 u 11'
    : ua.match(/Windows NT ([\d.]+)/)
      ? `Windows NT ${ua.match(/Windows NT ([\d.]+)/)![1]}`
      : ua.includes('Mac OS X')
        ? 'macOS'
        : ua.includes('Linux')
          ? 'Linux'
          : 'desconocido'

  return [
    `- ${APP_NAME}: ${APP_VERSION}`,
    `- Sistema: ${sistema}`,
    `- Electron: ${electron}`,
    `- Chromium: ${chrome}`,
    `- Idioma: ${navigator.language}`
  ].join('\n')
}

/** Arma la dirección del formulario de GitHub con todo ya escrito. */
function nuevoIssue(titulo: string, cuerpo: string, etiqueta: string): string {
  const parametros = new URLSearchParams({
    title: titulo,
    body: cuerpo,
    labels: etiqueta
  })
  return `${REPO_URL}/issues/new?${parametros.toString()}`
}

/**
 * Reportar algo que no funciona.
 *
 * Las tres preguntas del cuerpo no son burocracia: sin «qué esperabas» y «qué
 * pasó» por separado, la mitad de los informes describen el síntoma de forma
 * que no se distingue de lo que la app hace a propósito.
 */
export function enlaceReportarProblema(): string {
  const cuerpo = [
    '<!-- Gracias por tomarte el tiempo. Cuéntanos lo que puedas; -->',
    '<!-- los datos técnicos de abajo ya están rellenados. -->',
    '',
    '## Qué pasó',
    '',
    '',
    '## Qué esperabas que pasara',
    '',
    '',
    '## Cómo repetirlo',
    '',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Datos técnicos',
    '',
    datosDelSistema()
  ].join('\n')

  return nuevoIssue('', cuerpo, 'problema')
}

/**
 * Proponer una mejora.
 *
 * Se pregunta por el problema que resolvería, no solo por la función que se
 * quiere. Es la diferencia entre «pon un botón aquí» y «no encuentro cómo
 * hacer X»: lo segundo se puede resolver de varias maneras, y quizá alguna
 * sea mejor que la que se te ocurrió primero.
 */
export function enlaceSugerencia(): string {
  const cuerpo = [
    '<!-- Cuéntanos qué te gustaría poder hacer. -->',
    '',
    '## Qué te gustaría',
    '',
    '',
    '## Qué problema te resolvería',
    '',
    '',
    `<!-- Versión: ${APP_NAME} ${APP_VERSION} -->`
  ].join('\n')

  return nuevoIssue('', cuerpo, 'sugerencia')
}

/** La lista de todo lo reportado, por si alguien quiere mirar antes de escribir. */
export function enlaceIssues(): string {
  return `${REPO_URL}/issues`
}
