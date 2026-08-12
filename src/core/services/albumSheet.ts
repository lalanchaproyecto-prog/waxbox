/**
 * Armado de la ficha de un álbum.
 *
 * Este módulo es el que decide cómo se combinan las distintas fuentes para
 * formar la ficha que la persona va a revisar antes de guardar. Cada servicio
 * (MusicBrainz, Cover Art Archive, Wikipedia y Deezer) sabe hablar con su API;
 * este archivo sabe en qué orden llamarlos y qué hacer cuando alguno no
 * devuelve nada.
 *
 * Regla general: solo MusicBrainz es imprescindible. Si falla, no hay ficha.
 * Las demás fuentes son complementos: si no responden o no tienen el dato,
 * la ficha se arma igual, simplemente con menos información.
 */

import {
  getReleaseDetails,
  getArtistLinks,
  type ReleaseDetails,
  type ReleaseTrack,
  type ArtistLink
} from './musicbrainz'
import { fetchCoverArt, type CoverArt } from './coverart'
import { fetchAlbumExcerpt, type WikipediaExcerpt } from './wikipedia'
import { findTracks, type DeezerTrackRef } from './deezer'

/** Una canción de la ficha, con su adelanto de Deezer si se encontró. */
export interface SheetTrack extends ReleaseTrack {
  /**
   * Referencia a la canción en Deezer, para poder escuchar 30 segundos.
   * Se guarda el identificador y no la dirección del audio, porque esa caduca.
   */
  deezer: DeezerTrackRef | null
}

export interface AlbumSheet {
  /** Datos del álbum, desde MusicBrainz. */
  release: ReleaseDetails
  /** Tracklist con los adelantos ya buscados. */
  tracks: SheetTrack[]
  /** Portada oficial del catálogo. Null si el archivo no tiene ninguna. */
  cover: CoverArt | null
  /** Reseña introductoria del álbum o del artista. Null si no hay artículo. */
  excerpt: WikipediaExcerpt | null
  /** Página oficial y redes del artista. Lista vacía si no hay ninguna. */
  artistLinks: ArtistLink[]
}

export async function buildAlbumSheet(
  musicbrainzId: string,
  physicalFormatId: string
): Promise<AlbumSheet> {
  // MusicBrainz primero: además de los datos del álbum, entrega los
  // identificadores que las demás fuentes necesitan para buscar lo suyo.
  const release = await getReleaseDetails(musicbrainzId, physicalFormatId)

  // Las demás fuentes van a servicios distintos, así que se piden a la vez en
  // vez de una después de la otra. Ninguna puede tumbar la ficha: todas
  // devuelven vacío cuando no encuentran nada.
  const [cover, excerpt, artistLinks, previews] = await Promise.all([
    fetchCoverArt(release.musicbrainzId, release.releaseGroupId),
    fetchAlbumExcerpt(release.releaseGroupId, release.artistId),
    release.artistId ? getArtistLinks(release.artistId) : Promise.resolve([]),
    findTracks(
      release.tracks.map((track) => ({ artist: track.artist, title: track.title }))
    )
  ])

  const tracks: SheetTrack[] = release.tracks.map((track, index) => ({
    ...track,
    deezer: previews[index] ?? null
  }))

  return { release, tracks, cover, excerpt, artistLinks }
}
