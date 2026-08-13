/**
 * Tinte de pantalla sacado de la portada del disco.
 *
 * Es el efecto de Apple Music: la pantalla del álbum toma el color dominante de
 * su portada, así que cada disco se siente distinto sin haber diseñado una
 * pantalla para cada uno.
 *
 * POR QUÉ node-vibrant Y NO SACAR EL COLOR PROMEDIO A MANO:
 * El promedio de una portada casi siempre da un barro grisáceo, porque mezcla
 * todo. node-vibrant agrupa los colores y elige el que la vista percibe como
 * dominante, que es distinto. Y sobre todo entrega un color de texto con
 * contraste garantizado sobre ese fondo — que es la parte difícil: teñir una
 * pantalla con un color cualquiera sacado de una foto cualquiera se convierte
 * muy rápido en texto ilegible.
 *
 * CUÁNDO NO HACE NADA:
 * Si no hay portada, si la imagen no carga o si el análisis falla, no pasa
 * nada: quedan los colores del tema. Un disco sin portada no es un error.
 */

import { useEffect, useState } from 'react'
import { Vibrant } from 'node-vibrant/browser'

export interface DominantColor {
  /** Color dominante, para acentos. */
  tint: string
  /** El mismo color muy diluido, para teñir el fondo sin tapar nada. */
  tintSoft: string
  /** Color de texto que contrasta sobre ese fondo. */
  tintText: string
}

/**
 * Analiza una imagen y devuelve su color dominante.
 *
 * @param imageUrl Dirección de la portada. Null mientras no haya ninguna.
 */
export function useDominantColor(imageUrl: string | null): DominantColor | null {
  const [color, setColor] = useState<DominantColor | null>(null)

  useEffect(() => {
    if (!imageUrl) {
      setColor(null)
      return
    }

    // Si la portada cambia mientras se está analizando la anterior, el
    // resultado viejo llega tarde y no debe pisar al nuevo.
    let cancelled = false

    Vibrant.from(imageUrl)
      .getPalette()
      .then((palette) => {
        if (cancelled) return

        /*
          Se prueban varias muestras en orden. Vibrant no siempre encuentra
          todas: una portada en blanco y negro no tiene ninguna muestra vibrante,
          y ahí sirve la apagada (Muted). Si no hay ninguna, se deja el tema.
        */
        const swatch =
          palette.Vibrant ?? palette.DarkVibrant ?? palette.Muted ?? palette.DarkMuted

        if (!swatch) {
          setColor(null)
          return
        }

        const [r, g, b] = swatch.rgb

        setColor({
          tint: swatch.hex,
          tintSoft: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.22)`,
          tintText: swatch.titleTextColor
        })
      })
      .catch(() => {
        // Portada rota, sin conexión o formato que no se pudo leer. No es
        // motivo para molestar a nadie: la pantalla se ve con los colores del
        // tema y ya está.
        if (!cancelled) setColor(null)
      })

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  return color
}

/**
 * Traduce el color a las variables CSS que lee la clase `.tinted`.
 *
 * Devuelve un objeto de estilo para poner en el elemento contenedor. Cuando no
 * hay color, devuelve un objeto vacío y mandan los valores del tema.
 */
export function tintStyle(color: DominantColor | null): React.CSSProperties {
  if (!color) return {}

  return {
    '--tint': color.tint,
    '--tint-soft': color.tintSoft,
    '--tint-text': color.tintText
  } as React.CSSProperties
}
