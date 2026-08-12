import type { AlbumSummary } from '@core/database/db'
import { getFormat } from '@core/models/formats'

interface CollectionScreenProps {
  albums: AlbumSummary[]
  onOpen: (albumId: number) => void
  onAdd: () => void
}

function coverSrc(album: AlbumSummary): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
  return album.canonicalCover
}

function CollectionScreen({ albums, onOpen, onAdd }: CollectionScreenProps) {
  return (
    <div className="collection">
      <header className="collection-header">
        <div>
          <h2>Tu colección</h2>
          <p className="collection-count">
            {albums.length === 1
              ? '1 disco'
              : `${albums.length} discos`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          + Agregar disco
        </button>
      </header>

      <div className="collection-grid">
        {albums.map((album) => {
          const src = coverSrc(album)
          const format = getFormat(album.format)
          return (
            <button
              key={album.id}
              className="album-card"
              onClick={() => onOpen(album.id)}
            >
              <div className="album-card-cover">
                {src ? (
                  <img src={src} alt={`Portada de ${album.title}`} loading="lazy" />
                ) : (
                  <div className="album-card-placeholder">
                    <span>{format?.icon ?? '🎵'}</span>
                  </div>
                )}
              </div>
              <div className="album-card-info">
                <span className="album-card-title">{album.title}</span>
                <span className="album-card-artist">{album.artists}</span>
                <span className="album-card-meta">
                  {album.year ?? '—'} · {format?.icon ?? ''} {album.trackCount} canciones
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CollectionScreen
