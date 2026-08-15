/**
 * Estado de una actualización en curso.
 *
 * Vive en `core/` y no junto al actualizador porque lo necesitan los tres
 * lados: el proceso principal lo emite, el puente lo tipa y la ventana lo
 * dibuja. `preload` no puede importar de `main` —son proyectos de
 * TypeScript distintos, y esa separación es la que impide que el código
 * privilegiado se cuele en la ventana— así que lo compartido va aquí.
 */
export interface UpdateState {
  estado: 'lista' | 'descargando'
  /** La versión que está bajando o que ya quedó lista. */
  version: string
  /** Porcentaje entero. Solo mientras baja. */
  progreso?: number
}
