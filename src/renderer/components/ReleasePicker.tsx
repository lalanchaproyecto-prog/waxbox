import { useState } from 'react'
import type { ReleaseCandidate } from '@core/services/musicbrainz'
import PageHeader from './PageHeader'
import FlowSteps from './FlowSteps'
import { PASOS_CATALOGO } from './AddAlbumForm'
import { IconBack } from './Icons'

interface ReleasePickerProps {
  candidates: ReleaseCandidate[]
  onPick: (candidate: ReleaseCandidate) => void
  onBack: () => void
  /** Salir del flujo entero, no solo retroceder un paso. */
  onCancel: () => void
}

function countryFlag(code: string): string {
  const upper = code.toUpperCase()
  if (upper.length !== 2) return code
  const a = upper.codePointAt(0)! - 65 + 0x1f1e6
  const b = upper.codePointAt(1)! - 65 + 0x1f1e6
  return String.fromCodePoint(a, b)
}

function CoverThumb({ musicbrainzId, title }: { musicbrainzId: string; title: string }) {
  const [failed, setFailed] = useState(false)
  const src = `https://coverartarchive.org/release/${musicbrainzId}/front-250`

  if (failed) {
    return <span className="candidate-cover-placeholder">🎵</span>
  }

  return (
    <img
      className="candidate-cover"
      src={src}
      alt={`Portada de ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

function ReleasePicker({ candidates, onPick, onBack, onCancel }: ReleasePickerProps) {
  return (
    <div className="screen picker">
      <FlowSteps steps={PASOS_CATALOGO} current={1} onCancel={onCancel} />

      <button className="page-back" onClick={onBack}>
        <IconBack size={16} />
        <span>Cambiar la búsqueda</span>
      </button>

      <PageHeader
        title="Elige tu edición"
        subtitle={`${candidates.length} ${
          candidates.length === 1 ? 'edición encontrada' : 'ediciones encontradas'
        } · fíjate en el año, el país y el formato`}
      />

      <ul className="candidate-list">
        {candidates.map((candidate) => (
          <li key={candidate.musicbrainzId}>
            <button className="candidate" onClick={() => onPick(candidate)}>
              <div className="candidate-cover-wrap">
                <CoverThumb musicbrainzId={candidate.musicbrainzId} title={candidate.title} />
              </div>
              <div className="candidate-body">
                <span className="candidate-main">
                  <span className="candidate-title">{candidate.title}</span>
                  <span className="candidate-artist">{candidate.artist}</span>
                  {candidate.disambiguation && (
                    <span className="candidate-note">{candidate.disambiguation}</span>
                  )}
                </span>
                <span className="candidate-meta">
                  {candidate.year && <span className="tag">{candidate.year}</span>}
                  {candidate.country && (
                    <span className="tag">
                      {countryFlag(candidate.country)} {candidate.country}
                    </span>
                  )}
                  {candidate.mediaFormat && <span className="tag">{candidate.mediaFormat}</span>}
                  {candidate.label && <span className="tag">{candidate.label}</span>}
                  {candidate.trackCount && (
                    <span className="tag">{candidate.trackCount} canciones</span>
                  )}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

    </div>
  )
}

export default ReleasePicker
