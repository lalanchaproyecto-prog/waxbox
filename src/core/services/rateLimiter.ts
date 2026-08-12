/**
 * Limitador de peticiones.
 *
 * Varios servicios (MusicBrainz entre ellos) piden no hacer más de cierta
 * cantidad de consultas por segundo. Este ayudante pone las peticiones en fila
 * y las va soltando de a una, separadas por el tiempo mínimo indicado, para que
 * el resto del código no tenga que preocuparse por eso.
 */

export type Scheduler = <T>(task: () => Promise<T>) => Promise<T>

export function createRateLimiter(minIntervalMs: number): Scheduler {
  let lastRunAt = 0
  // Fila de espera: cada petición nueva se encadena detrás de la anterior.
  let queue: Promise<unknown> = Promise.resolve()

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const waitMs = lastRunAt + minIntervalMs - Date.now()
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
      lastRunAt = Date.now()
      return task()
    }

    // Se encadena tanto si la anterior salió bien como si falló, para que un
    // error en una petición no deje la fila trabada.
    const result = queue.then(run, run)
    queue = result.catch(() => undefined)
    return result
  }
}
