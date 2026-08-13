import { useEffect, useRef, useState } from 'react'
import type { EditableAlbum, EditableTrack } from '@core/albumDraft'
import {
  markEdited,
  wasEditedByUser,
  emptyManualTrack,
  renumberTracks
} from '@core/albumDraft'
import {
  PHYSICAL_FORMATS,
  getFormat,
  sideOptionsFor,
  defaultSideFor
} from '@core/models/formats'
import { CONDITIONS, conditionLabel } from '@core/models/condition'
import type { ConditionId } from '@core/models/condition'
import TrackDetail from './TrackDetail'
import AddToSetlistButton from './AddToSetlistButton'
import type { SetlistUsage } from '@core/database/db'
import { DEFAULT_FEATURES, type FeatureFlags } from '@core/models/features'
import { useDominantColor, tintStyle } from '../theme/useDominantColor'

interface AlbumReviewProps {
  album: EditableAlbum
  onChange: (album: EditableAlbum) => void
  youtubeConfigured: boolean
  onOpenSettings: () => void
  onBack: () => void
  onStartOver: () => void
  onSave?: () => void
  savedMode?: boolean
  onDelete?: () => void
  onUpdate?: (album: EditableAlbum) => void
  /** Id en la base de datos. Solo lo tienen los álbumes ya guardados. */
  albumId?: number
  /** Qué funciones están encendidas. Solo afecta lo que se muestra. */
  features?: FeatureFlags
  /** Colección activa, para que el botón "+" ofrezca los setlists correctos. */
  collectionId?: number
  /**
   * Texto del botón de volver antes de guardar. Se cambia porque desde un
   * álbum manual no se vuelve a una lista de ediciones sino al formulario.
   */
  backLabel?: string
}

function groupBySide(tracks: EditableTrack[]): Array<[string, EditableTrack[]]> {
  const groups = new Map<string, EditableTrack[]>()
  for (const track of tracks) {
    const existing = groups.get(track.side)
    if (existing) existing.push(track)
    else groups.set(track.side, [track])
  }
  return [...groups.entries()]
}

function sideHeading(side: string, usesSides: boolean): string | null {
  if (side === 'N/A') return null
  return usesSides ? `Lado ${side}` : `Disco ${side}`
}

