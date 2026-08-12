import { useEffect, useRef, useState } from 'react'
import type { AlbumSummary } from '@core/database/db'
import { getFormat } from '@core/models/formats'
import { conditionShort } from '@core/models/condition'

interface CollectionScreenProps {
  albums: AlbumSummary[]
  onOpen: (albumId: number) => void
  onAdd: () => void
}

type ViewMode = 'grid' | 'table'
type SortKey = 'title' | 'artists' | 'year' | 'label' | 'format' | 'condition' | 'trackCount'
type SortDir = 'asc' | 'desc'

const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: 'title', label: 'Título' },
  { key: 'artists', label: 'Artista' },
  { key: 'year', label: 'Año', className: 'col-num' },
  { key: 'label', label: 'Sello' },
  { key: 'format', label: 'Formato', className: 'col-short' },
  { key: 'condition', label: 'Estado', className: 'col-short' },
  { key: 'trackCount', label: 'Canciones', className: 'col-num' }
]

function coverSrc(album: AlbumSummary): string | null {
  if (album.userCoverFront) return `waxbox-photo://${album.userCoverFront}`
  return album.canonicalCover
}

function sortValue(album: AlbumSummary, key: SortKey): string | number {
  switch (key) {
    case 'title': return album.title.toLowerCase()
    case 'artists': return album.artists.toLowerCase()
    case 'year': return album.year ?? 0
    case 'label': return (album.label ?? '').toLowerCase()
    case 'format': return album.format
    case 'condition': return album.condition ?? 'zzz'
    case 'trackCount': return album.trackCount
  }
}

function matchesSearch(album: AlbumSummary, query: string): boolean {
  const q = query.toLowerCase()
  return (
    album.title.toLowerCase().includes(q) ||
    album.artists.toLowerCase().includes(q) ||
    (album.label ?? '').toLowerCase().includes(q) ||
    (album.year?.toString() ?? '').includes(q) ||
    album.format.toLowerCase().includes(q)
  )
}

function CollectionScreen({ albums, onOpen, onAdd }: CollectionScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = search.trim()
    ? albums.filter((a) => matchesSearch(a, search.trim()))
    : albums

  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="collection">
      <header className="collection-header">
        <div>
          <h2>Tu colección</h2>
          <p className="collection-count">
            {albums.length === 1 ? '1 disco' : `${albums.length} discos`}
            {search.trim() && filtered.length !== albums.length &&
              ` · ${filtered.length} encontrados`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          + Agregar disco
        </button>
      </header>

      <div className="collection-toolbar">
        <div className="search-box">
          <span className="search-icon" aria-hidden="true">&#128269;</span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por artista, álbum, año, sello...  (Ctrl+K)"
            className="search-input"
          />
          {search && (
            <button
              className="search-clear"
              onClick={() => setSearch('')}
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        <div className="view-toggle" role="radiogroup" aria-label="Vista">
          <button
            role="radio"
            aria-checked={viewMode === 'grid'}
            className={`view-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Cuadrícula de portadas"
          >
            &#9638;&#9638;
          </button>
          <button
            role="radio"
            aria-checked={viewMode === 'table'}
            className={`view-btn${viewMode === 'table' ? ' active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Tabla con datos"
          >
            &#9776;
          </button>
        </div>
      </div>

      {filtered.length === 0 && search.trim() && (
        <p className="empty-note">
          No se encontró nada con "{search}". Prueba con otro término.
        </p>
      )}

      {viewMode === 'grid' && (
        <div className="collection-grid">
          {sorted.map((album) => {
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
      )}

      {viewMode === 'table' && (
        <div className="collection-table-wrap">
          <table className="collection-table">
            <thead>
              <tr>
                <th className="col-cover"></th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`sortable ${col.className ?? ''} ${sortKey === col.key ? 'sorted' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="sort-arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((album) => {
                const src = coverSrc(album)
                const format = getFormat(album.format)
                return (
                  <tr key={album.id} onClick={() => onOpen(album.id)}>
                    <td className="col-cover">
                      {src ? (
                        <img
                          className="table-thumb"
                          src={src}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="table-thumb-empty">{format?.icon ?? '🎵'}</span>
                      )}
                    </td>
                    <td className="col-title">{album.title}</td>
                    <td>{album.artists}</td>
                    <td className="col-num">{album.year ?? '—'}</td>
                    <td>{album.label ?? '—'}</td>
                    <td className="col-short">{format?.icon ?? ''} {format?.label ?? album.format}</td>
                    <td className="col-short">{conditionShort(album.condition)}</td>
                    <td className="col-num">{album.trackCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CollectionScreen
