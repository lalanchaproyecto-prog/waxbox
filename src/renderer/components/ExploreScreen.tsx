import { useState } from 'react'
import type { AlbumSummary, BrowsableTrack } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import AddToSetlistButton from './AddToSetlistButton'

interface ExploreScreenProps {
  albums: AlbumSummary[]
  collectionId: number
  /** Setlist al que se están sumando canciones. Si no hay, cada "+" abre su menú. */
  target: { id: number; name: string } | null
  onBack: () => void
}

function coverSrc(album: AlbumSummary): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
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
    <div className="explore">
      <header className="collection-header">
        <div>
          <h2>Explorar mi colección</h2>
          <p className="collection-count">
            {target
              ? `Agregando a "${target.name}" — haz clic en + para sumar una canción`
              : 'Haz clic en un disco para ver sus canciones'}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>
          {target ? 'Terminar' : 'Volver'}
        </button>
      </header>

      <div className="collection-toolbar">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true">
            &#128269;
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por artista, álbum o género..."
            className="search-input"
            spellCheck={false}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} title="Limpiar">
              ✕
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
                  <span className="explore-album-sub">
                    {album.artists} · {album.year ?? '—'} · {format?.label ?? album.format}
                    {album.genres.length > 0 && ` · ${album.genres.join(', ')}`}
                  </span>
                </span>

                <span className="explore-album-count">
                  {album.trackCount === 1 ? '1 canción' : `${album.trackCount} canciones`}
                </span>

                <span className="explore-album-chevron" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
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
                          <span className="explore-track-number">
                            {track.side !== 'N/A' ? `${track.side}${track.number}` : track.number}
                          </span>
                          <span className="explore-track-title">{track.title}</span>
                          <span className="explore-track-duration">
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
