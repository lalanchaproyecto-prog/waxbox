import { useEffect, useRef, useState } from 'react'
import type { EditableAlbum, EditableTrack } from '@core/albumDraft'
import { markEdited, wasEditedByUser } from '@core/albumDraft'
import { getFormat } from '@core/models/formats'
import TrackDetail from './TrackDetail'

interface AlbumReviewProps {
  album: EditableAlbum
  onChange: (album: EditableAlbum) => void
  /** Si hay clave de YouTube configurada. Es un extra, no lo esencial. */
  youtubeConfigured: boolean
  onOpenSettings: () => void
  onBack: () => void
  onStartOver: () => void
}

/** Agrupa las canciones por lado o disco, conservando el orden. */
function groupBySide(tracks: EditableTrack[]): Array<[string, EditableTrack[]]> {
  const groups = new Map<string, EditableTrack[]>()
  for (const track of tracks) {
    const existing = groups.get(track.side)
    if (existing) existing.push(track)
    else groups.set(track.side, [track])
  }
  return [...groups.entries()]
}

/** Título del grupo: "Lado A" en vinilo y casete, "Disco 1" en CD. */
function sideHeading(side: string, usesSides: boolean): string | null {
  if (side === 'N/A') return null
  return usesSides ? `Lado ${side}` : `Disco ${side}`
}

/**
 * Pantalla de revisión: lo último que ve la persona antes de guardar.
 *
 * Todo lo que trajeron las fuentes automáticas se puede corregir aquí, y lo
 * que ella escriba queda marcado como suyo. Corregir es opcional: si los datos
 * están bien, guarda y listo.
 */
