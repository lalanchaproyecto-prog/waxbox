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
import { fetchAlbumExcerpt, type WikipediaExcerpt } from './wikipedia'

export interface AlbumSheet {
  /** Datos del álbum y su tracklist, desde MusicBrainz. */
  release: ReleaseDetails
  /** Portada oficial del catálogo. Null si el archivo no tiene ninguna. */
  cover: CoverArt | null
  /** Reseña introductoria del álbum o del artista. Null si no hay artículo. */
  excerpt: WikipediaExcerpt | null
}

export async function buildAlbumSheet(
  musicbrainzId: string,
  physicalFormatId: string
): Promise<AlbumSheet> {
  // MusicBrainz primero: además de los datos del álbum, entrega los
  // identificadores que las demás fuentes necesitan para buscar lo suyo.
  const release = await getReleaseDetails(musicbrainzId, physicalFormatId)

  // La portada y la reseña van a servicios distintos, así que se piden a la vez
  // en vez de una después de la otra. Ninguna puede tumbar la ficha: las dos
  // devuelven null cuando no encuentran nada.
  const [cover, excerpt] = await Promise.all([
    fetchCoverArt(release.musicbrainzId, release.releaseGroupId),
    fetchAlbumExcerpt(release.releaseGroupId, release.artistId)
  ])

  return { release, cover, excerpt }
}
