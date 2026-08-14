import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SetlistSummary, SetlistDetail, AlbumSummary } from '@core/database/db'
import { formatTotalDuration, durationToSeconds } from '@core/models/duration'
import { getFormat } from '@core/models/formats'
import ExportDialog from './ExportDialog'
import GenerateSetlistDialog from './GenerateSetlistDialog'
import ImagePicker from './ImagePicker'
import PageHeader from './PageHeader'
import { imageSrc, type ImageRef } from '@core/models/imageRef'

interface SetlistsScreenProps {
  /** La colección, para saber qué géneros existen de verdad. */
  albums: AlbumSummary[]
  /** Colección activa: los setlists son suyos. */
  collectionId: number
  /** Abre el modo explorar para sumar canciones al setlist indicado. */
  onExplore: (setlist: { id: number; name: string }) => void
  /** Setlist que debe abrirse al entrar, si se viene de vuelta del modo explorar. */
  initialSetlistId?: number | null
}

function SetlistsScreen({
  albums,
  collectionId,
  onExplore,
  initialSetlistId
}: SetlistsScreenProps) {
  const [setlists, setSetlists] = useState<SetlistSummary[]>([])
  const [openId, setOpenId] = useState<number | null>(initialSetlistId ?? null)
  const [detail, setDetail] = useState<SetlistDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  /** Setlist al que se le está eligiendo imagen. */
  const [imagenDe, setImagenDe] = useState<SetlistSummary | SetlistDetail | null>(null)

  const allGenres = useMemo(() => {
    const set = new Set<string>()
    for (const album of albums) {
      for (const genre of album.genres) set.add(genre)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [albums])

  const refreshList = useCallback(async () => {
    const result = await window.api.listSetlists(collectionId)
    if (result.ok) setSetlists(result.data)
    else setError(result.error)
  }, [collectionId])

  const loadDetail = useCallback(async (setlistId: number) => {
    const result = await window.api.getSetlist(setlistId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDetail(result.data)
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    if (openId === null) setDetail(null)
    else loadDetail(openId)
  }, [openId, loadDetail])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    const result = await window.api.createSetlist(collectionId, name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setNewName('')
    setCreating(false)
    await refreshList()
    setOpenId(result.data.id)
  }

  async function handleRename(setlistId: number) {
    const name = renameValue.trim()
    if (!name) return

    const result = await window.api.renameSetlist(setlistId, name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setRenamingId(null)
    setRenameValue('')
    await refreshList()
    if (openId === setlistId) await loadDetail(setlistId)
  }

  async function handleDelete(setlistId: number) {
    const result = await window.api.deleteSetlist(setlistId)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setConfirmDeleteId(null)
    if (openId === setlistId) setOpenId(null)
    await refreshList()
  }

  async function handleRemoveTrack(trackId: number) {
    if (openId === null) return

    const result = await window.api.removeTrackFromSetlist(openId, trackId)
    if (!result.ok) {
      setError(result.error)
      return
    }

    await loadDetail(openId)
    await refreshList()
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!detail || openId === null) return

    const target = index + direction
    if (target < 0 || target >= detail.tracks.length) return

    const ids = detail.tracks.map((track) => track.trackId)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]

    const result = await window.api.reorderSetlist(openId, ids)
    if (!result.ok) {
      setError(result.error)
      return
    }

    await loadDetail(openId)
  }

  // --- Detalle de un setlist ---------------------------------------------

  if (openId !== null && detail) {
    const seconds = detail.tracks.map((track) => durationToSeconds(track.duration))
    const missing = seconds.filter((value) => value === null).length
    const totalSeconds = seconds.reduce<number>((sum, value) => sum + (value ?? 0), 0)

    return (
      <div className="setlists">
        <header className="setlist-detail-header">
          <button className="btn-link" onClick={() => setOpenId(null)}>
            ← Todos mis setlists
          </button>

          {renamingId === detail.id ? (
            <div className="setlist-rename">
              <input
                type="text"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleRename(detail.id)
                  if (event.key === 'Escape') setRenamingId(null)
                }}
                autoFocus
              />
              <button className="btn btn-ghost" onClick={() => setRenamingId(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => handleRename(detail.id)}>
                Guardar
              </button>
            </div>
          ) : (
            <div className="setlist-detail-title">
              {imageSrc(detail.image) && (
                <img className="setlist-detail-image" src={imageSrc(detail.image)!} alt="" />
              )}
              <h2>{detail.name}</h2>
              <button
                className="btn-link"
                onClick={() => {
                  setRenamingId(detail.id)
                  setRenameValue(detail.name)
                }}
              >
                ✎ Renombrar
              </button>
              <button className="btn-link" onClick={() => setImagenDe(detail)}>
                🖼 Imagen
              </button>
            </div>
          )}

          <p className="setlist-detail-meta">
            {detail.tracks.length === 1
              ? '1 canción'
              : `${detail.tracks.length} canciones`}
            {totalSeconds > 0 && ` · ${formatTotalDuration(totalSeconds)}`}
            {missing > 0 && ` (${missing} sin duración conocida)`}
          </p>
        </header>

        {error && <p className="feedback-error">{error}</p>}

        {detail.tracks.length === 0 ? (
          <p className="empty-note">
            Este setlist está vacío. Explora tu colección para agregarle canciones.
          </p>
        ) : (
          <ol className="setlist-track-rows">
            {detail.tracks.map((track, index) => {
              const format = getFormat(track.albumFormat)
              const cover = track.userCoverFront
                ? `waxbox-photo://${track.userCoverFront}`
                : track.canonicalCover
              return (
                <li className="setlist-track-row" key={track.trackId}>
                  <span className="setlist-track-position">{index + 1}</span>

                  <span className="setlist-track-cover">
                    {cover ? (
                      <img src={cover} alt="" loading="lazy" />
                    ) : (
                      <span className="setlist-track-cover-empty">
                        {format?.icon ?? '🎵'}
                      </span>
                    )}
                  </span>

                  <span className="setlist-track-body">
                    <span className="setlist-track-title">{track.title}</span>
                    <span className="setlist-track-sub">
                      {track.artist} · {track.albumTitle}
                    </span>
                  </span>

                  <span className="setlist-track-duration">{track.duration ?? '—'}</span>

                  <span className="setlist-track-actions">
                    <button
                      className="setlist-move-btn"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      title="Subir"
                    >
                      ▲
                    </button>
                    <button
                      className="setlist-move-btn"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === detail.tracks.length - 1}
                      title="Bajar"
                    >
                      ▼
                    </button>
                    <button
                      className="setlist-remove-btn"
                      onClick={() => handleRemoveTrack(track.trackId)}
                      title="Quitar de este setlist"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        <footer className="setlist-detail-footer">
          <div className="setlist-detail-actions">
            {detail.tracks.length > 0 && (
              <button className="btn btn-ghost" onClick={() => setExportingId(detail.id)}>
                Exportar
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => onExplore({ id: detail.id, name: detail.name })}
            >
              + Agregar canciones
            </button>
          </div>
        </footer>

        {exportingId === detail.id && (
          <ExportDialog
            kind="setlist"
            collectionId={collectionId}
            setlistId={detail.id}
            title={`Exportar «${detail.name}»`}
            onClose={() => setExportingId(null)}
          />
        )}
      </div>
    )
  }

  // --- Lista de setlists --------------------------------------------------

  return (
    <div className="screen setlists">
      <PageHeader
        title="Setlists"
        subtitle={
          setlists.length === 0
            ? 'Ninguno todavía'
            : setlists.length === 1
              ? '1 setlist'
              : `${setlists.length} setlists`
        }
        actions={
          !creating && (
            <>
              <button className="btn btn-ghost" onClick={() => setGenerating(true)}>
                Generar automático
              </button>
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                Nuevo setlist
              </button>
            </>
          )
        }
      />

      {generating && (
        <GenerateSetlistDialog
          genres={allGenres}
          collectionId={collectionId}
          onCreated={async (setlistId) => {
            setGenerating(false)
            await refreshList()
            setOpenId(setlistId)
          }}
          onClose={() => setGenerating(false)}
        />
      )}

      {error && <p className="feedback-error">{error}</p>}

      {creating && (
        <div className="setlist-create-row">
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreate()
              if (event.key === 'Escape') {
                setCreating(false)
                setNewName('')
              }
            }}
            placeholder="Ej: Fiesta años 80"
            autoFocus
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              setCreating(false)
              setNewName('')
            }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={newName.trim().length === 0}
          >
            Crear
          </button>
        </div>
      )}

      {setlists.length === 0 && !creating && (
        <p className="empty-note">
          Un setlist es una lista de canciones armada por ti, tomando temas de
          distintos discos de tu colección. Crea el primero para empezar.
        </p>
      )}

      <ul className="setlist-cards">
        {setlists.map((setlist) => (
          <li className="setlist-card" key={setlist.id}>
            {renamingId === setlist.id ? (
              <div className="setlist-rename">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleRename(setlist.id)
                    if (event.key === 'Escape') setRenamingId(null)
                  }}
                  autoFocus
                />
                <button className="btn btn-ghost" onClick={() => setRenamingId(null)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={() => handleRename(setlist.id)}>
                  Guardar
                </button>
              </div>
            ) : (
              <>
                <button className="setlist-card-main" onClick={() => setOpenId(setlist.id)}>
                  <span className="setlist-card-name">{setlist.name}</span>
                  <span className="setlist-card-meta">
                    {setlist.trackCount === 1
                      ? '1 canción'
                      : `${setlist.trackCount} canciones`}
                    {setlist.totalSeconds > 0 &&
                      ` · ${formatTotalDuration(setlist.totalSeconds)}`}
                    {setlist.tracksWithoutDuration > 0 &&
                      ` (${setlist.tracksWithoutDuration} sin duración)`}
                  </span>
                </button>

                <div className="setlist-card-actions">
                  <button
                    className="btn-link"
                    onClick={() => {
                      setRenamingId(setlist.id)
                      setRenameValue(setlist.name)
                    }}
                  >
                    ✎ Renombrar
                  </button>

                  {confirmDeleteId === setlist.id ? (
                    <span className="confirm-delete">
                      <span>¿Borrar &quot;{setlist.name}&quot;?</span>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        No
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(setlist.id)}
                      >
                        Sí, borrar
                      </button>
                    </span>
                  ) : (
                    <button
                      className="btn-link btn-link-danger"
                      onClick={() => setConfirmDeleteId(setlist.id)}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {/*
        La sugerencia de búsqueda sale de los géneros de la colección cuando los
        hay: el nombre de un setlist generado ("Setlist Rock — 20 canciones")
        buscado tal cual no daría ninguna imagen, y "rock" sí.
      */}
      {imagenDe && (
        <ImagePicker
          title={imagenDe.name}
          current={imagenDe.image}
          destino="archivo"
          sugerencia={imagenDe.name}
          generos={allGenres}
          onChange={async (image: ImageRef | null) => {
            const result = await window.api.setSetlistImage(imagenDe.id, image)
            if (!result.ok) { setError(result.error); return }
            refreshList()
            if (detail && detail.id === imagenDe.id) loadDetail(imagenDe.id)
          }}
          onClose={() => setImagenDe(null)}
        />
      )}
    </div>
  )
}

export default SetlistsScreen