function AlbumReview({
  album,
  onChange,
  youtubeConfigured,
  onOpenSettings,
  onBack,
  onStartOver
}: AlbumReviewProps) {
  const format = getFormat(album.format)
  const usesSides = format?.usesSides ?? false
  const groups = groupBySide(album.tracks)

  const [editingAlbum, setEditingAlbum] = useState(false)
  const [form, setForm] = useState<EditableAlbum>(album)
  const [openTrack, setOpenTrack] = useState<number | null>(null)

  // Un solo reproductor para todo el álbum: al darle play a una canción, la
  // anterior se detiene sola.
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
    onChange(form)
    setEditingAlbum(false)
  }

  function updateTrack(index: number, track: EditableTrack) {
    const tracks = album.tracks.map((existing, i) => (i === index ? track : existing))
    onChange({ ...album, tracks })
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

    // La dirección del audio se pide ahora: las de Deezer caducan a las horas.
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

  const withPreview = album.tracks.filter((track) => track.deezer).length
  const openTrackData = openTrack !== null ? album.tracks[openTrack] : null

  /** Marca discreta para los datos que escribió la persona. */
  function editedMark(field: string) {
    if (!wasEditedByUser(album.userEditedFields, field)) return null
    return (
      <span className="edited-mark" title="Editado por ti">
        ✎
      </span>
    )
  }

  return (
    <div className="preview">
      <header className="preview-header">
        <div className="cover-slot">
          {album.canonicalCover ? (
            <img
              className="cover-image"
              src={album.canonicalCover}
              alt={`Portada de ${album.title}`}
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
            {album.title}
            {editedMark('title')}
          </h2>
          <p className="preview-artist">
            {album.artists}
            {editedMark('artists')}
          </p>
          {album.artistLinks.length > 0 && (
            <div className="artist-links">
              {album.artistLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">{link.icon}</span> {link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="review-block">
        <div className="review-block-head">
          <h3 className="section-title">Datos del álbum</h3>
          {!editingAlbum && (
            <button
              className="btn-link"
              onClick={() => {
                setForm(album)
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
              <label className="field">
                <span className="field-label">Título</span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm('title', event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Artista</span>
                <input
                  value={form.artists}
                  onChange={(event) => updateForm('artists', event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Año</span>
                <input
                  value={form.year ?? ''}
                  placeholder="1990"
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
                  onChange={(event) => updateForm('label', event.target.value || null)}
                />
              </label>
              <label className="field field-wide">
                <span className="field-label">Géneros (separados por coma)</span>
                <input
                  value={form.genres.join(', ')}
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
                  onChange={(event) => updateForm('description', event.target.value || null)}
                />
              </label>
            </div>
            <div className="edit-actions">
              <button className="btn btn-ghost" onClick={() => setEditingAlbum(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveAlbumEdits}>
                Guardar cambios
              </button>
            </div>
          </>
        ) : (
          <dl className="preview-facts">
            <div>
              <dt>Año</dt>
              <dd>
                {album.year ?? 'Sin dato'}
                {editedMark('year')}
              </dd>
            </div>
            <div>
              <dt>Formato</dt>
              <dd>{format?.label ?? album.format}</dd>
            </div>
            <div>
              <dt>Sello</dt>
              <dd>
                {album.label ?? 'Sin dato'}
                {editedMark('label')}
              </dd>
            </div>
            <div>
              <dt>Género</dt>
              <dd>
                {album.genres.length > 0 ? album.genres.join(', ') : 'Sin dato'}
                {editedMark('genres')}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {album.description && !editingAlbum && (
        <section className="excerpt">
          <h3 className="section-title">Sobre el álbum</h3>
          <p className="excerpt-text">{album.description}</p>
          {album.descriptionSource && album.descriptionUrl ? (
            <p className="excerpt-source">
              Fuente: {album.descriptionSource} ·{' '}
              <a href={album.descriptionUrl} target="_blank" rel="noreferrer">
                Ver artículo completo
              </a>
            </p>
          ) : (
            <p className="excerpt-source">Escrito por ti</p>
          )}
        </section>
      )}

      <section className="tracklist">
        <h3 className="section-title">Tracklist ({album.tracks.length})</h3>

        <p className="tracklist-note">
          {withPreview > 0
            ? `Puedes escuchar 30 segundos de ${withPreview} de las ${album.tracks.length} canciones, cortesía de Deezer.`
            : 'Deezer no tiene adelantos de las canciones de este álbum.'}{' '}
          Haz clic en una canción para ver sus créditos y corregirlos.
          {!youtubeConfigured && (
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
                  const index = album.tracks.indexOf(track)
                  const key = `${side}-${track.number}-${track.title}`
                  const isPlaying = playingKey === key
                  const isBusy = busyKey === key
                  return (
                    <li className="track-row" key={key}>
                      <span className="track-number">{track.number}</span>

                      <button className="track-main track-open" onClick={() => setOpenTrack(index)}>
                        <span className="track-title">{track.title}</span>
                        {track.artist !== album.artists && (
                          <span className="track-artist">{track.artist}</span>
                        )}
                        <span className="track-credits-count">
                          {track.credits.length > 0
                            ? `${track.credits.length} créditos`
                            : 'Sin créditos'}
                          {track.userEditedFields.length > 0 && ' · editada por ti'}
                        </span>
                        {problem[key] && <span className="track-problem">{problem[key]}</span>}
                      </button>

                      <span className="track-duration">{track.duration ?? '—'}</span>

                      {youtubeConfigured && (
                        <YouTubeLink artist={track.artist} title={track.title} />
                      )}

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
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </section>

      <p className="hint">
        Siguiente paso: guardar el disco en tu colección. Esa parte llega con la base de datos.
      </p>

      <footer className="preview-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Elegir otra edición
        </button>
        <button className="btn btn-primary" onClick={onStartOver}>
          Empezar de nuevo
        </button>
      </footer>

      {openTrackData && openTrack !== null && (
        <TrackDetail
          track={openTrackData}
          albumArtist={album.artists}
          sideLabel={sideHeading(openTrackData.side, usesSides)}
          onChange={(updated) => updateTrack(openTrack, updated)}
          onClose={() => setOpenTrack(null)}
        />
      )}
    </div>
  )
}

/**
 * Botón extra para ver el video completo en YouTube.
 * Solo aparece si la persona configuró su clave; busca al pulsarlo, porque
 * cada búsqueda gasta cuota de su cuenta.
 */
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
