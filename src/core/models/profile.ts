/**
 * Un perfil de usuario dentro de la misma instalación.
 *
 * Vive en core y no junto al código que lo guarda porque el preload y la
 * ventana también necesitan este tipo, y no deben arrastrar módulos del proceso
 * principal —que usan `fs`, `os` y `electron`— al proyecto de la interfaz.
 *
 * Un perfil separa datos, no los protege: no hay contraseña ni cifrado.
 */
export interface Profile {
  id: string
  name: string
  /** Emoji que lo representa en el selector. */
  emoji: string
  createdAt: string
}
