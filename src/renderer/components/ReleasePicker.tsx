import type { ReleaseCandidate } from '@core/services/musicbrainz'

interface ReleasePickerProps {
  candidates: ReleaseCandidate[]
  onPick: (candidate: ReleaseCandidate) => void
  onBack: () => void
}

/**
 * Un mismo álbum suele tener muchas ediciones en MusicBrainz: distintos países,
 * años, sellos y formatos. Solo la persona sabe cuál tiene en la mano, así que
 * se las mostramos para que elija.
 */
function ReleasePicker({ candidates, onPick, onBack }: ReleasePickerProps) {
  return (
    <div className="picker">
      <header className="picker-header">
        <h2>Elige tu edición</h2>
        <p>
          MusicBrainz encontró {candidates.length}{' '}
          {candidates.length === 1 ? 'edición' : 'ediciones'}. Elige la que coincide con tu copia
          — fíjate en el año, el país y el formato.
        </p>
      </header>

      <ul className="candidate-list">
        {candidates.map((candidate) => (
          <li key={candidate.musicbrainzId}>
            <button className="candidate" onClick={() => onPick(candidate)}>
              <span className="candidate-main">
                <span className="candidate-title">{candidate.title}</span>
                <span className="candidate-artist">{candidate.artist}</span>
                {candidate.disambiguation && (
                  <span className="candidate-note">{candidate.disambiguation}</span>
                )}
              </span>
              <span className="candidate-meta">
                {candidate.year && <span className="tag">{candidate.year}</span>}
                {candidate.country && <span className="tag">{candidate.country}</span>}
                {candidate.mediaFormat && <span className="tag">{candidate.mediaFormat}</span>}
                {candidate.trackCount && (
                  <span className="tag">{candidate.trackCount} canciones</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <footer className="picker-footer">
        <button className="btn btn-ghost" onClick={onBack}>
          Volver
        </button>
      </footer>
    </div>
  )
}

export default ReleasePicker