function AlbumReview({
  album,
  onChange,
  youtubeConfigured,
  onOpenSettings,
  onBack,
  onStartOver,
  onSave,
  savedMode,
  onDelete,
  onUpdate,
  albumId,
  features = DEFAULT_FEATURES,
  collectionId,
  backLabel = 'Elegir otra edición'
}: AlbumReviewProps) {
  const [editingSaved, setEditingSaved] = useState(false)
  const [workingCopy, setWorkingCopy] = useState<EditableAlbum>(album)

  useEffect(() => {
    setWorkingCopy(album)
  }, [album])

  const active = editingSaved ? workingCopy : album
  const canEdit = editingSaved || !savedMode

  /*
    Solo el álbum cargado a mano deja agregar y quitar canciones. En uno traído
    de MusicBrainz el tracklist es el de la edición elegida, y tocarlo sería
    apartarse de la edición que la persona dijo tener.
  */
  const isManualAlbum = active.source === 'manual'
  const canEditTracks = isManualAlbum && canEdit

  function handleChange(updated: EditableAlbum) {
    if (editingSaved) {
      setWorkingCopy(updated)
    } else {
      onChange(updated)
    }
  }

  function startEditingSaved() {
    setWorkingCopy({
      ...album,
      tracks: album.tracks.map((t) => ({ ...t, credits: [...t.credits] }))
    })
    setEditingSaved(true)
  }

  function cancelEditingSaved() {
    setEditingSaved(false)
    setEditingAlbum(false)
    setWorkingCopy(album)
  }

  function saveEditedSaved() {
    if (onUpdate) onUpdate(workingCopy)
    setEditingSaved(false)
    setEditingAlbum(false)
  }

  const format = getFormat(active.format)
  const usesSides = format?.usesSides ?? false
  const groups = groupBySide(active.tracks)

  const [editingAlbum, setEditingAlbum] = useState(false)
  const [form, setForm] = useState<EditableAlbum>(active)
  const [openTrack, setOpenTrack] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** Índice de la canción que está esperando confirmación para ser quitada. */
  const [confirmRemoveTrack, setConfirmRemoveTrack] = useState<number | null>(null)
  const [setlistWarning, setSetlistWarning] = useState<SetlistUsage | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [problem, setProblem] = useState<Record<string, string>>({})

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  function updateForm(field: keyof EditableAlbum, value: unknown) {
    setForm((current) => ({
      ...current,
      [field]: value,
      userEditedFields: markEdited(current.userEditedFields, field)
    }))
  }

  function saveAlbumEdits() {
    handleChange(form)
    setEditingAlbum(false)
  }

  /**
   * Antes de confirmar el borrado se consulta si alguna canción del disco está
   * en un setlist, para poder avisarlo en el mismo mensaje de confirmación.
   */
  async function askDelete() {
    setConfirmDelete(true)
    if (albumId === undefined) return

    const result = await window.api.setlistUsageForAlbum(albumId)
    if (result.ok && result.data.trackCount > 0) setSetlistWarning(result.data)
  }

  function updateTrack(index: number, track: EditableTrack) {
    const tracks = active.tracks.map((existing, i) => (i === index ? track : existing))
    // En un álbum manual se puede cambiar el lado de una canción, y eso cambia
    // su numeración dentro de ese lado.
    handleChange({ ...active, tracks: canEditTracks ? renumberTracks(tracks) : tracks })
  }

  /**
   * Agrega una canción en blanco y abre su detalle para escribirla.
   *
   * Nace sin `id`, que es la señal de "esta fila todavía no existe en la base";
   * al guardar, `syncTracks` la inserta en vez de pisar otra.
   */
  function addTrack() {
    const lastSide = active.tracks[active.tracks.length - 1]?.side
    const side = lastSide ?? defaultSideFor(active.format)
    const tracks = renumberTracks([
      ...active.tracks,
      emptyManualTrack(0, side, active.artists)
    ])

    handleChange({ ...active, tracks })
    setOpenTrack(tracks.length - 1)
  }

  /**
   * Quita una canción del disco.
   *
   * En un disco ya guardado se pide confirmación, porque `setlist_tracks` cuelga
   * de `tracks` con borrado en cascada: la canción también desaparece de todos
   * los setlists donde esté. Antes de guardar no hace falta preguntar nada —
   * todavía no existe en la base y no puede estar en ninguna lista.
   */
  function removeTrack(index: number) {
    if (savedMode && confirmRemoveTrack !== index) {
      setConfirmRemoveTrack(index)
      return
    }

    setConfirmRemoveTrack(null)
    handleChange({
      ...active,
      tracks: renumberTracks(active.tracks.filter((_, i) => i !== index))
    })
  }

  async function handlePlay(track: EditableTrack, key: string) {
    if (playingKey === key) {
      audioRef.current?.pause()
      setPlayingKey(null)
      return
    }

    audioRef.current?.pause()
    if (!track.deezer) return

    setBusyKey(key)
    setProblem((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })

    const result = await window.api.getPreviewUrl(track.deezer.trackId)
    setBusyKey(null)

    if (!result.ok || !result.data) {
      setProblem((current) => ({
        ...current,
        [key]: result.ok ? 'Deezer ya no ofrece adelanto de esta canción.' : result.error
      }))
      return
    }

    const audio = new Audio(result.data)
    audio.addEventListener('ended', () => setPlayingKey(null))
    audio.addEventListener('error', () => {
      setProblem((current) => ({ ...current, [key]: 'No se pudo reproducir el adelanto.' }))
      setPlayingKey(null)
    })

    audioRef.current = audio
    try {
      await audio.play()
      setPlayingKey(key)
    } catch {
      setProblem((current) => ({ ...current, [key]: 'No se pudo reproducir el adelanto.' }))
    }
  }

  const withPreview = active.tracks.filter((track) => track.deezer).length
  const openTrackData = openTrack !== null ? active.tracks[openTrack] : null

  function editedMark(field: string) {
    if (!wasEditedByUser(active.userEditedFields, field)) return null
    return (
      <span className="edited-mark" title="Editado por ti">
        ✎
      </span>
    )
  }

  /** Línea bajo el título de la canción. Se arma según lo que esté encendido. */
  function trackSubtitle(track: EditableTrack): string {
    const parts: string[] = []
    if (features.credits) {
      parts.push(
        track.credits.length > 0 ? `${track.credits.length} créditos` : 'Sin créditos'
      )
    }
    if (track.userEditedFields.length > 0) parts.push('editada por ti')
    return parts.join(' · ')
  }

  const coverToShow = active.userCoverFront ?? active.canonicalCover

  /*
    La pantalla se tiñe con el color dominante de la portada, como en Apple
    Music: cada disco se siente distinto sin haber diseñado una pantalla para
    cada uno. Sin portada no pasa nada y quedan los colores del tema.
  */
  const dominant = useDominantColor(coverToShow)

  return (
    <div className="preview tinted" style={tintStyle(dominant)}>
      <header className="preview-header">
        <div className="cover-slot">
          {coverToShow ? (
            <img
              className="cover-image"
              src={coverToShow}
              alt={`Portada de ${active.title}`}
            />
          ) : (
            <div className="cover-missing">
              <span>Sin portada</span>
              <span>en el catálogo</span>
            </div>
          )}
        </div>
        <div className="preview-titles">
          <h2>
            {active.title}
            {editedMark('title')}
          </h2>
          <p className="preview-artist">
            {active.artists}
            {editedMark('artists')}
          </p>
          {isManualAlbum && (
            <p className="manual-badge" title="Este disco no salió de ningún catálogo">
              ✎ Cargado a mano
            </p>
          )}
          {features.artistLinks && active.artistLinks.length > 0 && (
            <div className="artist-links">
              {active.artistLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">{link.icon}</span> {link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {savedMode && active.userCoverBack && (
        <section className="review-block user-photos">
          <h3 className="section-title">Tu contraportada</h3>
          <img
            className="user-photo-back"
            src={active.userCoverBack}
            alt="Contraportada de tu copia"
          />
        </section>
      )}

      <section className="review-block">
        <div className="review-block-head">
          <h3 className="section-title">Datos del álbum</h3>
          {canEdit && !editingAlbum && (
            <button
              className="btn-link"
              onClick={() => {
                setForm(active)
                setEditingAlbum(true)
              }}
            >
              ✎ Corregir
            </button>
          )}
        </div>

        {editingAlbum ? (
          <>
            <div className="edit-grid">
              <div className="field field-wide">
                <span className="field-label">Formato</span>
                <div className="format-options" role="radiogroup" aria-label="Formato físico">
                  {PHYSICAL_FORMATS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={form.format === option.id}
                      className={`format-chip${form.format === option.id ? ' selected' : ''}`}
                      onClick={() => updateForm('format', option.id)}
                    >
                      <span className="format-icon">{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span className="field-label">Título</span>
                <input
                  value={form.title}
                  spellCheck={false}
                  onChange={(event) => updateForm('title', event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Artista</span>
                <input
                  value={form.artists}
                  spellCheck={false}
                  onChange={(event) => updateForm('artists', event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Año</span>
                <input
                  value={form.year ?? ''}
                  placeholder="1990"
                  spellCheck={false}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10)
                    updateForm('year', Number.isFinite(parsed) ? parsed : null)
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label">Sello</span>
                <input
                  value={form.label ?? ''}
                  spellCheck={false}
                  onChange={(event) => updateForm('label', event.target.value || null)}
                />
              </label>
              <label className="field field-wide">
                <span className="field-label">Géneros (separados por coma)</span>
                <input
                  value={form.genres.join(', ')}
                  spellCheck={false}
                  onChange={(event) =>
                    updateForm(
                      'genres',
                      event.target.value
                        .split(',')
                        .map((genre) => genre.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </label>
              <label className="field field-wide">
                <span className="field-label">Reseña</span>
                <textarea
                  rows={5}
                  value={form.description ?? ''}
                  spellCheck
                  onChange={(event) => updateForm('description', event.target.value || null)}
                />
              </label>
            </div>
            <div className="edit-actions">
              <button className="btn btn-ghost" onClick={() => setEditingAlbum(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveAlbumEdits}>
                Aplicar
              </button>
            </div>
          </>
        ) : (
          <dl className="preview-facts">
            <div>
              <dt>Año</dt>
              <dd>
                {active.year ?? 'Sin dato'}
                {editedMark('year')}
              </dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>
                {format?.label ?? active.format}
                {editedMark('format')}
              </dd>
            </div>
            <div>
              <dt>Sello</dt>
              <dd>
                {active.label ?? 'Sin dato'}
                {editedMark('label')}
              </dd>
            </div>
            <div>
              <dt>Género</dt>
              <dd>
                {active.genres.length > 0 ? active.genres.join(', ') : 'Sin dato'}
                {editedMark('genres')}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {features.review && active.description && !editingAlbum && (
        <section className="excerpt">
          <h3 className="section-title">Sobre el álbum</h3>
          <p className="excerpt-text">{active.description}</p>
          {active.descriptionSource && active.descriptionUrl ? (
            <p className="excerpt-source">
              Fuente: {active.descriptionSource} ·{' '}
              <a href={active.descriptionUrl} target="_blank" rel="noreferrer">
                Ver artículo completo
              </a>
            </p>
          ) : (
            <p className="excerpt-source">Escrito por ti</p>
          )}
        </section>
      )}

      <section className="tracklist">
        <h3 className="section-title">Tracklist ({active.tracks.length})</h3>

        <p className="tracklist-note">
          {features.playback && (
            <>
              {withPreview > 0
                ? `Puedes escuchar 30 segundos de ${withPreview} de las ${active.tracks.length} canciones, cortesía de Deezer.`
                : 'Deezer no tiene adelantos de las canciones de este álbum.'}{' '}
            </>
          )}
          {canEdit &&
            (features.credits
              ? 'Haz clic en una canción para ver sus créditos y corregirlos.'
              : 'Haz clic en una canción para corregir sus datos.')}
          {savedMode &&
            !editingSaved &&
            features.credits &&
            'Haz clic en una canción para ver sus créditos.'}
          {features.playback && !youtubeConfigured && !savedMode && (
            <>
              {' '}
              Si quieres ver el video completo,{' '}
              <button className="btn-link" onClick={onOpenSettings}>
                configura tu clave de YouTube
              </button>
              .
            </>
          )}
        </p>

        {groups.map(([side, sideTracks]) => {
          const heading = sideHeading(side, usesSides)
          return (
            <div className="side-group" key={side}>
              {heading && <h4 className="side-heading">{heading}</h4>}
              <ol className="track-rows">
                {sideTracks.map((track) => {
                  const index = active.tracks.indexOf(track)
                  const key = `${side}-${track.number}-${track.title}`
                  const isPlaying = playingKey === key
                  const isBusy = busyKey === key
                  return (
                    <li className="track-row" key={key}>
                      <span className="track-number">{track.number}</span>

                      <button className="track-main track-open" onClick={() => setOpenTrack(index)}>
                        <span className="track-title">{track.title}</span>
                        {track.artist !== active.artists && (
                          <span className="track-artist">{track.artist}</span>
                        )}
                        <span className="track-credits-count">{trackSubtitle(track)}</span>
                        {problem[key] && <span className="track-problem">{problem[key]}</span>}
                      </button>

                      <span className="track-duration">{track.duration ?? '—'}</span>

                      {features.playback && youtubeConfigured && (
                        <YouTubeLink artist={track.artist} title={track.title} />
                      )}

                      {features.playback && (
                      <button
                        className={`listen-btn${isPlaying ? ' playing' : ''}`}
                        onClick={() => handlePlay(track, key)}
                        disabled={!track.deezer || isBusy}
                        title={
                          track.deezer
                            ? isPlaying
                              ? 'Pausar'
                              : 'Escuchar 30 segundos'
                            : 'Deezer no tiene adelanto de esta canción'
                        }
                      >
                        {isBusy ? '···' : isPlaying ? '❚❚' : '▶'}
                      </button>
                      )}

                      {features.setlists &&
                        savedMode &&
                        track.id !== undefined &&
                        collectionId !== undefined && (
                          <AddToSetlistButton
                            trackId={track.id}
                            collectionId={collectionId}
                          />
                        )}

                      {canEditTracks && (
                        <button
                          className={`icon-btn danger${
                            confirmRemoveTrack === index ? ' confirming' : ''
                          }`}
                          title={
                            confirmRemoveTrack === index
                              ? 'Confirma: si esta canción está en algún setlist, también saldrá de ahí'
                              : 'Quitar esta canción del disco'
                          }
                          onClick={() => removeTrack(index)}
                          onBlur={() => setConfirmRemoveTrack(null)}
                        >
                          {confirmRemoveTrack === index ? '¿Seguro?' : '✕'}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}

        {canEditTracks && (
          <div className="manual-track-tools">
            <button className="btn btn-ghost" onClick={addTrack}>
              + Agregar canción
            </button>
          </div>
        )}
      </section>

      {/* Condition: editable pre-save or when editing saved */}
      {(editingSaved || (!savedMode && onSave)) && (
        <section className="review-block your-copy">
          <h3 className="section-title">Tu copia</h3>
          <p className="setting-description">
            ¿En qué estado está tu disco, casete o CD? Es opcional — si no lo sabes
            ahora, puedes dejarlo sin evaluar.
          </p>
          <div className="condition-options" role="radiogroup" aria-label="Estado de conservación">
            {CONDITIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active.condition === opt.id}
                className={`condition-chip${active.condition === opt.id ? ' selected' : ''}`}
                onClick={() => handleChange({ ...active, condition: opt.id })}
              >
                {opt.label}
              </button>
            ))}
            {active.condition && (
              <button
                type="button"
                className="btn-link"
                onClick={() => handleChange({ ...active, condition: null })}
              >
                Sin evaluar
              </button>
            )}
          </div>
        </section>
      )}

      {/* Condition: read-only when viewing saved */}
      {savedMode && !editingSaved && (
        <section className="review-block">
          <h3 className="section-title">Tu copia</h3>
          <dl className="preview-facts">
            <div>
              <dt>Estado</dt>
              <dd>{conditionLabel(active.condition)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* Notes: editable when editing saved */}
      {editingSaved && (
        <section className="review-block">
          <h3 className="section-title">Tus notas</h3>
          <p className="setting-description">
            Escribe lo que quieras recordar sobre esta copia: dónde la compraste,
            cuánto pagaste, algún detalle especial.
          </p>
          <textarea
            className="notes-textarea"
            rows={4}
            value={active.notes ?? ''}
            placeholder="Ej: Comprado en Feria del Disco, edición original de 1982..."
            spellCheck
            onChange={(e) => handleChange({ ...active, notes: e.target.value || null })}
          />
        </section>
      )}

      {/* Notes: read-only when viewing saved */}
      {savedMode && !editingSaved && active.notes && (
        <section className="review-block">
          <h3 className="section-title">Tus notas</h3>
          <p className="notes-text">{active.notes}</p>
        </section>
      )}

      <footer className="preview-footer">
        {savedMode && editingSaved ? (
          <>
            <button className="btn btn-ghost" onClick={cancelEditingSaved}>
              Cancelar edición
            </button>
            <button className="btn btn-primary" onClick={saveEditedSaved}>
              Guardar cambios
            </button>
          </>
        ) : savedMode ? (
          <>
            <button className="btn btn-ghost" onClick={onBack}>
              Volver a la colección
            </button>
            <button className="btn btn-ghost" onClick={startEditingSaved}>
              ✎ Editar
            </button>
            {!confirmDelete ? (
              <button className="btn btn-danger" onClick={askDelete}>
                Borrar de mi colección
              </button>
            ) : (
              <div className="confirm-delete">
                <span>
                  {setlistWarning && setlistWarning.trackCount > 0 ? (
                    <>
                      Ojo: {setlistWarning.trackCount === 1
                        ? 'una canción de este disco está'
                        : `${setlistWarning.trackCount} canciones de este disco están`}{' '}
                      en {setlistWarning.setlistNames.length === 1 ? 'el setlist' : 'los setlists'}{' '}
                      <strong>{setlistWarning.setlistNames.join(', ')}</strong>. Si lo borras,
                      también {setlistWarning.trackCount === 1 ? 'saldrá' : 'saldrán'} de ahí.
                    </>
                  ) : (
                    '¿Seguro que quieres borrarlo?'
                  )}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setConfirmDelete(false)
                    setSetlistWarning(null)
                  }}
                >
                  No
                </button>
                <button className="btn btn-danger" onClick={onDelete}>
                  Sí, borrar
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onBack}>
              {backLabel}
            </button>
            {onSave ? (
              <button className="btn btn-primary" onClick={onSave}>
                Guardar en mi colección
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onStartOver}>
                Empezar de nuevo
              </button>
            )}
          </>
        )}
      </footer>

      {openTrackData && openTrack !== null && (
        <TrackDetail
          track={openTrackData}
          albumArtist={active.artists}
          sideLabel={sideHeading(openTrackData.side, usesSides)}
          onChange={(updated) => updateTrack(openTrack, updated)}
          onClose={() => setOpenTrack(null)}
          readOnly={savedMode && !editingSaved}
          showCredits={features.credits}
          sideOptions={canEditTracks ? sideOptionsFor(active.format) : undefined}
        />
      )}
    </div>
  )
}

function YouTubeLink({ artist, title }: { artist: string; title: string }) {
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    const result = await window.api.searchTrackVideo(artist, title)
    setBusy(false)
    if (result.ok && result.data) window.open(result.data.url, '_blank')
  }

  return (
    <button className="youtube-btn" onClick={open} disabled={busy} title="Ver el video en YouTube">
      {busy ? '···' : 'YT'}
    </button>
  )
}

export default AlbumReview
