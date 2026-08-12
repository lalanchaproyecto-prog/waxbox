import { useState } from 'react'
import type { EditableTrack } from '@core/albumDraft'
import { markEdited } from '@core/albumDraft'
import { groupCredits, roleLabel, EDITABLE_ROLES } from '@core/models/credits'
import type { Credit } from '@core/models/credits'

interface TrackDetailProps {
  track: EditableTrack
  /** Artista del álbum, para saber si el de la canción es distinto. */
  albumArtist: string
  /** 'Lado A' o 'Disco 1', según el formato. */
  sideLabel: string | null
  onChange: (track: EditableTrack) => void
  onClose: () => void
}

/**
 * Detalle completo de una canción: duración, lado, artista y créditos.
 *
 * Solo se muestran los datos que existen. Si MusicBrainz no trae compositor,
 * no aparece una línea vacía de "Compositor: —": simplemente no está, y la
 * persona puede agregarlo si lo sabe.
 */
function TrackDetail({ track, albumArtist, sideLabel, onChange, onClose }: TrackDetailProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditableTrack>(track)

  // Campos del formulario para agregar un crédito nuevo.
  const [newRole, setNewRole] = useState<string>('composer')
  const [newArtist, setNewArtist] = useState('')
  const [newDetail, setNewDetail] = useState('')

  const shown = editing ? draft : track
  const groups = groupCredits(shown.credits)

  function update(field: keyof EditableTrack, value: unknown) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      userEditedFields: markEdited(current.userEditedFields, field)
    }))
  }

  function addCredit() {
    const artist = newArtist.trim()
    if (!artist) return

    const credit: Credit = {
      role: newRole,
      artist,
      detail: newDetail.trim() || null,
      source: 'usuario'
    }

    setDraft((current) => ({
      ...current,
      credits: [...current.credits, credit],
      userEditedFields: markEdited(current.userEditedFields, 'credits')
    }))
    setNewArtist('')
    setNewDetail('')
  }

  function removeCredit(target: Credit) {
    setDraft((current) => ({
      ...current,
      credits: current.credits.filter((credit) => credit !== target),
      userEditedFields: markEdited(current.userEditedFields, 'credits')
    }))
  }

  function save() {
    onChange(draft)
    setEditing(false)
  }

  function cancel() {
    setDraft(track)
    setEditing(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            {editing ? (
              <input
                className="modal-title-input"
                value={draft.title}
                onChange={(event) => update('title', event.target.value)}
              />
            ) : (
              <h2>{shown.title}</h2>
            )}
            <p className="modal-subtitle">{shown.artist}</p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </header>

        <dl className="detail-facts">
          {sideLabel && (
            <div>
              <dt>Ubicación</dt>
              <dd>
                {sideLabel} · pista {shown.number}
              </dd>
            </div>
          )}
          {shown.duration && (
            <div>
              <dt>Duración</dt>
              <dd>{shown.duration}</dd>
            </div>
          )}
          {/* El artista solo se destaca cuando difiere del álbum, que es el
              caso de los compilatorios. */}
          {shown.artist !== albumArtist && (
            <div>
              <dt>Artista de esta canción</dt>
              <dd>{shown.artist}</dd>
            </div>
          )}
        </dl>

        {editing && (
          <div className="edit-grid">
            <label className="field">
              <span className="field-label">Artista de la canción</span>
              <input
                value={draft.artist}
                onChange={(event) => update('artist', event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Duración</span>
              <input
                value={draft.duration ?? ''}
                placeholder="4:26"
                onChange={(event) => update('duration', event.target.value || null)}
              />
            </label>
          </div>
        )}

        <section className="credits">
          <h3 className="section-title">Créditos</h3>

          {groups.length === 0 && !editing && (
            <p className="credits-empty">
              MusicBrainz no tiene créditos de esta canción. Puedes agregarlos tú si los conoces.
            </p>
          )}

          {groups.map((group) => (
            <div className="credit-group" key={group.role}>
              <span className="credit-role">{group.label}</span>
              <div className="credit-people">
                {group.credits.map((credit, index) => (
                  <span className="credit-person" key={`${credit.artist}-${index}`}>
                    {credit.artist}
                    {credit.detail && <em className="credit-detail"> {credit.detail}</em>}
                    {credit.source === 'usuario' && (
                      <span className="credit-mine" title="Agregado por ti">
                        ✎
                      </span>
                    )}
                    {editing && (
                      <button
                        className="credit-remove"
                        onClick={() => removeCredit(credit)}
                        title="Quitar este crédito"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {editing && (
            <div className="credit-add">
              <select value={newRole} onChange={(event) => setNewRole(event.target.value)}>
                {EDITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <input
                value={newArtist}
                placeholder="Nombre"
                onChange={(event) => setNewArtist(event.target.value)}
              />
              <input
                value={newDetail}
                placeholder="Detalle (opcional)"
                onChange={(event) => setNewDetail(event.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={addCredit}
                disabled={newArtist.trim().length === 0}
              >
                Agregar
              </button>
            </div>
          )}
        </section>

        <footer className="modal-footer">
          {editing ? (
            <>
              <button className="btn btn-ghost" onClick={cancel}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={save}>
                Guardar cambios
              </button>
            </>
          ) : (
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              ✎ Editar esta canción
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default TrackDetail
