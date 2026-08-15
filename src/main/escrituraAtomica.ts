/*
  ESCRIBIR UN ARCHIVO SIN PODER DEJARLO A MEDIAS.

  `writeFileSync` sobre un archivo que ya existe lo trunca primero y lo va
  llenando después. Entre esas dos cosas hay un instante —corto, pero real— en
  el que lo que hay en disco es medio archivo. Si justo ahí se va la luz, se
  cuelga el equipo o alguien mata el proceso, ese medio archivo es lo que queda
  para siempre.

  Para un archivo de datos eso no es «se perdió el último cambio»: es que el
  archivo entero deja de poder leerse. Medio SQLite no abre, y medio JSON no
  se interpreta.

  La solución es vieja y no tiene trampa: se escribe entero a un archivo
  temporal al lado, y cuando ya está completo se renombra encima del bueno.
  Renombrar dentro del mismo disco es una operación atómica del sistema de
  archivos — ocurre del todo o no ocurre. Así, en cualquier instante, lo que
  hay en la ruta buena es la versión vieja completa o la nueva completa, nunca
  una mitad.

  EL TEMPORAL VA EN LA MISMA CARPETA A PROPÓSITO. Renombrar solo es atómico
  dentro del mismo volumen; si el temporal viviera en la carpeta de temporales
  del sistema, el renombrado podría cruzar de disco y convertirse en una copia
  normal, que es justo lo que estamos evitando.

  Quien llame a esto tiene que estar preparado para que falle: si algo sale
  mal, el error se vuelve a lanzar. Un guardado que falla en silencio es peor
  que uno que falla.
*/

import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/**
 * Escribe `contenido` en `ruta` de forma que nunca quede a medias.
 *
 * Acepta texto o binario: los ajustes y la lista de perfiles son JSON, y la
 * base de datos es el `Uint8Array` que devuelve `db.export()`. Se pide
 * `Uint8Array` y no `Buffer` porque un `Buffer` ya es un `Uint8Array`, así
 * que este tipo admite los dos.
 */
export function escribirAtomico(ruta: string, contenido: string | Uint8Array): void {
  const carpeta = dirname(ruta)
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true })

  const temporal = `${ruta}.tmp`

  try {
    writeFileSync(temporal, contenido)
    renameSync(temporal, ruta)
  } catch (error) {
    // Se limpia el temporal para no ir dejando basura al lado del archivo
    // bueno. Si tampoco se puede borrar, no vale la pena tapar el error real.
    try {
      if (existsSync(temporal)) unlinkSync(temporal)
    } catch {
      /* vacío a propósito */
    }
    throw error
  }
}
