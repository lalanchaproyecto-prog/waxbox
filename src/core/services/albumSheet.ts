/**
 * Armado de la ficha de un álbum.
 *
 * Este módulo es el que decide cómo se combinan las distintas fuentes para
 * formar la ficha que la persona va a revisar antes de guardar. Cada servicio
 * (MusicBrainz, Cover Art Archive y, más adelante, Wikipedia y YouTube) sabe
 * hablar con su API; este archivo sabe en qué orden llamarlos y qué hacer
 * cuando alguno no devuelve nada.
 *
 * Regla general: solo MusicBrainz es imprescindible. Si falla, no hay ficha.
 * Las demás fuentes son complementos: si no responden o no tienen el dato,
 * la ficha se arma igual, simplemente con menos información.
 */

import { getReleaseDetails, type ReleaseDetails } from './musicbrainz'
import { fetchCoverArt, type CoverArt } from './coverart'

export interface AlbumSheet {
  /** Datos del álbum y su tracklist, desde MusicBrainz. */
  release: ReleaseDetails
  /** Portada oficial del catálogo. Null si el archivo no tiene ninguna. */
  cover: CoverArt | null
}

export async function buildAlbumSheet(
  musicbrainzId: string,
  physicalFormatId: string
): Promise<AlbumSheet> {
  // MusicBrainz primero: además de los datos del álbum, entrega el
  // identificador que Cover Art Archive necesita para buscar la portada.
  const release = await getReleaseDetails(musicbrainzId, physicalFormatId)

  const cover = await fetchCoverArt(release.musicbrainzId, release.releaseGroupId)

  return { release, cover }
}
