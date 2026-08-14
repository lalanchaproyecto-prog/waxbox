import { useEffect, useMemo, useRef, useState } from 'react'
import type { AlbumSummary } from '@core/database/db'
import { PHYSICAL_FORMATS, getFormat } from '@core/models/formats'
import type { PhysicalFormatId } from '@core/models/formats'
import { conditionShort, CONDITIONS } from '@core/models/condition'
import type { ConditionId } from '@core/models/condition'
import ExportDialog from './ExportDialog'
import PageHeader from './PageHeader'
import { IconClose, IconGrid, IconSearch, IconTable } from './Icons'
import { suggestName, type SmartCriteria } from '@core/models/smartList'

interface CollectionScreenProps {
  albums: AlbumSummary[]
  collectionId: number
  onOpen: (albumId: number) => void
  onAdd: () => void
  /**
   * Filtros con los que entrar ya aplicados.
   *
   * Es lo que hace que una lista inteligente lleve a algún sitio: al abrirla
   * desde el inicio se entra aquí con sus condiciones puestas, en vez de
   * mostrar otra pantalla parecida pero distinta.
   */
  initialFilters?: SmartCriteria | null
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

/** Los criterios guardados de una lista, traducidos a los filtros de aquí. */
function filtrosDesde(criteria: SmartCriteria | null | undefined): Filtros {
  if (!criteria) return SIN_FILTROS
  return {
    formato: criteria.formato ?? null,
    genero: criteria.genero ?? null,
    decada: criteria.decada ?? null,
    estado: criteria.estado ?? null,
    etiqueta: criteria.etiqueta ?? null
  }
}

function CollectionScreen({
  albums,
  collectionId,
  onOpen,
  onAdd,
  initialFilters
}: CollectionScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState(initialFilters?.texto ?? '')
  const [filtros, setFiltros] = useState<Filtros>(() => filtrosDesde(initialFilters))
  const [exporting, setExporting] = useState(false)
  const [guardandoLista, setGuardandoLista] = useState(false)
  const [nombreLista, setNombreLista] = useState('')
  const [errorLista, setErrorLista] = useState<string | null>(null)
  /** Se muestra un momento tras guardar, para confirmar que quedó. */
  const [listaGuardada, setListaGuardada] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  /* Entrar desde otra lista cambia los filtros sin remontar la pantalla. */
  useEffect(() => {
    setFiltros(filtrosDesde(initialFilters))
    setSearch(initialFilters?.texto ?? '')
  }, [initialFilters])

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

  /*
    Ctrl+K ya NO se atiende aquí: ahora abre la búsqueda global de toda la
    app. Tener las dos escuchando la misma combinación hacía que al pulsarla
    en esta pantalla se abriera la paleta Y se robara el foco este campo.

    Son dos cosas distintas y conviene que se noten distintas: la paleta
    encuentra un disco en cualquier parte, este campo filtra lo que se está
    viendo aquí sin salir de la pantalla.
  */

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

  /** Lo que está aplicado ahora, en el formato en que se guarda una lista. */
  const criteriosActuales: SmartCriteria = {
    texto: search.trim() || undefined,
    formato: filtros.formato,
    genero: filtros.genero,
    decada: filtros.decada,
    estado: filtros.estado,
    etiqueta: filtros.etiqueta
  }

  async function guardarLista() {
    const nombre = nombreLista.trim()
    if (!nombre) return
    setErrorLista(null)
    const result = await window.api.createSmartList(collectionId, nombre, criteriosActuales)
    if (!result.ok) {
      setErrorLista(result.error)
      return
    }
    setGuardandoLista(false)
    // Se confirma con el nombre puesto: quien acaba de escribirlo necesita
    // ver que quedó guardado y dónde encontrarlo.
    setListaGuardada(nombre)
    setTimeout(() => setListaGuardada(null), 6000)
  }

  return (
    <div className="screen">
      {/*
        Deseos y Setlists ya no viven aquí: son secciones del menú, y tenerlas
        también como botones dentro de la colección hacía parecer que eran
        acciones sobre los discos. Exportar sí se queda, porque exporta ESTA
        pantalla — lo que estás viendo, con sus filtros aplicados.
      */}
      <PageHeader
        title="Colección"
        subtitle={
          `${albums.length === 1 ? '1 disco' : `${albums.length} discos`}` +
          ((search.trim() || hasActiveFilters) && filtered.length !== albums.length
            ? ` · ${filtered.length} encontrados`
            : '')
        }
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setExporting(true)}>
              Exportar
            </button>
            <button className="btn btn-primary" onClick={onAdd}>
              Agregar disco
            </button>
          </>
        }
      />

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
          <span className="search-icon" aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por artista, álbum, año o sello"
            className="search-input"
            spellCheck={false}
            aria-label="Filtrar la colección"
          />
          {search && (
            <button
              className="search-clear"
              onClick={() => setSearch('')}
              aria-label="Limpiar el filtro"
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        <div className="view-toggle" role="radiogroup" aria-label="Vista">
          <button
            role="radio"
            aria-checked={viewMode === 'grid'}
            className={`view-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label="Ver las portadas"
            title="Portadas"
          >
            <IconGrid size={16} />
          </button>
          <button
            role="radio"
            aria-checked={viewMode === 'table'}
            className={`view-btn${viewMode === 'table' ? ' active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-label="Ver los datos en tabla"
            title="Datos"
          >
            <IconTable size={16} />
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

      </div>

      {/*
        Los filtros activos, cada uno con su propia salida.

        Antes solo había un "Quitar los 3 filtros" que los borraba todos de
        golpe: para soltar uno solo había que acordarse de cuál de los cuatro
        desplegables lo tenía y volver a ponerlo en "todos". Aquí se ve qué
        está aplicado y se suelta de a uno.
      */}
      {hasActiveFilters && (
        <div className="active-filters">
          <span className="active-filters-label">Filtrando por</span>
          {filtros.formato && (
            <FilterToken
              text={getFormat(filtros.formato)?.label ?? filtros.formato}
              onRemove={() => setFiltros((f) => ({ ...f, formato: null }))}
            />
          )}
          {filtros.genero && (
            <FilterToken
              text={filtros.genero}
              onRemove={() => setFiltros((f) => ({ ...f, genero: null }))}
            />
          )}
          {filtros.decada !== null && (
            <FilterToken
              text={`${filtros.decada}s`}
              onRemove={() => setFiltros((f) => ({ ...f, decada: null }))}
            />
          )}
          {filtros.estado && (
            <FilterToken
              text={CONDITIONS.find((c) => c.id === filtros.estado)?.label ?? filtros.estado}
              onRemove={() => setFiltros((f) => ({ ...f, estado: null }))}
            />
          )}
          {filtros.etiqueta && (
            <FilterToken
              text={filtros.etiqueta}
              onRemove={() => setFiltros((f) => ({ ...f, etiqueta: null }))}
            />
          )}
          <button className="btn-link" onClick={() => setFiltros(SIN_FILTROS)}>
            Quitar {activos.length === 1 ? 'el filtro' : 'todos'}
          </button>

          {/*
            Guardar lo que estás viendo como lista con nombre.

            Guarda las CONDICIONES, no los discos que cumplen hoy: mañana
            entra solo el disco que compres y encaje. Por eso el botón vive
            aquí, junto a los filtros, y no en un menú aparte — lo que se
            guarda es exactamente esto.
          */}
          {!guardandoLista && (
            <button
              className="btn-link"
              onClick={() => {
                setNombreLista(
                  suggestName(criteriosActuales, getFormat(filtros.formato ?? '')?.label)
                )
                setGuardandoLista(true)
              }}
            >
              Guardar como lista
            </button>
          )}
        </div>
      )}

      {listaGuardada && (
        <p className="lista-guardada">
          Lista «{listaGuardada}» guardada. La encuentras en Inicio, en «Mis listas».
        </p>
      )}

      {guardandoLista && (
        <div className="guardar-lista">
          <label className="field">
            <span className="field-label">Nombre de la lista</span>
            <input
              value={nombreLista}
              onChange={(e) => setNombreLista(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardarLista()
                if (e.key === 'Escape') setGuardandoLista(false)
              }}
              placeholder="Ej: Vinilos de los 70"
              autoFocus
              spellCheck={false}
            />
          </label>
          <p className="card-nota">
            Se guardan las condiciones, no los {filtered.length} discos de ahora: la lista se
            recalcula sola cada vez que la abras.
          </p>
          {errorLista && <p className="feedback-error">{errorLista}</p>}
          <div className="guardar-lista-acciones">
            <button className="btn btn-ghost" onClick={() => setGuardandoLista(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={guardarLista}
              disabled={nombreLista.trim().length === 0}
            >
              Guardar lista
            </button>
          </div>
        </div>
      )}

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
                /* El disco que asoma al pasar por encima solo tiene sentido
                   donde hay un disco: un casete no sale de su funda así. */
                data-format={album.format}
              >
                <span className="album-card-sleeve">
                  <span className="album-card-disc" aria-hidden="true" />
                  <span className="album-card-cover">
                    {src ? (
                      <img src={src} alt={`Portada de ${album.title}`} loading="lazy" />
                    ) : (
                      <span className="album-card-placeholder" aria-hidden="true">
                        {format?.icon ?? '🎵'}
                      </span>
                    )}
                  </span>
                </span>

                <span className="album-card-info">
                  <span className="album-card-title">{album.title}</span>
                  <span className="album-card-artist">{album.artists}</span>
                  <span className="album-card-meta numeric">
                    {album.year ?? '——'} · {format?.label ?? album.format} · {album.trackCount}{' '}
                    {album.trackCount === 1 ? 'canción' : 'canciones'}
                  </span>
                </span>
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

/** Un filtro aplicado, con su propia salida. */
function FilterToken({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span className="filter-token">
      {text}
      <button onClick={onRemove} aria-label={`Quitar el filtro ${text}`}>
        <IconClose size={12} />
      </button>
    </span>
  )
}

export default CollectionScreen
