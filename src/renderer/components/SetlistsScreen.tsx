import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SetlistSummary, SetlistDetail, AlbumSummary } from '@core/database/db'
import { formatTotalDuration, durationToSeconds } from '@core/models/duration'
import { getFormat } from '@core/models/formats'
import ExportDialog from './ExportDialog'
import GenerateSetlistDialog from './GenerateSetlistDialog'
import ImagePicker from './ImagePicker'
import PageHeader from './PageHeader'
import { IconClose, IconDown, IconEdit, IconImage, IconTrash, IconUp } from './Icons'
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

/** «12 canciones · 48 min», con el aviso de lo que no se puede sumar. */
function describeSetlist(
  trackCount: number,
  totalSeconds: number,
  withoutDuration: number
): string {
  const partes = [trackCount === 1 ? '1 canción' : `${trackCount} canciones`]
  if (totalSeconds > 0) partes.push(formatTotalDuration(totalSeconds))
  if (withoutDuration > 0) {
    partes.push(
      withoutDuration === 1 ? '1 sin duración' : `${withoutDuration} sin duración`
    )
  }
  return partes.join(' · ')
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
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generating, setGenerating] = useState(false)
  /** Setlist al que se le está eligiendo imagen: siempre el que está abierto. */
  const [imagenDe, setImagenDe] = useState<SetlistDetail | null>(null)

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

  /** Al cerrar un setlist se olvida todo lo que se estaba haciendo con él. */
  function closeDetail() {
    setOpenId(null)
    setRenaming(false)
    setConfirmDelete(false)
    setExporting(false)
  }

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

    setRenaming(false)
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

    setConfirmDelete(false)
    if (openId === setlistId) closeDetail()
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

  /*
    TODO lo que se le puede hacer a un setlist vive AQUÍ dentro, y no repartido
    entre la lista y el detalle.

    Antes cada tarjeta de la lista llevaba colgando "Renombrar" y "Borrar", así
    que la lista era una cuadrícula de tarjetas con tres cosas que pulsar y
    ninguna clara. Abrir un setlist es la manera de decir "quiero trabajar con
    este", y es ahí donde tiene sentido ofrecer todo lo demás — el mismo
    criterio que en las listas inteligentes de la colección.
  */
  if (openId !== null && detail) {
    const seconds = detail.tracks.map((track) => durationToSeconds(track.duration))
    const missing = seconds.filter((value) => value === null).length
    const totalSeconds = seconds.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    const portada = imageSrc(detail.image)

    return (
      <div className="screen setlist-detail">
        <PageHeader
          title={detail.name}
          subtitle={describeSetlist(detail.tracks.length, totalSeconds, missing)}
          onBack={closeDetail}
          backLabel="Todos mis setlists"
          actions={
            <>
              {detail.tracks.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setExporting(true)}>
                  Exportar
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => onExplore({ id: detail.id, name: detail.name })}
              >
                Agregar canciones
              </button>
            </>
          }
        />

        {/*
          La franja del objeto: su imagen y lo que se le puede cambiar.

          La imagen va pegada a "Cambiar la imagen" porque es la misma cosa
          vista y editada; separarlas obligaría a buscar en dos sitios.
        */}
        <div className="setlist-gestion">
          <button
            className="setlist-portada"
            onClick={() => setImagenDe(detail)}
            title={portada ? 'Cambiar la imagen' : 'Poner una imagen'}
          >
            {portada ? (
              <img src={portada} alt="" />
            ) : (
              <span className="setlist-portada-vacia" aria-hidden="true">
                <IconImage size={22} />
              </span>
            )}
          </button>

          <div className="setlist-gestion-cuerpo">
            <span className="overline">Este setlist</span>

            {renaming ? (
              <div className="setlist-renombrar">
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleRename(detail.id)
                    if (event.key === 'Escape') setRenaming(false)
                  }}
                  autoFocus
                  spellCheck={false}
                  aria-label="Nombre del setlist"
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRename(detail.id)}
                  disabled={renameValue.trim().length === 0}
                >
                  Guardar nombre
                </button>
              </div>
            ) : (
              <div className="gestion-acciones">
                <button
                  className="btn-link"
                  onClick={() => {
                    setRenameValue(detail.name)
                    setRenaming(true)
                  }}
                >
                  <IconEdit size={15} />
                  Cambiar el nombre
                </button>

                <button className="btn-link" onClick={() => setImagenDe(detail)}>
                  <IconImage size={15} />
                  {portada ? 'Cambiar la imagen' : 'Poner una imagen'}
                </button>

                {/*
                  La confirmación dice qué se pierde y qué no: un setlist son
                  canciones tomadas de discos que siguen en la colección, y
                  quien borra necesita saberlo antes y no después.
                */}
                {confirmDelete ? (
                  <span className="confirm-delete">
                    <span>Se borra el setlist. Tus discos no se tocan.</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfirmDelete(false)}
                    >
                      No
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(detail.id)}>
                      Sí, borrar
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn-link btn-link-danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <IconTrash size={15} />
                    Borrar el setlist
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="feedback-error">{error}</p>}

        {detail.tracks.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Todavía no tiene canciones</p>
            <p className="empty-state-help">
              Un setlist se arma tomando temas sueltos de discos distintos. Recorre tu
              colección y ve sumando los que quieras: el orden lo decides tú.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => onExplore({ id: detail.id, name: detail.name })}
            >
              Agregar canciones
            </button>
          </div>
        ) : (
          <ol className="setlist-track-rows">
            {detail.tracks.map((track, index) => {
              const format = getFormat(track.albumFormat)
              const cover = track.userCoverFront
                ? `waxbox-photo://${track.userCoverFront}`
                : track.canonicalCover
              return (
                <li className="setlist-track-row" key={track.trackId}>
                  <span className="setlist-track-position numeric">{index + 1}</span>

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

                  <span className="setlist-track-duration numeric">
                    {track.duration ?? '—'}
                  </span>

                  {/*
                    El orden es la razón de ser de un setlist, así que subir y
                    bajar no se esconden detrás de un menú: están en cada fila.
                  */}
                  <span className="setlist-track-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      title="Subir"
                      aria-label={`Subir «${track.title}»`}
                    >
                      <IconUp size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === detail.tracks.length - 1}
                      title="Bajar"
                      aria-label={`Bajar «${track.title}»`}
                    >
                      <IconDown size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() => handleRemoveTrack(track.trackId)}
                      title="Quitar de este setlist"
                      aria-label={`Quitar «${track.title}» del setlist`}
                    >
                      <IconClose size={15} />
                    </button>
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {exporting && (
          <ExportDialog
            kind="setlist"
            collectionId={collectionId}
            setlistId={detail.id}
            title={`Exportar «${detail.name}»`}
            onClose={() => setExporting(false)}
          />
        )}

        {imagenDe && (
          <ImagePicker
            title={imagenDe.name}
            current={imagenDe.image}
            destino="archivo"
            sugerencia={imagenDe.name}
            generos={allGenres}
            onChange={async (image: ImageRef | null) => {
              const result = await window.api.setSetlistImage(imagenDe.id, image)
              if (!result.ok) {
                setError(result.error)
                return
              }
              refreshList()
              loadDetail(imagenDe.id)
            }}
            onClose={() => setImagenDe(null)}
          />
        )}
      </div>
    )
  }

  // --- Lista de setlists --------------------------------------------------

  return (
    <div className="screen setlists-screen">
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
        <div className="setlist-crear">
          <span className="overline">Nombre del setlist</span>
          <div className="setlist-crear-fila">
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
              aria-label="Nombre del setlist"
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
        </div>
      )}

      {setlists.length === 0 && !creating && (
        <div className="empty-state">
          <p className="empty-state-title">Ningún setlist todavía</p>
          <p className="empty-state-help">
            Un setlist es una lista de canciones armada por ti, tomando temas de discos
            distintos de tu colección. A diferencia de una lista inteligente, aquí eliges
            canción por canción y el orden importa: sirve para una fiesta, un viaje o una
            grabación concreta.
          </p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Crear el primero
          </button>
        </div>
      )}

      {/*
        Cada setlist es una tarjeta con su imagen, como una funda en el cajón.
        La tarjeta entera es un solo botón que abre: dentro está todo lo que se
        le puede hacer.
      */}
      <ul className="setlist-grid">
        {setlists.map((setlist) => {
          const portada = imageSrc(setlist.image)
          return (
            <li key={setlist.id}>
              <button className="setlist-card" onClick={() => setOpenId(setlist.id)}>
                <span className="setlist-card-cover">
                  {portada ? (
                    <img src={portada} alt="" loading="lazy" />
                  ) : (
                    <span className="setlist-card-cover-vacia" aria-hidden="true">
                      <IconImage size={26} />
                    </span>
                  )}
                </span>
                <span className="setlist-card-name">{setlist.name}</span>
                <span className="setlist-card-meta numeric">
                  {describeSetlist(
                    setlist.trackCount,
                    setlist.totalSeconds,
                    setlist.tracksWithoutDuration
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default SetlistsScreen
