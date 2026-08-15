import { useState } from 'react'
import type { AlbumSummary, BrowsableTrack } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import AddToSetlistButton from './AddToSetlistButton'
import PageHeader from './PageHeader'
import { IconChevron, IconClose, IconSearch } from './Icons'

interface ExploreScreenProps {
  albums: AlbumSummary[]
  collectionId: number
  /** Setlist al que se están sumando canciones. Si no hay, cada "+" abre su menú. */
  target: { id: number; name: string } | null
  onBack: () => void
}

function coverSrc(album: AlbumSummary): string | null {
  if (album.userCoverFront) return `melofyle-photo://${album.userCoverFront}`
  return album.canonicalCover
}

/**
 * Recorrer la colección sin salir de la pantalla.
 *
 * Los álbumes se despliegan en el sitio para mostrar sus canciones, así se
 * pueden ir eligiendo temas de discos distintos sin entrar y salir de cada uno.
 * Las canciones se piden a la base de datos solo cuando el álbum se abre.
 */
function ExploreScreen({ albums, collectionId, target, onBack }: ExploreScreenProps) {
  const [openAlbumId, setOpenAlbumId] = useState<number | null>(null)
  const [tracksByAlbum, setTracksByAlbum] = useState<Record<number, BrowsableTrack[]>>({})
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function toggleAlbum(albumId: number) {
    if (openAlbumId === albumId) {
      setOpenAlbumId(null)
      return
    }

    setOpenAlbumId(albumId)

    if (!tracksByAlbum[albumId]) {
      setLoadingId(albumId)
      const result = await window.api.listAlbumTracks(albumId)
      setLoadingId(null)

      if (!result.ok) {
        setError(result.error)
        return
      }
      setTracksByAlbum((current) => ({ ...current, [albumId]: result.data }))
    }
  }

  const query = search.trim().toLowerCase()
  const filtered = query
    ? albums.filter(
        (album) =>
          album.title.toLowerCase().includes(query) ||
          album.artists.toLowerCase().includes(query) ||
          album.genres.some((genre) => genre.toLowerCase().includes(query))
      )
    : albums

  return (
    <div className="screen explore-screen">
      {/*
        Explorar es una sub-página de verdad —se llega desde un setlist o desde
        la colección y se vuelve— así que lleva "volver" arriba, como la ficha
        de un disco. Antes tenía una cabecera propia con un botón "Volver" a la
        derecha que era distinto al de todas las demás pantallas.
      */}
      <PageHeader
        title="Explorar mi colección"
        subtitle={
          query
            ? `${filtered.length} de ${albums.length} discos`
            : filtered.length === 1
              ? '1 disco'
              : `${filtered.length} discos`
        }
        onBack={onBack}
        backLabel={target ? 'Volver al setlist' : 'Volver'}
        actions={
          target && (
            <button className="btn btn-primary" onClick={onBack}>
              Terminar
            </button>
          )
        }
      />

      {/*
        A dónde están yendo las canciones.

        Es la misma franja que marca "estás viendo una lista" en la colección:
        cuando la pantalla no hace lo de siempre sino que forma parte de una
        tarea, eso tiene que leerse antes que nada.
      */}
      {target && (
        <div className="explore-destino">
          <span className="overline">Sumando canciones a</span>
          <h3 className="explore-destino-nombre">{target.name}</h3>
          <p className="card-nota">
            Abre un disco y pulsa + en cada canción que quieras. Puedes tomar temas de
            discos distintos sin salir de aquí.
          </p>
        </div>
      )}

      <div className="collection-toolbar">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por artista, álbum o género..."
            className="search-input"
            aria-label="Filtrar discos"
            spellCheck={false}
          />
          {search && (
            <button
              className="search-clear"
              onClick={() => setSearch('')}
              title="Limpiar"
              aria-label="Limpiar el filtro"
            >
              <IconClose size={16} />
            </button>
          )}
        </div>
      </div>

      {error && <p className="feedback-error">{error}</p>}

      {filtered.length === 0 && (
        <p className="empty-note">No hay discos que coincidan con esa búsqueda.</p>
      )}

      <ul className="explore-albums">
        {filtered.map((album) => {
          const isOpen = openAlbumId === album.id
          const format = getFormat(album.format)
          const cover = coverSrc(album)
          const tracks = tracksByAlbum[album.id]

          return (
            <li className={`explore-album${isOpen ? ' open' : ''}`} key={album.id}>
              <button
                className="explore-album-head"
                onClick={() => toggleAlbum(album.id)}
                aria-expanded={isOpen}
              >
                <span className="explore-album-cover">
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" />
                  ) : (
                    <span className="explore-album-cover-empty">{format?.icon ?? '🎵'}</span>
                  )}
                </span>

                <span className="explore-album-body">
                  <span className="explore-album-title">{album.title}</span>
                  {/* Los datos de catálogo en mono: es lo que se compara de una
                      fila a la siguiente, igual que en las ediciones. */}
                  <span className="explore-album-sub numeric">
                    {album.artists} · {album.year ?? '—'} · {format?.label ?? album.format}
                    {album.genres.length > 0 && ` · ${album.genres.join(', ')}`}
                  </span>
                </span>

                <span className="explore-album-count numeric">
                  {album.trackCount === 1 ? '1 canción' : `${album.trackCount} canciones`}
                </span>

                <span className="explore-album-chevron" aria-hidden="true">
                  <IconChevron size={16} />
                </span>
              </button>

              {isOpen && (
                <div className="explore-tracks">
                  {loadingId === album.id && <p className="explore-loading">Cargando...</p>}

                  {tracks && tracks.length === 0 && (
                    <p className="explore-loading">Este disco no tiene canciones guardadas.</p>
                  )}

                  {tracks && tracks.length > 0 && (
                    <ol className="explore-track-rows">
                      {tracks.map((track) => (
                        <li className="explore-track-row" key={track.id}>
                          <span className="explore-track-number numeric">
                            {track.side !== 'N/A' ? `${track.side}${track.number}` : track.number}
                          </span>
                          <span className="explore-track-title">{track.title}</span>
                          <span className="explore-track-duration numeric">
                            {track.duration ?? '—'}
                          </span>
                          <AddToSetlistButton
                            trackId={track.id}
                            collectionId={collectionId}
                            directSetlistId={target?.id}
                            directSetlistName={target?.name}
                          />
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ExploreScreen
