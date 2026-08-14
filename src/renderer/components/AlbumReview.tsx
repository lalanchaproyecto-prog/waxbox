import { useEffect, useState } from 'react'
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
import { hasPurchase, formatPurchaseDate, EMPTY_PURCHASE } from '@core/models/purchase'
import TrackDetail from './TrackDetail'
import AddToSetlistButton from './AddToSetlistButton'
import { IconBack } from './Icons'
import VariantsSection from './VariantsSection'
import LoansSection from './LoansSection'
import type { SetlistUsage, DuplicateCandidate } from '@core/database/db'
import { DEFAULT_FEATURES, type FeatureFlags } from '@core/models/features'
import { useDominantColor, tintStyle } from '../theme/useDominantColor'
import { usePlayer } from '../player/PlayerProvider'
import type { PlayableTrack } from '@core/player/queue'

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
  /**
   * Vuelve a leer el disco de la base. Se llama después de asociar archivos de
   * audio, que se guardan aparte de la ficha y no llegan por `onChange`.
   */
  onReload?: () => void
  /** Etiquetas que ya existen en la colección, para reusarlas escritas igual. */
  knownTags?: string[]
  /** Navega a otro disco. Lo usan las variantes para ir a la copia hermana. */
  onOpenAlbum?: (albumId: number) => void
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
  backLabel = 'Elegir otra edición',
  onReload,
  knownTags = [],
  onOpenAlbum
}: AlbumReviewProps) {
  /*
    EDITAR ES UN DIÁLOGO, NO UN MODO DE LA PANTALLA.

    Antes, pulsar "Editar" convertía la ficha entera en un formulario: la
    portada seguía ahí pero debajo aparecían de golpe los campos del álbum,
    los del estado, los de la compra, las notas y el editor de etiquetas,
    todo a la vez y mezclado con lo que solo se lee. Encontrar el campo que
    ibas a cambiar costaba más que el cambio en sí.

    Ahora la ficha se lee siempre igual y editar abre un diálogo con los
    campos agrupados como en la pantalla: primero los datos del catálogo,
    después los tuyos.
  */
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditableAlbum>(album)

  /*
    Editar el tracklist SÍ se queda en la página: agregar, quitar y reordenar
    canciones se hace sobre la lista misma, y meterla en un diálogo obligaría
    a mirarla dos veces. Solo aplica a los discos cargados a mano — en uno
    traído de MusicBrainz el tracklist es el de la edición elegida, y tocarlo
    sería apartarse de la edición que la persona dijo tener.
  */
  const [editingTracks, setEditingTracks] = useState(false)
  const [workingCopy, setWorkingCopy] = useState<EditableAlbum>(album)

  useEffect(() => {
    setWorkingCopy(album)
  }, [album])

  const active = editingTracks ? workingCopy : album

  const isManualAlbum = active.source === 'manual'
  const canEditTracks = isManualAlbum && (editingTracks || !savedMode)

  function handleChange(updated: EditableAlbum) {
    if (editingTracks) {
      setWorkingCopy(updated)
    } else {
      onChange(updated)
    }
  }

  /** Abre el diálogo de edición con una copia de lo que hay ahora. */
  function openEditor() {
    setForm({
      ...active,
      tracks: active.tracks.map((t) => ({ ...t, credits: [...t.credits] }))
    })
    setEditing(true)
  }

  /**
   * Guarda lo del diálogo.
   *
   * En un disco ya guardado escribe directo en la base; en uno que todavía
   * se está revisando, actualiza el borrador que se guardará al final.
   */
  function applyEditor() {
    if (savedMode) {
      if (onUpdate) onUpdate(form)
    } else {
      onChange(form)
    }
    setEditing(false)
  }

  function startEditingTracks() {
    setWorkingCopy({
      ...album,
      tracks: album.tracks.map((t) => ({ ...t, credits: [...t.credits] }))
    })
    setEditingTracks(true)
  }

  function cancelEditingTracks() {
    setEditingTracks(false)
    setWorkingCopy(album)
  }

  function saveEditedTracks() {
    if (onUpdate) onUpdate(workingCopy)
    setEditingTracks(false)
  }

  const format = getFormat(active.format)
  const usesSides = format?.usesSides ?? false
  const groups = groupBySide(active.tracks)

  const [openTrack, setOpenTrack] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** Índice de la canción que está esperando confirmación para ser quitada. */
  const [confirmRemoveTrack, setConfirmRemoveTrack] = useState<number | null>(null)
  const [setlistWarning, setSetlistWarning] = useState<SetlistUsage | null>(null)

  /*
    La reproducción dejó de vivir aquí: ahora la lleva el reproductor global,
    que no se desmonta al cambiar de pantalla. Esta ficha solo le entrega el
    álbum como cola y le dice por cuál canción empezar.
  */
  const player = usePlayer()
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioNote, setAudioNote] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])

  useEffect(() => {
    if (savedMode || !collectionId) return
    window.api
      .findPossibleDuplicates(collectionId, active.artists, active.title)
      .then((result) => {
        if (result.ok) setDuplicates(result.data)
      })
  }, [active.artists, active.title, collectionId, savedMode])

  function updateForm(field: keyof EditableAlbum, value: unknown) {
    setForm((current) => ({
      ...current,
      [field]: value,
      userEditedFields: markEdited(current.userEditedFields, field)
    }))
  }

  /** Cambia un campo del diálogo que no es del catálogo, sin marcarlo como corregido. */
  function updateMine<K extends keyof EditableAlbum>(field: K, value: EditableAlbum[K]) {
    setForm((current) => ({ ...current, [field]: value }))
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

  const coverToShow = active.userCoverFront ?? active.canonicalCover

  /** Convierte el tracklist en la cola que entiende el reproductor. */
  function buildQueue(): PlayableTrack[] {
    return active.tracks
      .filter((track) => track.id !== undefined)
      .map((track) => ({
        trackId: track.id!,
        title: track.title,
        artist: track.artist,
        albumTitle: active.title,
        cover: coverToShow,
        file: track.file ?? null,
        deezer: track.deezer
      }))
  }

  /** Pone a sonar el álbum entero, empezando por la canción elegida. */
  function playFrom(track: EditableTrack) {
    const queue = buildQueue()
    const start = queue.findIndex((item) => item.trackId === track.id)
    player.play(queue, start >= 0 ? start : 0)
  }

  /**
   * Asocia archivos de audio propios a las canciones de este disco.
   *
   * Se eligen todos de una vez y se reparten por nombre de archivo: hacerlo
   * canción por canción sería abrir el diálogo doce veces.
   */
  async function addAudioFiles() {
    if (albumId === undefined) return

    setAudioBusy(true)
    setAudioNote(null)

    const result = await window.api.pickAudioForAlbum(
      active.tracks
        .filter((track) => track.id !== undefined)
        .map((track) => ({ trackId: track.id!, title: track.title }))
    )

    setAudioBusy(false)

    if (!result.ok) {
      setAudioNote(result.error)
      return
    }

    const { linked, unmatched } = result.data

    if (linked === 0 && unmatched.length === 0) return // canceló el diálogo

    const partes = [
      linked === 1
        ? 'Se asoció 1 archivo.'
        : `Se asociaron ${linked} archivos.`
    ]
    if (unmatched.length > 0) {
      partes.push(
        unmatched.length === 1
          ? `Uno no coincidió con ninguna canción: ${unmatched[0]}.`
          : `${unmatched.length} no coincidieron con ninguna canción.`
      )
    }
    setAudioNote(partes.join(' '))

    // Hay que recargar el disco para ver los archivos recién asociados.
    if (onReload) onReload()
  }

  const conArchivo = active.tracks.filter((track) => track.file && !track.file.missing).length
  const conDeezer = active.tracks.filter((track) => track.deezer).length
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

  /*
    La pantalla se tiñe con el color dominante de la portada, como en Apple
    Music: cada disco se siente distinto sin haber diseñado una pantalla para
    cada uno. Sin portada no pasa nada y quedan los colores del tema.
  */
  const dominant = useDominantColor(coverToShow)

  /*
    ¿Está sonando ESTE disco ahora mismo?

    Es lo que hace que el disco de la ficha gire y el brazo baje. El
    movimiento no es adorno: es la única señal de que lo que suena es este
    disco y no otro que quedó puesto desde antes.
  */
  const sonandoEsteAlbum =
    player.current !== null &&
    active.tracks.some(
      (track) => track.id !== undefined && track.id === player.current?.trackId
    )

  return (
    <div className="screen ficha tinted" style={tintStyle(dominant)}>
      {savedMode && (
        <button className="page-back" onClick={onBack}>
          <IconBack size={16} />
          <span>Colección</span>
        </button>
      )}

      <header className="ficha-hero">
        {/*
          EL OBJETO. La portada dentro de su funda, con el disco asomando por
          detrás. Es el único sitio de la app con volumen y movimiento, y aquí
          se lo gana: la ficha describe una cosa que existe y está en un
          estante.
        */}
        <div className={`ficha-object${sonandoEsteAlbum ? ' sonando' : ''}`}>
          <div className="ficha-sleeve">
            {format?.id !== 'casete' && (
              <span className="ficha-disc-wrap" aria-hidden="true">
                <span
                  className={`disc${format?.id === 'cd' ? ' disc-cd' : ''}${
                    sonandoEsteAlbum ? ' disc-spinning' : ''
                  }`}
                />
                {/*
                  El brazo solo existe mientras suena. Un brazo apoyado sobre
                  un disco que está a medias dentro de su funda no es una
                  imagen de nada: el disco guardado no tiene brazo encima.
                */}
                {sonandoEsteAlbum && <span className="tonearm tonearm-down" />}
              </span>
            )}

            {coverToShow ? (
              <img
                className="ficha-cover"
                src={coverToShow}
                alt={`Portada de ${active.title}`}
              />
            ) : (
              <div className="ficha-cover ficha-cover-missing">
                <span>Sin portada</span>
              </div>
            )}
          </div>
        </div>

        {/*
          LA FICHA DEL CATÁLOGO. Lo que dicen las fuentes públicas sobre este
          álbum: título, artista, año, formato, sello, géneros. Los datos van
          en la mono, como en una ficha impresa.
        */}
        <div className="ficha-identity">
          <h2 className="ficha-title">
            {active.title}
            {editedMark('title')}
          </h2>
          <p className="ficha-artist">
            {active.artists}
            {editedMark('artists')}
          </p>

          <dl className="ficha-facts">
            <div className="ficha-fact">
              <dt>Año</dt>
              <dd className="numeric">
                {active.year ?? '—'}
                {editedMark('year')}
              </dd>
            </div>
            <div className="ficha-fact">
              <dt>Formato</dt>
              <dd className="numeric">
                {format?.label ?? active.format}
                {editedMark('format')}
              </dd>
            </div>
            <div className="ficha-fact">
              <dt>Sello</dt>
              <dd className="numeric">
                {active.label ?? '—'}
                {editedMark('label')}
              </dd>
            </div>
            <div className="ficha-fact">
              <dt>Canciones</dt>
              <dd className="numeric">{active.tracks.length}</dd>
            </div>
            <div className="ficha-fact ficha-fact-wide">
              <dt>Género</dt>
              <dd className="numeric">
                {active.genres.length > 0 ? active.genres.join(' · ') : '—'}
                {editedMark('genres')}
              </dd>
            </div>
          </dl>

          <div className="ficha-hero-meta">
            {isManualAlbum && (
              <span className="manual-badge" title="Este disco no salió de ningún catálogo">
                Cargado a mano
              </span>
            )}
            <button className="btn-link" onClick={openEditor}>
              Corregir estos datos
            </button>
          </div>

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

      {/*
        EL DIÁLOGO DE EDICIÓN.

        Los campos van agrupados igual que la pantalla: primero lo que dice
        el catálogo, después lo tuyo. Es la misma distinción que organiza la
        ficha, así que quien la entendió leyendo ya sabe dónde buscar.
      */}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div
            className="modal editor-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={`Editar ${active.title}`}
          >
            <header className="modal-header">
              <div>
                <h2>Editar la ficha</h2>
                <p className="modal-subtitle">{active.title}</p>
              </div>
              <button className="modal-close" onClick={() => setEditing(false)} title="Cerrar">
                ✕
              </button>
            </header>

            <section className="editor-group">
              <h3 className="editor-group-title">Datos del álbum</h3>
              <p className="setting-description">
                Lo que dicen los catálogos. Corrígelo si tu edición no coincide.
              </p>
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
            </section>

            <section className="editor-group">
              <h3 className="editor-group-title">Tu copia</h3>
              <p className="setting-description">
                Lo que solo tú sabes de este disco. Todo es opcional.
              </p>

              <div className="field">
                <span className="field-label">Estado de conservación</span>
                <div
                  className="condition-options"
                  role="radiogroup"
                  aria-label="Estado de conservación"
                >
                  {CONDITIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={form.condition === opt.id}
                      className={`condition-chip${form.condition === opt.id ? ' selected' : ''}`}
                      onClick={() => updateMine('condition', opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {form.condition && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => updateMine('condition', null)}
                    >
                      Sin evaluar
                    </button>
                  )}
                </div>
              </div>

              <div className="edit-grid">
                <label className="field">
                  <span className="field-label">Dónde la conseguiste</span>
                  <input
                    value={form.purchase.place ?? ''}
                    placeholder="Ej: Feria del Disco"
                    spellCheck={false}
                    onChange={(e) =>
                      updateMine('purchase', {
                        ...form.purchase,
                        place: e.target.value || null
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Cuándo</span>
                  <input
                    type="date"
                    value={form.purchase.date ?? ''}
                    onChange={(e) =>
                      updateMine('purchase', {
                        ...form.purchase,
                        date: e.target.value || null
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Cuánto pagaste</span>
                  <input
                    value={form.purchase.price ?? ''}
                    placeholder="Ej: $12.000, me lo regalaron"
                    spellCheck={false}
                    onChange={(e) =>
                      updateMine('purchase', {
                        ...form.purchase,
                        price: e.target.value || null
                      })
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span className="field-label">Tus notas</span>
                  <textarea
                    className="notes-textarea"
                    rows={3}
                    value={form.notes ?? ''}
                    placeholder="Ej: edición original de 1982, la encontré en Valparaíso"
                    spellCheck
                    onChange={(e) => updateMine('notes', e.target.value || null)}
                  />
                </label>
                <div className="field field-wide">
                  <span className="field-label">Tus etiquetas</span>
                  <TagEditor
                    tags={form.tags}
                    suggestions={knownTags}
                    onChange={(tags) => updateMine('tags', tags)}
                  />
                </div>
              </div>
            </section>

            <footer className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={applyEditor}>
                Guardar cambios
              </button>
            </footer>
          </div>
        </div>
      )}

      <div className="ficha-body">
        <div className="ficha-main">

      {features.review && active.description && (
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
        <div className="tracklist-head">
          <h3 className="section-title">Tracklist ({active.tracks.length})</h3>

          {/*
            Agregar y quitar canciones se hace sobre la lista, no en un
            diálogo: es la lista misma lo que se está reordenando. Solo
            aparece en los discos cargados a mano.
          */}
          {savedMode && isManualAlbum && !editingTracks && (
            <button className="btn-link" onClick={startEditingTracks}>
              Editar las canciones
            </button>
          )}
          {editingTracks && (
            <div className="tracklist-edit-actions">
              <button className="btn btn-ghost btn-sm" onClick={cancelEditingTracks}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveEditedTracks}>
                Guardar canciones
              </button>
            </div>
          )}
        </div>

        <p className="tracklist-note">
          {canEditTracks
            ? 'Haz clic en una canción para corregir sus datos.'
            : features.credits
              ? 'Haz clic en una canción para ver sus créditos.'
              : 'Haz clic en una canción para ver sus datos.'}
        </p>

        {/*
          De dónde va a sonar este disco.

          El orden del texto es el mismo que usa el reproductor para decidir:
          primero tus archivos, después Deezer, y YouTube al final.
        */}
        {features.playback && savedMode && (
          <div className="audio-sources">
            <p className="tracklist-note">
              {conArchivo > 0 && (
                <strong>
                  {conArchivo === active.tracks.length
                    ? 'Tienes el audio de todas las canciones. '
                    : `Tienes el audio de ${conArchivo} de ${active.tracks.length} canciones. `}
                </strong>
              )}
              {conDeezer > 0
                ? `Deezer tiene adelanto de 30 segundos de ${conDeezer}.`
                : 'Deezer no tiene adelantos de este álbum.'}
              {!youtubeConfigured && conArchivo < active.tracks.length && (
                <>
                  {' '}
                  Si además{' '}
                  <button className="btn-link" onClick={onOpenSettings}>
                    configuras tu clave de YouTube
                  </button>
                  , se puede buscar allí lo que falte.
                </>
              )}
            </p>

            <div className="audio-actions">
              <button
                className="btn btn-ghost"
                onClick={addAudioFiles}
                disabled={audioBusy}
                title="Elige los archivos de este disco; se reparten solos por el nombre"
              >
                {audioBusy ? 'Eligiendo...' : '♪ Agregar mis archivos de audio'}
              </button>

              {active.tracks.some((t) => t.id !== undefined) && (
                <button
                  className="btn btn-ghost"
                  onClick={() => player.play(buildQueue(), 0)}
                  title="Escuchar el disco entero desde el principio"
                >
                  ▶ Reproducir el disco
                </button>
              )}
            </div>

            {audioNote && <p className="section-note">{audioNote}</p>}

            {active.tracks.some((t) => t.file?.missing) && (
              <p className="feedback-error">
                Algún archivo ya no está en la carpeta donde lo agregaste. Si moviste tu
                música, vuelve a agregarlo.
              </p>
            )}
          </div>
        )}

        {groups.map(([side, sideTracks]) => {
          const heading = sideHeading(side, usesSides)
          return (
            <div className="side-group" key={side}>
              {heading && <h4 className="side-heading">{heading}</h4>}
              <ol className="track-rows">
                {sideTracks.map((track) => {
                  const index = active.tracks.indexOf(track)
                  const key = `${side}-${track.number}-${track.title}`
                  // La canción que está sonando ahora mismo, según el
                  // reproductor global.
                  const sonando =
                    player.current !== null &&
                    track.id !== undefined &&
                    player.current.trackId === track.id
                  return (
                    <li className={`track-row${sonando ? ' sonando' : ''}`} key={key}>
                      <span className="track-number">{track.number}</span>

                      <button className="track-main track-open" onClick={() => setOpenTrack(index)}>
                        <span className="track-title">{track.title}</span>
                        {track.artist !== active.artists && (
                          <span className="track-artist">{track.artist}</span>
                        )}
                        <span className="track-credits-count">{trackSubtitle(track)}</span>
                      </button>

                      <span className="track-duration numeric">{track.duration ?? '—'}</span>

                      {/*
                        Reproducir carga el ÁLBUM ENTERO en el reproductor y
                        empieza por esta canción, no suelta una canción sola:
                        al terminar sigue la que viene, como en cualquier
                        reproductor.
                      */}
                      {features.playback && savedMode && track.id !== undefined && (
                        <button
                          className={`listen-btn${sonando && player.playing ? ' playing' : ''}`}
                          onClick={() => (sonando ? player.toggle() : playFrom(track))}
                          title={
                            sonando && player.playing
                              ? 'Pausar'
                              : track.file && !track.file.missing
                                ? 'Reproducir tu archivo'
                                : track.deezer
                                  ? 'Reproducir el adelanto de Deezer'
                                  : youtubeConfigured
                                    ? 'Buscar en YouTube y reproducir'
                                    : 'Sin ninguna fuente para escuchar esta canción'
                          }
                        >
                          {sonando && player.playing ? '❚❚' : '▶'}
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
        </div>

        {/*
          ===================================================================
          TU COPIA — el elemento firma de Waxbox.

          Todo lo que esta app sabe y ningún catálogo público sabe: en qué
          estado está TU disco, dónde lo compraste, a quién se lo prestaste,
          qué anotaste, cómo lo etiquetaste, qué otras copias tienes.

          Antes esto estaba repartido en cinco secciones sueltas ("Tu copia",
          "Tus notas", "Tus etiquetas", variantes, préstamos) intercaladas
          entre los datos del catálogo y con exactamente la misma pinta que
          ellos. Nunca quedaba claro qué había escrito la persona y qué venía
          de MusicBrainz.

          Ahora es un solo panel hundido, con los rótulos en la mono y el
          azul del acento. La regla, aplicable a toda la app: lo tuyo va aquí
          dentro; lo del catálogo, fuera.
          ===================================================================
        */}
        <aside className="ficha-aside">
          <div className="ficha-aside-head">
            <h3 className="ficha-aside-title">Tu copia</h3>
            <button className="btn-link" onClick={openEditor}>
              Editar
            </button>
          </div>

          {savedMode && active.userCoverBack && (
            <section className="mine-block">
              <h4 className="mine-title">Tu contraportada</h4>
              <img
                className="user-photo-back"
                src={active.userCoverBack}
                alt="Contraportada de tu copia"
              />
            </section>
          )}

      {/*
        Todo lo tuyo, siempre de solo lectura aquí. Editar abre el diálogo.
      */}
      <section className="mine-block">
        <h4 className="mine-title">Estado y compra</h4>
        <dl className="mine-facts">
          <div>
            <dt>Estado</dt>
            <dd>{conditionLabel(active.condition)}</dd>
          </div>
          {active.purchase.place && (
            <div>
              <dt>Comprada en</dt>
              <dd>{active.purchase.place}</dd>
            </div>
          )}
          {active.purchase.date && (
            <div>
              <dt>Fecha de compra</dt>
              <dd>{formatPurchaseDate(active.purchase.date) ?? active.purchase.date}</dd>
            </div>
          )}
          {active.purchase.price && (
            <div>
              <dt>Precio</dt>
              <dd>{active.purchase.price}</dd>
            </div>
          )}
        </dl>
        {!hasPurchase(active.purchase) && (
          <p className="mine-empty">
            Sin registro de compra. Puedes anotar dónde la conseguiste desde «Editar».
          </p>
        )}
      </section>

      {active.notes && (
        <section className="mine-block">
          <h4 className="mine-title">Tus notas</h4>
          <p className="notes-text">{active.notes}</p>
        </section>
      )}

      {/*
        Etiquetas: palabras libres que pone la persona para agrupar sus discos
        como quiera ("regalo", "firmado", "de mi papá"). No vienen de ninguna
        fuente y no se parecen al género: el género describe la música, la
        etiqueta describe la copia.
      */}
      {active.tags.length > 0 && (
        <section className="mine-block">
          <h4 className="mine-title">Tus etiquetas</h4>
          <div className="tag-chips">
            {active.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {savedMode && albumId !== undefined && collectionId !== undefined && onOpenAlbum && (
        <VariantsSection
          albumId={albumId}
          collectionId={collectionId}
          onOpenAlbum={onOpenAlbum}
        />
      )}

      {savedMode && albumId !== undefined && (
        <LoansSection albumId={albumId} />
      )}
        </aside>
      </div>

      <footer className="preview-footer">
        {savedMode ? (
          <>
            {/*
              Volver ya está arriba a la izquierda y Editar está en el panel
              de "Tu copia" y en el encabezado, junto a lo que cada uno
              cambia. Aquí abajo solo queda lo irreversible, separado del
              resto para que no se pulse sin querer.
            */}
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
            {duplicates.length > 0 && (
              <div className="duplicate-warning">
                <p>
                  Ya tienes {duplicates.length === 1 ? 'una copia' : `${duplicates.length} copias`} de
                  este disco:{' '}
                  {duplicates.map((d) => `${getFormat(d.format)?.label ?? d.format}${d.year ? ` (${d.year})` : ''}`).join(', ')}
                  . Puedes guardarlo igual si es otra edición.
                </p>
              </div>
            )}
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
          readOnly={!canEditTracks}
          showCredits={features.credits}
          sideOptions={canEditTracks ? sideOptionsFor(active.format) : undefined}
        />
      )}
    </div>
  )
}

interface TagEditorProps {
  tags: string[]
  /** Etiquetas que ya existen en la colección, para reusarlas escritas igual. */
  suggestions: string[]
  onChange: (tags: string[]) => void
}

/**
 * Escribir y quitar etiquetas.
 *
 * Las sugerencias no son un adorno: el filtro de la colección compara texto
 * exacto, así que "Regalo" y "regalo" serían dos etiquetas distintas y los
 * discos quedarían repartidos entre ambas. Ofrecer las existentes para marcar
 * es lo que mantiene la lista limpia sin obligar a nadie a recordar cómo las
 * escribió la vez anterior.
 */
function TagEditor({ tags, suggestions, onChange }: TagEditorProps) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const tag = raw.trim()
    if (tag.length === 0) return
    // Comparación sin distinguir mayúsculas para no crear casi-duplicados.
    if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...tags, tag])
    setDraft('')
  }

  function remove(tag: string) {
    onChange(tags.filter((item) => item !== tag))
  }

  const sinUsar = suggestions.filter(
    (tag) => !tags.some((item) => item.toLowerCase() === tag.toLowerCase())
  )

  return (
    <div className="tag-editor">
      {tags.length > 0 && (
        <div className="tag-chips">
          {tags.map((tag) => (
            <span className="tag-chip removable" key={tag}>
              {tag}
              <button
                className="tag-chip-remove"
                onClick={() => remove(tag)}
                title={`Quitar "${tag}"`}
                aria-label={`Quitar la etiqueta ${tag}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="tag-input-row">
        <input
          type="text"
          value={draft}
          placeholder="Ej: regalo, firmado, de mi papá"
          spellCheck={false}
          aria-label="Nueva etiqueta"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter y coma agregan: la coma es lo que la gente teclea sin pensar.
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add(draft)
            }
          }}
        />
        <button className="btn btn-ghost" onClick={() => add(draft)} disabled={!draft.trim()}>
          Agregar
        </button>
      </div>

      {sinUsar.length > 0 && (
        <div className="tag-suggestions">
          <span className="tag-suggestions-label">Ya usaste:</span>
          {sinUsar.map((tag) => (
            <button key={tag} className="tag-chip suggestion" onClick={() => add(tag)}>
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AlbumReview
