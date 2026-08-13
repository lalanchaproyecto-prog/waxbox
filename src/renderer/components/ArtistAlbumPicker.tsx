import { useState } from 'react'
import type { ArtistAlbum } from '@core/services/musicbrainz'

const TYPE_LABELS: Record<string, string> = {
  Album: 'Álbum',
  Single: 'Sencillo',
  EP: 'EP',
  Compilation: 'Compilación',
  Live: 'En vivo',
  Remix: 'Remix',
  Broadcast: 'Transmisión',
  Other: 'Otro'
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function GroupCover({ releaseGroupId, title }: { releaseGroupId: string; title: string }) {
  const [failed, setFailed] = useState(false)
  const src = `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`

  if (failed) return <span className="candidate-cover-placeholder">💿</span>

  return (
    <img
      className="candidate-cover"
      src={src}
      alt={`Portada de ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

interface ArtistAlbumPickerProps {
  artistName: string
  albums: ArtistAlbum[]
  onPick: (album: ArtistAlbum) => void
  onBack: () => void
}

function ArtistAlbumPicker({ artistName, albums, onPick, onBack }: ArtistAlbumPickerProps) {
  return (
    <div className="picker">
      <header className="picker-header">
        <h2>Discografía de {artistName}</h2>
        <p>
          {albums.length === 0
            ? 'No se encontraron títulos para este artista.'
            : `Se encontraron ${albums.length} ${albums.length === 1 ? 'título' : 'títulos'}. Elige el que tienes en tu colección.`}
        </p>
      </header>

      {albums.length > 0 && (
        <ul className="candidate-list">
          {albums.map((album) => (
            <li key={album.releaseGroupId}>
              <button className="candidate" onClick={() => onPick(album)}>
                <div className="candidate-cover-wrap">
                  <GroupCover releaseGroupId={album.releaseGroupId} title={album.title} />
                </div>
                <div className="candidate-body">
                  <span className="candidate-main">
                    <span className="candidate-title">{album.title}</span>
                  </span>
                  <span className="candidate-meta">
                    {album.year && <span className="tag">{album.year}</span>}
                    <span className="tag">{typeLabel(album.type)}</span>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="picker-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Volver
        </button>
      </footer>
    </div>
  )
}

export default ArtistAlbumPicker
