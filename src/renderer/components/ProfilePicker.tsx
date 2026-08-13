import { useState } from 'react'
import type { Profile } from '@core/models/profile'

interface ProfilePickerProps {
  profiles: Profile[]
  onPick: (profileId: string) => void
  /** Se llama tras crear, renombrar o borrar, para recargar la lista. */
  onChanged: () => void
}

const EMOJIS = ['🎧', '🎸', '🎹', '🎤', '🥁', '🎺', '📻', '💿', '🎷', '🪕']

/**
 * Selector de perfil al abrir la app.
 *
 * Un perfil separa datos, no los protege: no hay contraseña. Cualquiera que
 * abra la app puede entrar a cualquier perfil, y así se dice en la pantalla
 * para no dar una falsa sensación de seguridad.
 */
function ProfilePicker({ profiles, onPick, onChanged }: ProfilePickerProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0])
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    setBusy(true)
    const result = await window.api.createProfile(name, newEmoji)
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setNewName('')
    setCreating(false)
    onChanged()
  }

  async function handleRename(profileId: string) {
    const name = editName.trim()
    if (!name) return

    const result = await window.api.renameProfile(profileId, name, null)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setEditing(null)
    onChanged()
  }

  async function handleDelete(profileId: string) {
    const result = await window.api.deleteProfile(profileId)
    setConfirmDeleteId(null)

    if (!result.ok) {
      setError(result.error)
      return
    }
    onChanged()
  }

  return (
    <div className="profile-picker">
      <header className="profile-picker-header">
        <h2>¿Quién eres?</h2>
        <p>
          Cada perfil tiene sus propias colecciones, discos y setlists, sin mezclarse.
        </p>
      </header>

      {error && <p className="feedback-error">{error}</p>}

      <ul className="profile-cards">
        {profiles.map((profile) => (
          <li key={profile.id} className="profile-card-wrap">
            {editing === profile.id ? (
              <div className="profile-card profile-card-editing">
                <input
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleRename(profile.id)
                    if (event.key === 'Escape') setEditing(null)
                  }}
                  autoFocus
                />
                <div className="profile-card-editing-actions">
                  <button className="btn-link" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                  <button className="btn-link" onClick={() => handleRename(profile.id)}>
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="profile-card" onClick={() => onPick(profile.id)}>
                  <span className="profile-card-emoji" aria-hidden="true">
                    {profile.emoji}
                  </span>
                  <span className="profile-card-name">{profile.name}</span>
                </button>

                <div className="profile-card-actions">
                  <button
                    className="btn-link"
                    onClick={() => {
                      setEditing(profile.id)
                      setEditName(profile.name)
                    }}
                  >
                    Renombrar
                  </button>
                  {profiles.length > 1 &&
                    (confirmDeleteId === profile.id ? (
                      <span className="profile-confirm">
                        <span>¿Borrar todo lo suyo?</span>
                        <button className="btn-link" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </button>
                        <button
                          className="btn-link btn-link-danger"
                          onClick={() => handleDelete(profile.id)}
                        >
                          Sí
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn-link btn-link-danger"
                        onClick={() => setConfirmDeleteId(profile.id)}
                      >
                        Borrar
                      </button>
                    ))}
                </div>
              </>
            )}
          </li>
        ))}

        {!creating && (
          <li className="profile-card-wrap">
            <button className="profile-card profile-card-new" onClick={() => setCreating(true)}>
              <span className="profile-card-emoji" aria-hidden="true">
                +
              </span>
              <span className="profile-card-name">Nuevo perfil</span>
            </button>
          </li>
        )}
      </ul>

      {creating && (
        <div className="profile-create">
          <div className="profile-emoji-row">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`profile-emoji${newEmoji === emoji ? ' selected' : ''}`}
                onClick={() => setNewEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="setlist-create-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="Nombre del perfil"
              autoFocus
            />
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={busy || newName.trim().length === 0}
            >
              Crear
            </button>
          </div>
        </div>
      )}

      <p className="profile-picker-note">
        Los perfiles sirven para organizarse, no para esconder datos: no tienen
        contraseña y cualquiera que abra Waxbox puede entrar a cualquiera.
      </p>
    </div>
  )
}

export default ProfilePicker
