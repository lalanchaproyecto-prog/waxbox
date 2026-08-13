import { useEffect, useRef, useState } from 'react'
import type { CollectionSummary } from '@core/database/db'
import { imageSrc, type ImageRef } from '@core/models/imageRef'
import ImagePicker from './ImagePicker'

interface CollectionBarProps {
  collections: CollectionSummary[]
  activeId: number
  onSwitch: (collectionId: number) => void
  /** Se llama tras crear, renombrar o borrar, para que App recargue la lista. */
  onChanged: (activeIdHint?: number) => void
}

/**
 * Selector de la colección activa.
 *
 * Va en la cabecera y no dentro de la pantalla de la colección porque los
 * setlists también pertenecen a una colección: hace falta poder cambiar de una
 * a otra desde cualquier parte.
 */
function CollectionBar({ collections, activeId, onSwitch, onChanged }: CollectionBarProps) {
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const active = collections.find((item) => item.id === activeId)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Con una sola colección el selector sería ruido; solo se ofrece crear otra.
  const onlyOne = collections.length <= 1

  return (
    <div className="collection-bar" ref={wrapRef}>
      <button
        className="collection-switch"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Cambiar de colección"
      >
        <span className="collection-switch-icon" aria-hidden="true">
          &#128194;
        </span>
        <span className="collection-switch-name">{active?.name ?? 'Colección'}</span>
        <span className="collection-switch-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="collection-menu" role="menu">
          {!onlyOne && (
            <>
              <p className="collection-menu-title">Cambiar a</p>
              <ul className="collection-menu-list">
                {collections.map((item) => (
                  <li key={item.id}>
                    <button
                      className={`collection-menu-item${item.id === activeId ? ' active' : ''}`}
                      onClick={() => {
                        onSwitch(item.id)
                        setOpen(false)
                      }}
                    >
                      <span className="collection-menu-name">{item.name}</span>
                      <span className="collection-menu-count">
                        {item.albumCount === 1 ? '1 disco' : `${item.albumCount} discos`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            className="collection-menu-manage"
            onClick={() => {
              setManaging(true)
              setOpen(false)
            }}
          >
            Gestionar colecciones
          </button>
        </div>
      )}

      {managing && (
        <CollectionsManager
          collections={collections}
          activeId={activeId}
          onChanged={onChanged}
          onClose={() => setManaging(false)}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------

interface CollectionsManagerProps {
  collections: CollectionSummary[]
  activeId: number
  onChanged: (activeIdHint?: number) => void
  onClose: () => void
}

function CollectionsManager({
  collections,
  activeId,
  onChanged,
  onClose
}: CollectionsManagerProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  /** Colección a la que se le está eligiendo imagen. */
  const [imagenDe, setImagenDe] = useState<CollectionSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return

    const result = await window.api.createCollection(name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setNewName('')
    setCreating(false)
    onChanged(result.data.id)
  }

  async function handleRename(collectionId: number) {
    const name = renameValue.trim()
    if (!name) return

    const result = await window.api.renameCollection(collectionId, name)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setRenamingId(null)
    onChanged()
  }

  async function handleDelete(collectionId: number) {
    const result = await window.api.deleteCollection(collectionId)
    if (!result.ok) {
      setError(result.error)
      setConfirmDeleteId(null)
      return
    }

    setConfirmDeleteId(null)
    onChanged()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal collections-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Gestionar colecciones"
      >
        <header className="modal-header">
          <div>
            <h2>Mis colecciones</h2>
            <p className="modal-subtitle">
              Cada colección tiene sus propios discos y setlists, sin mezclarse.
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </header>

        {error && <p className="feedback-error">{error}</p>}

        <ul className="collection-rows">
          {collections.map((item) => (
            <li className="collection-row" key={item.id}>
              {renamingId === item.id ? (
                <div className="setlist-rename">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRename(item.id)
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                    autoFocus
                  />
                  <button className="btn btn-ghost" onClick={() => setRenamingId(null)}>
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={() => handleRename(item.id)}>
                    Guardar
                  </button>
                </div>
              ) : (
                <>
                  {imageSrc(item.image) && (
                    <img className="collection-row-image" src={imageSrc(item.image)!} alt="" />
                  )}
                  <div className="collection-row-text">
                    <span className="collection-row-name">
                      {item.name}
                      {item.id === activeId && <span className="collection-row-tag">activa</span>}
                    </span>
                    <span className="collection-row-meta">
                      {item.albumCount === 1 ? '1 disco' : `${item.albumCount} discos`}
                      {' · '}
                      {item.setlistCount === 1 ? '1 setlist' : `${item.setlistCount} setlists`}
                    </span>
                  </div>

                  <div className="collection-row-actions">
                    <button
                      className="btn-link"
                      onClick={() => {
                        setRenamingId(item.id)
                        setRenameValue(item.name)
                      }}
                    >
                      ✎ Renombrar
                    </button>

                    <button className="btn-link" onClick={() => setImagenDe(item)}>
                      🖼 Imagen
                    </button>

                    {confirmDeleteId === item.id ? (
                      <span className="confirm-delete">
                        <span>
                          Se borran sus {item.albumCount} discos y {item.setlistCount} setlists.
                        </span>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(item.id)}>
                          Sí, borrar
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn-link btn-link-danger"
                        onClick={() => setConfirmDeleteId(item.id)}
                        disabled={collections.length <= 1}
                        title={
                          collections.length <= 1
                            ? 'No puedes borrar tu única colección'
                            : 'Borrar esta colección'
                        }
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {creating ? (
          <div className="setlist-create-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate()
                if (event.key === 'Escape') setCreating(false)
              }}
              placeholder="Ej: Colección de mi papá"
              autoFocus
            />
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>
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
        ) : (
          <button className="btn btn-ghost" onClick={() => setCreating(true)}>
            + Nueva colección
          </button>
        )}

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>

      {imagenDe && (
        <ImagePicker
          title={imagenDe.name}
          current={imagenDe.image}
          destino="archivo"
          sugerencia={imagenDe.name}
          onChange={async (image: ImageRef | null) => {
            const result = await window.api.setCollectionImage(imagenDe.id, image)
            if (result.ok) onChanged()
            else setError(result.error)
          }}
          onClose={() => setImagenDe(null)}
        />
      )}
    </div>
  )
}

export default CollectionBar
