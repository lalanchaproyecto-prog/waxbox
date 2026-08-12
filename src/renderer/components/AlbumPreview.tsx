import { useEffect, useRef, useState } from 'react'
import type { AlbumSheet, SheetTrack } from '@core/services/albumSheet'
import { getFormat } from '@core/models/formats'

interface AlbumPreviewProps {
  sheet: AlbumSheet
  physicalFormatId: string
  /** Si hay clave de YouTube configurada. Es un extra, no lo esencial. */
  youtubeConfigured: boolean
  onOpenSettings: () => void
  onBack: () => void
  onStartOver: () => void
}

/** Agrupa las canciones por lado o disco, conservando el orden. */
function groupBySide(tracks: SheetTrack[]): Array<[string, SheetTrack[]]> {
  const groups = new Map<string, SheetTrack[]>()
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

function AlbumPreview({
  sheet,
  physicalFormatId,
  youtubeConfigured,
  onOpenSettings,
  onBack,
  onStartOver
}: AlbumPreviewProps) {
  const { release: details, tracks, cover, excerpt, artistLinks } = sheet
  const format = getFormat(physicalFormatId)
  const usesSides = format?.usesSides ?? false
  const groups = groupBySide(tracks)

  // Un solo reproductor para todo el álbum: al darle play a una canción, la
  // anterior se detiene sola, como esperaría cualquiera.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [problem, setProblem] = useState<Record<string, string>>({})

  // Al salir de la ficha se detiene el audio, para que no siga sonando.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  async function handlePlay(track: SheetTrack, key: string) {
    // Si ya está sonando esta canción, el botón funciona como pausa.
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

    // La dirección del audio se pide ahora, no antes: las de Deezer caducan
    // a las pocas horas, así que guardarlas no serviría.
    const result = await window.api.getPreviewUrl(track.deezer.trackId)
    setBusyKey(null)

    if (!result.ok || !result.data) {
      setProblem((current) => ({
        ...current,
        [key]: result.ok
          ? 'Deezer ya no ofrece adelanto de esta canción.'
          : result.error
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

  // Se muestra el año original solo si esta copia es una reedición posterior.
  const isReissue =
    details.originalYear !== null &&
    details.year !== null &&
    details.originalYear !== details.year

  const withPreview = tracks.filter((track) => track.deezer).length

  return (
    <div className="preview">
      <header className="preview-header">
        <div className="cover-slot">
          {cover ? (
            <img
              className="cover-image"
              src={cover.thumbnailUrl ?? cover.imageUrl}
              alt={`Portada de ${details.title}`}
            />
          ) : (
            <div className="cover-missing">
              <span>Sin portada</span>
              <span>en el catálogo</span>
            </div>
          )}
        </div>
        <div className="preview-titles">
          <h2>{details.title}</h2>
          <p className="preview-artist">{details.artists}</p>
          {cover && (
            <p className="cover-source">
              Portada oficial ·{' '}
              {cover.source === 'edicion' ? 'de esta edición' : 'de otra edición del álbum'}
            </p>
          )}
          {artistLinks.length > 0 && (
            <div className="artist-links">
              {artistLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">{link.icon}</span> {link.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <dl className="preview-facts">
        <div>
          <dt>Año</dt>
          <dd>
            {details.year ?? 'Sin dato'}
            {isReissue && (
              <span className="fact-note"> (edición original: {details.originalYear})</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Formato</dt>
          <dd>{format?.label ?? physicalFormatId}</dd>
        </div>
        <div>
          <dt>Sello</dt>
          <dd>{details.label ?? 'Sin dato'}</dd>
        </div>
        <div>
          <dt>Género</dt>
          <dd>{details.genres.length > 0 ? details.genres.join(', ') : 'Sin dato'}</dd>
        </div>
      </dl>

      {excerpt && (
        <section className="excerpt">
          <h3 className="section-title">
            {excerpt.about === 'album' ? 'Sobre el álbum' : 'Sobre el artista'}
          </h3>
          <p className="excerpt-text">{excerpt.text}</p>
          <p className="excerpt-source">
            Fuente: {excerpt.source} ·{' '}
            {/* Electron abre este enlace en el navegador, no dentro de la app. */}
            <a href={excerpt.url} target="_blank" rel="noreferrer">
              Ver artículo completo
            </a>
          </p>
        </section>
      )}

      <section className="tracklist">
        <h3 className="section-title">Tracklist ({tracks.length})</h3>

        <p className="tracklist-note">
          {withPreview > 0
            ? `Puedes escuchar 30 segundos de ${withPreview} de las ${tracks.length} canciones, cortesía de Deezer.`
            : 'Deezer no tiene adelantos de las canciones de este álbum.'}
          {!youtubeConfigured && (
            <>
              {' '}
              Si además quieres ver el video completo,{' '}
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
                  const key = `${side}-${track.number}-${track.title}`
                  const isPlaying = playingKey === key
                  const isBusy = busyKey === key
                  return (
                    <li className="track-row" key={key}>
                      <span className="track-number">{track.number}</span>
                      <span className="track-main">
                        <span className="track-title">{track.title}</span>
                        {/* En un compilatorio cada canción es de un artista distinto,
                            así que solo se muestra cuando difiere del artista del álbum. */}
                        {track.artist !== details.artists && (
                          <span className="track-artist">{track.artist}</span>
                        )}
                        {problem[key] && <span className="track-problem">{problem[key]}</span>}
                      </span>
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
        Siguiente paso: la pantalla de revisión para corregir cualquier dato antes de guardar.
      </p>

      <footer className="preview-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Elegir otra edición
        </button>
        <button className="btn btn-primary" onClick={onStartOver}>
          Empezar de nuevo
        </button>
      </footer>
    </div>
  )
}

/**
 * Botón extra para ver el video completo en YouTube.
 *
 * Solo aparece si la persona configuró su clave. Busca el video en el momento
 * en que se pulsa, porque cada búsqueda gasta cuota de su cuenta.
 */
function YouTubeLink({ artist, title }: { artist: string; title: string }) {
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    const result = await window.api.searchTrackVideo(artist, title)
    setBusy(false)

    if (result.ok && result.data) {
      window.open(result.data.url, '_blank')
    }
  }

  return (
    <button
      className="youtube-btn"
      onClick={open}
      disabled={busy}
      title="Ver el video completo en YouTube"
    >
      {busy ? '···' : 'YT'}
    </button>
  )
}

export default AlbumPreview
