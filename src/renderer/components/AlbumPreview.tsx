import type { ReleaseDetails, ReleaseTrack } from '@core/services/musicbrainz'
import { getFormat } from '@core/models/formats'

interface AlbumPreviewProps {
  details: ReleaseDetails
  physicalFormatId: string
  onBack: () => void
  onStartOver: () => void
}

/** Agrupa las canciones por lado o disco, conservando el orden. */
function groupBySide(tracks: ReleaseTrack[]): Array<[string, ReleaseTrack[]]> {
  const groups = new Map<string, ReleaseTrack[]>()
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

function AlbumPreview({ details, physicalFormatId, onBack, onStartOver }: AlbumPreviewProps) {
  const format = getFormat(physicalFormatId)
  const usesSides = format?.usesSides ?? false
  const groups = groupBySide(details.tracks)

  // Se muestra el año original solo si esta copia es una reedición posterior.
  const isReissue =
    details.originalYear !== null &&
    details.year !== null &&
    details.originalYear !== details.year

  return (
    <div className="preview">
      <header className="preview-header">
        <h2>{details.title}</h2>
        <p className="preview-artist">{details.artists}</p>
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

      <section className="tracklist">
        <h3 className="section-title">Tracklist ({details.tracks.length})</h3>

        {groups.map(([side, tracks]) => {
          const heading = sideHeading(side, usesSides)
          return (
            <div className="side-group" key={side}>
              {heading && <h4 className="side-heading">{heading}</h4>}
              <ol className="track-rows">
                {tracks.map((track) => (
                  <li className="track-row" key={`${side}-${track.number}-${track.title}`}>
                    <span className="track-number">{track.number}</span>
                    <span className="track-main">
                      <span className="track-title">{track.title}</span>
                      {/* En un compilatorio cada canción es de un artista distinto,
                          así que solo se muestra cuando difiere del artista del álbum. */}
                      {track.artist !== details.artists && (
                        <span className="track-artist">{track.artist}</span>
                      )}
                    </span>
                    <span className="track-duration">{track.duration ?? '—'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </section>

      <p className="hint">
        Siguiente paso: buscar la portada oficial en Cover Art Archive y los datos curiosos en
        Wikipedia.
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

export default AlbumPreview
