/**
 * Un perfil de usuario dentro de la misma instalación.
 *
 * Vive en core y no junto al código que lo guarda porque el preload y la
 * ventana también necesitan este tipo, y no deben arrastrar módulos del proceso
 * principal —que usan `fs`, `os` y `electron`— al proyecto de la interfaz.
 *
 * Un perfil separa datos, no los protege: no hay contraseña ni cifrado.
 */
import type { ImageRef } from './imageRef'

export interface Profile {
  id: string
  name: string
  /** Emoji que lo representa en el selector cuando no hay imagen. */
  emoji: string
  /**
   * Foto o imagen del perfil. Null cuando solo tiene emoji.
   *
   * OJO: a diferencia de las imágenes de colección y setlist, esta NO vive en la
   * base de datos sino en `profiles.json`, porque los perfiles se listan antes
   * de abrir ninguna base — hay que poder dibujar el selector sin saber todavía
   * qué perfil se va a elegir.
   */
  image?: ImageRef | null
  createdAt: string
}
