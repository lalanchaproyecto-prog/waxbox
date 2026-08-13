import { useEffect, useMemo, useRef, useState } from 'react'
import type { AlbumSummary } from '@core/database/db'
import { PHYSICAL_FORMATS, getFormat } from '@core/models/formats'
import type { PhysicalFormatId } from '@core/models/formats'
import { conditionShort, CONDITIONS } from '@core/models/condition'
import type { ConditionId } from '@core/models/condition'
import ExportDialog from './ExportDialog'

interface CollectionScreenProps {
  albums: AlbumSummary[]
  collectionId: number
  onOpen: (albumId: number) => void
  onAdd: () => void
  onBack: () => void
  /** Sin definir cuando la función de setlists está apagada en Configuración. */
  onOpenSetlists?: () => void
  /** Abre la lista de deseos. */
  onOpenWishlist?: () => void
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
    album.format.toLowerCase().includes(q) ||
    album.genres.some((genre) => genre.toLowerCase().includes(q)) ||
    album.tags.some((tag) => tag.toLowerCase().includes(q))
  )
}

/**
 * La década de un año: 1987 → 1980.
 *
 * Null cuando el disco no tiene año, que es distinto de "década desconocida
 * igual a cero" y por eso no se le inventa una.
 */
function decadeOf(year: number | null): number | null {
  if (year === null || !Number.isFinite(year)) return null
  return Math.floor(year / 10) * 10
}

/**
 * Todo lo que se puede filtrar a la vez.
 *
 * Van juntos en un solo objeto y no en cinco estados sueltos porque siempre se
 * leen y se limpian en bloque: separarlos obligaría a acordarse de tocar los
 * cinco cada vez que se agrega uno nuevo.
 */
interface Filtros {
  formato: PhysicalFormatId | null
  genero: string | null
  decada: number | null
  estado: ConditionId | null
  etiqueta: string | null
}

const SIN_FILTROS: Filtros = {
  formato: null,
  genero: null,
  decada: null,
  estado: null,
  etiqueta: null
}

/** Un disco pasa el filtro solo si cumple TODAS las condiciones activas. */
function matchesFilters(album: AlbumSummary, filtros: Filtros): boolean {
  if (filtros.formato && album.format !== filtros.formato) return false
  if (filtros.genero && !album.genres.includes(filtros.genero)) return false
  if (filtros.decada !== null && decadeOf(album.year) !== filtros.decada) return false
  if (filtros.estado && album.condition !== filtros.estado) return false
  if (filtros.etiqueta && !album.tags.includes(filtros.etiqueta)) return false
  return true
}

