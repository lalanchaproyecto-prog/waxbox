/**
 * De dónde salió un álbum: de un catálogo automático o de la mano de la persona.
 *
 * POR QUÉ EXISTE ESTA MARCA:
 * Un álbum cargado a mano nunca va a tener reseña de Wikipedia, portada oficial
 * del catálogo ni enlaces del artista, porque todo eso se consulta con el
 * identificador de MusicBrainz que este álbum no tiene. Sin esta marca, cualquier
 * función que mida "qué tan completa está la colección" lo contaría como un disco
 * con datos faltantes, cuando en realidad son datos que nunca iba a poder tener.
 *
 * No se deduce de `musicbrainzId` vacío a propósito: eso confunde "lo cargué a
 * mano" con "vino de MusicBrainz pero el identificador se perdió".
 */

export type AlbumSource = 'musicbrainz' | 'manual'

/**
 * Interpreta lo que haya guardado en la base.
 *
 * Los discos guardados antes de que existiera esta columna quedan como
 * 'musicbrainz', que es lo que eran: en ese momento no había otra forma de
 * agregar un disco.
 */
export function normalizeSource(raw: unknown): AlbumSource {
  return raw === 'manual' ? 'manual' : 'musicbrainz'
}

/** Si este álbum se cargó completamente a mano, sin ninguna fuente automática. */
export function isManual(source: AlbumSource): boolean {
  return source === 'manual'
}