function CollectionScreen({
  albums,
  collectionId,
  onOpen,
  onAdd,
  onBack,
  onOpenSetlists,
  onOpenWishlist
}: CollectionScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  /*
    Las opciones de cada filtro salen de la colección real, no de una lista
    fija: no tiene sentido ofrecer "década de 1950" a quien no tiene ningún
    disco de esa época.
  */
  const allGenres = useMemo(() => {
    const set = new Set<string>()
    for (const album of albums) {
      for (const genre of album.genres) set.add(genre)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [albums])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const album of albums) {
      for (const tag of album.tags) set.add(tag)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [albums])

  const allDecades = useMemo(() => {
    const set = new Set<number>()
    for (const album of albums) {
      const decade = decadeOf(album.year)
      if (decade !== null) set.add(decade)
    }
    return [...set].sort((a, b) => b - a)
  }, [albums])

  const allConditions = useMemo(() => {
    const presentes = new Set(albums.map((album) => album.condition).filter(Boolean))
    return CONDITIONS.filter((option) => presentes.has(option.id))
  }, [albums])

  function setFiltro<K extends keyof Filtros>(key: K, value: Filtros[K]) {
    // Volver a pulsar el filtro activo lo apaga: es lo que la gente espera de
    // un botón que se queda marcado.
    setFiltros((current) => ({ ...current, [key]: current[key] === value ? null : value }))
  }

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

  const filtered = albums.filter(
    (a) =>
      (!search.trim() || matchesSearch(a, search.trim())) && matchesFilters(a, filtros)
  )

  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const activos = (Object.keys(filtros) as Array<keyof Filtros>).filter(
    (key) => filtros[key] !== null
  )
  const hasActiveFilters = activos.length > 0

  return (
    <div className="collection">
      <header className="collection-header">
        <div>
          <button className="btn-link" onClick={onBack}>&larr; Inicio</button>
          <h2>Tu colección</h2>
          <p className="collection-count">
            {albums.length === 1 ? '1 disco' : `${albums.length} discos`}
            {(search.trim() || hasActiveFilters) && filtered.length !== albums.length &&
              ` · ${filtered.length} encontrados`}
          </p>
        </div>
        <div className="collection-header-actions">
          {/* Va aparte y en otro color: no es gestionar discos, es su propia sección. */}
          {onOpenWishlist && (
            <button className="btn btn-ghost" onClick={onOpenWishlist}>
              Deseos
            </button>
          )}
          {onOpenSetlists && (
            <button className="btn btn-setlists" onClick={onOpenSetlists}>
              Setlists
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setExporting(true)}>
            Exportar
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            + Agregar disco
          </button>
        </div>
      </header>

      {exporting && (
        <ExportDialog
          kind="collection"
          collectionId={collectionId}
          title="Exportar mi colección"
          onClose={() => setExporting(false)}
        />
      )}

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
            spellCheck={false}
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

      {/*
        Los filtros se cruzan entre sí: género + década + estado + etiqueta +
        formato se aplican todos a la vez. Cada uno se apaga volviéndolo a
        pulsar, y "Quitar filtros" los limpia todos de una.
      */}
      <div className="collection-filters">
        <div className="filter-group">
          <button
            className={`filter-chip${filtros.formato === null ? ' selected' : ''}`}
            onClick={() => setFiltros((f) => ({ ...f, formato: null }))}
          >
            Todos
          </button>
          {PHYSICAL_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              className={`filter-chip${filtros.formato === fmt.id ? ' selected' : ''}`}
              onClick={() => setFiltro('formato', fmt.id)}
            >
              {fmt.icon} {fmt.label}
            </button>
          ))}
        </div>

        <div className="filter-selects">
          {allGenres.length > 0 && (
            <select
              className="filter-select"
              aria-label="Filtrar por género"
              value={filtros.genero ?? ''}
              onChange={(e) => setFiltros((f) => ({ ...f, genero: e.target.value || null }))}
            >
              <option value="">Todos los géneros</option>
              {allGenres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          )}

          {allDecades.length > 0 && (
            <select
              className="filter-select"
              aria-label="Filtrar por década"
              value={filtros.decada ?? ''}
              onChange={(e) =>
                setFiltros((f) => ({
                  ...f,
                  decada: e.target.value ? Number(e.target.value) : null
                }))
              }
            >
              <option value="">Todas las décadas</option>
              {allDecades.map((decade) => (
                <option key={decade} value={decade}>{decade}s</option>
              ))}
            </select>
          )}

          {allConditions.length > 0 && (
            <select
              className="filter-select"
              aria-label="Filtrar por estado de conservación"
              value={filtros.estado ?? ''}
              onChange={(e) =>
                setFiltros((f) => ({
                  ...f,
                  estado: (e.target.value as ConditionId) || null
                }))
              }
            >
              <option value="">Cualquier estado</option>
              {allConditions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          )}

          {allTags.length > 0 && (
            <select
              className="filter-select"
              aria-label="Filtrar por etiqueta"
              value={filtros.etiqueta ?? ''}
              onChange={(e) => setFiltros((f) => ({ ...f, etiqueta: e.target.value || null }))}
            >
              <option value="">Todas las etiquetas</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
        </div>

        {hasActiveFilters && (
          <button className="btn-link" onClick={() => setFiltros(SIN_FILTROS)}>
            Quitar {activos.length === 1 ? 'el filtro' : `los ${activos.length} filtros`}
          </button>
        )}
      </div>

      {filtered.length === 0 && (search.trim() || hasActiveFilters) && (
        <p className="empty-note">
          No se encontró nada con esos criterios. Prueba con otro término o quita algún filtro.
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
